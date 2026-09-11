from typing import List

from app.data_loader import load_json
from app.models.job import MaintenanceJob


class TDMSAdapter:
    """TDMS boundary for Traction/OHE jobs."""

    @staticmethod
    def fetch_traction_jobs() -> List[MaintenanceJob]:
        all_jobs = load_json("jobs.json")
        return [
            MaintenanceJob(**job)
            for job in all_jobs
            if job.get("department") == "Traction"
        ]
