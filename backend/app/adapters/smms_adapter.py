from typing import List

from app.data_loader import load_json
from app.models.job import MaintenanceJob


class SMMSAdapter:
    """SMMS boundary for Signal & Telecom jobs."""

    @staticmethod
    def fetch_snt_jobs() -> List[MaintenanceJob]:
        all_jobs = load_json("jobs.json")
        return [
            MaintenanceJob(**job)
            for job in all_jobs
            if job.get("department") == "S&T"
        ]
