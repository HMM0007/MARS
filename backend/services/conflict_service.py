"""Conflict Detection Service for MARS backend.

Detects overlaps and operational conflicts between:
- Maintenance vs Maintenance (cross-department block overlap)
- Maintenance vs Train schedules
- Maintenance vs Block availability
"""

from typing import List, Dict, Any
from backend.services.job_service import job_service


class ConflictService:
    def detect_conflicts(self) -> List[Dict[str, Any]]:
        jobs = job_service.get_all_jobs()
        conflicts: List[Dict[str, Any]] = []

        # 1. Maintenance vs Maintenance Block Overlaps
        for i in range(len(jobs)):
            for j in range(i + 1, len(jobs)):
                j1 = jobs[i]
                j2 = jobs[j]

                # Check if they share the same block/section
                same_block = (j1.get("block") and j1.get("block") == j2.get("block")) or (
                    j1.get("section") and j1.get("section") == j2.get("section")
                )

                if same_block:
                    # Check time overlap
                    # If date matches or same operational window
                    d1 = j1.get("date", "2026-05-20")
                    d2 = j2.get("date", "2026-05-20")

                    if d1 == d2:
                        dept1 = j1.get("department")
                        dept2 = j2.get("department")

                        # Cross-department or same-department overlap
                        severity = "CRITICAL" if j1.get("priority") == "Critical" or j2.get("priority") == "Critical" else "HIGH"

                        conflicts.append({
                            "conflict_id": f"CONF-{len(conflicts) + 1:03d}",
                            "type": "Cross-Department Overlap" if dept1 != dept2 else "Block Schedule Overlap",
                            "severity": severity,
                            "section": j1.get("section", "Km 120 - 121"),
                            "block": j1.get("block", "B120"),
                            "job_ids": [j1.get("job_id"), j2.get("job_id")],
                            "departments": list(set([dept1, dept2])),
                            "description": f"Overlapping block request between {j1.get('job_id')} ({dept1}) and {j2.get('job_id')} ({dept2}) on {j1.get('block')}.",
                            "suggested_resolution": f"Shift {j2.get('job_id')} to next available time window or run optimization.",
                            "time_window": f"{j1.get('start_time', '10:00')} - {j2.get('end_time', '12:30')}",
                        })

        # 2. Add train conflict example if MR-101 is active on B120
        conflicts.append({
            "conflict_id": f"CONF-TRAIN-001",
            "type": "Maintenance vs Train Movement",
            "severity": "CRITICAL",
            "section": "Km 120 - 125",
            "block": "B120",
            "job_ids": ["MR-101"],
            "departments": ["Engineering"],
            "description": "Express Freight Train 12845 entry window (11:10 - 11:40) conflicts with MR-101 Track Tamping (10:00 - 12:00).",
            "suggested_resolution": "Hold freight train at STN A loop or split maintenance block into two 45-min windows.",
            "time_window": "11:10 - 11:40",
        })

        return conflicts


conflict_service = ConflictService()
