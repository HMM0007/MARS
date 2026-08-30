"""Maintenance Job Service for MARS backend.

Provides in-memory & CSV persistence, CRUD operations, department filtering,
and job status transitions.
"""

from datetime import datetime, date
from typing import List, Dict, Any, Optional
from pathlib import Path
import pandas as pd

from backend.config import JOBS_FILE, SAMPLE_DATA_DIR


class JobService:
    def __init__(self, data_file: Path = JOBS_FILE):
        self.data_file = data_file
        self._jobs: List[Dict[str, Any]] = []
        self.load_jobs()

    def load_jobs(self) -> List[Dict[str, Any]]:
        """Load jobs from CSV or fallback default dataset."""
        if self.data_file.exists():
            try:
                df = pd.read_csv(self.data_file, keep_default_na=False)
                self._jobs = df.to_dict(orient="records")
                return self._jobs
            except Exception as e:
                print(f"Warning loading jobs CSV: {e}")

        # Default initial dataset if CSV file is missing or empty
        self._jobs = [
            {
                "job_id": "MR-101",
                "asset_id": "A008",
                "department": "Engineering",
                "work_type": "Track Tamping",
                "description": "Track tamping and alignment check",
                "section": "Km 120 - 121",
                "block": "B120",
                "duration_min": 120,
                "priority": "Critical",
                "deadline": "2026-09-04",
                "status": "OPEN",
                "start_time": "10:00",
                "end_time": "12:00",
                "date": "2026-05-20",
                "block_required": "Yes",
                "isolation_required": "Yes",
                "created_date": "2026-08-05",
                "created_by": "ENG001",
            },
            {
                "job_id": "MR-102",
                "asset_id": "A022",
                "department": "S&T",
                "work_type": "Signal Inspection",
                "description": "Signal equipment & interlocking check",
                "section": "Km 120 - 121",
                "block": "B120",
                "duration_min": 90,
                "priority": "High",
                "deadline": "2026-09-06",
                "status": "OPEN",
                "start_time": "11:00",
                "end_time": "12:30",
                "date": "2026-05-20",
                "block_required": "Yes",
                "isolation_required": "Yes",
                "created_date": "2026-08-16",
                "created_by": "SNT001",
            },
            {
                "job_id": "MR-103",
                "asset_id": "A018",
                "department": "Traction",
                "work_type": "OHE Inspection",
                "description": "Overhead equipment height and stagger inspection",
                "section": "Km 120 - 122",
                "block": "B120",
                "duration_min": 60,
                "priority": "Medium",
                "deadline": "2026-09-07",
                "status": "OPEN",
                "start_time": "14:00",
                "end_time": "15:00",
                "date": "2026-05-22",
                "block_required": "Yes",
                "isolation_required": "Yes",
                "created_date": "2026-08-04",
                "created_by": "TRD001",
            },
            {
                "job_id": "MR-104",
                "asset_id": "A004",
                "department": "Engineering",
                "work_type": "Track Renewal",
                "description": "Sleepers and rail renewal",
                "section": "Km 130 - 131",
                "block": "B130",
                "duration_min": 180,
                "priority": "High",
                "deadline": "2026-09-07",
                "status": "PLANNED",
                "start_time": "09:00",
                "end_time": "12:00",
                "date": "2026-05-22",
                "block_required": "Yes",
                "isolation_required": "Yes",
                "created_date": "2026-08-02",
                "created_by": "ENG001",
            },
            {
                "job_id": "MR-105",
                "asset_id": "A025",
                "department": "S&T",
                "work_type": "Interlocking Test",
                "description": "Point machine & route relay interlocking test",
                "section": "Km 150 - 151",
                "block": "B150",
                "duration_min": 90,
                "priority": "Medium",
                "deadline": "2026-09-01",
                "status": "PLANNED",
                "start_time": "13:00",
                "end_time": "14:30",
                "date": "2026-05-23",
                "block_required": "Yes",
                "isolation_required": "No",
                "created_date": "2026-08-04",
                "created_by": "SNT001",
            },
            {
                "job_id": "MR-106",
                "asset_id": "A003",
                "department": "Engineering",
                "work_type": "Point Machine Inspection",
                "description": "Track point & switch blade inspection",
                "section": "Km 158 - 159",
                "block": "B158",
                "duration_min": 60,
                "priority": "Critical",
                "deadline": "2026-08-30",
                "status": "IN PROGRESS",
                "start_time": "08:00",
                "end_time": "09:00",
                "date": "2026-05-23",
                "block_required": "Yes",
                "isolation_required": "Yes",
                "created_date": "2026-08-23",
                "created_by": "ENG001",
            },
        ]
        self.save_jobs()
        return self._jobs

    def save_jobs(self):
        """Save current in-memory jobs to CSV."""
        try:
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            df = pd.DataFrame(self._jobs)
            df.to_csv(self.data_file, index=False)
        except Exception as e:
            print(f"Error saving jobs CSV: {e}")

    def get_all_jobs(
        self,
        department: Optional[str] = None,
        status: Optional[str] = None,
        section: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Filter jobs based on query parameters."""
        jobs = self._jobs
        if department and department != "All":
            jobs = [j for j in jobs if j.get("department") == department]
        if status and status != "All":
            jobs = [j for j in jobs if j.get("status", "").upper() == status.upper()]
        if section:
            jobs = [j for j in jobs if section.lower() in j.get("section", "").lower()]
        if priority and priority != "All":
            jobs = [j for j in jobs if j.get("priority", "").lower() == priority.lower()]
        return jobs

    def get_job_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        for job in self._jobs:
            if job.get("job_id") == job_id or job.get("id") == job_id:
                return job
        return None

    def create_job(self, data: Dict[str, Any], user_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a new maintenance job request."""
        # Auto-generate job_id if not present
        existing_ids = [int(j.get("job_id", "MR-0").replace("MR-", "").replace("J", "")) for j in self._jobs if j.get("job_id")]
        next_num = max(existing_ids, default=100) + 1
        job_id = f"MR-{next_num}"

        dept = data.get("department")
        if user_info and user_info.get("department") and user_info.get("department") != "Divisional Planner":
            dept = user_info["department"]

        new_job = {
            "job_id": job_id,
            "id": job_id,
            "asset_id": data.get("asset_id", "A001"),
            "department": dept or "Engineering",
            "work_type": data.get("work_type") or data.get("description", "Maintenance Work"),
            "description": data.get("description", "Maintenance Request"),
            "section": data.get("section", "Km 120 - 121"),
            "block": data.get("block", "B120"),
            "duration_min": int(data.get("duration_min", 90)),
            "priority": data.get("priority", "Medium"),
            "deadline": data.get("deadline", str(date.today())),
            "status": data.get("status", "OPEN"),
            "start_time": data.get("start_time", "10:00"),
            "end_time": data.get("end_time", "12:00"),
            "date": data.get("date", "2026-05-20"),
            "block_required": data.get("block_required", "Yes"),
            "isolation_required": data.get("isolation_required", "Yes"),
            "created_date": str(date.today()),
            "created_by": user_info.get("employee_id", "SYSTEM") if user_info else "SYSTEM",
            "remarks": data.get("remarks", ""),
        }

        self._jobs.append(new_job)
        self.save_jobs()
        return new_job

    def update_job(self, job_id: str, updates: Dict[str, Any], user_info: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        job = self.get_job_by_id(job_id)
        if not job:
            return None

        # Check department authorization
        if user_info and user_info.get("role") != "Divisional Planner":
            if job.get("department") != user_info.get("department"):
                raise PermissionError("You cannot modify maintenance requests belonging to another department.")

        job.update(updates)
        self.save_jobs()
        return job

    def delete_job(self, job_id: str, user_info: Optional[Dict[str, Any]] = None) -> bool:
        job = self.get_job_by_id(job_id)
        if not job:
            return False

        if user_info and user_info.get("role") != "Divisional Planner":
            if job.get("department") != user_info.get("department"):
                raise PermissionError("You cannot delete maintenance requests belonging to another department.")

        self._jobs = [j for j in self._jobs if j.get("job_id") != job_id and j.get("id") != job_id]
        self.save_jobs()
        return True


job_service = JobService()
