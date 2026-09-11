from typing import List

from app.data_loader import load_json
from app.models.job import MaintenanceJob


class TMSAdapter:
    """TMS boundary for Engineering jobs.

    The prototype reads the committed synthetic dataset. In production this
    class is the swap point for the CRIS TMS REST/JSON client.
    """

    @staticmethod
    def fetch_engineering_jobs() -> List[MaintenanceJob]:
        all_jobs = load_json("jobs.json")
        return [
            MaintenanceJob(**job)
            for job in all_jobs
            if job.get("department") == "Engineering"
        ]
