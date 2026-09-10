import json
from pathlib import Path
from typing import List
from app.models.job import MaintenanceJob

BASE_DIR = Path(__file__).resolve().parents[3] # MARS-2.0 root
DATA_PATH = BASE_DIR / "data" / "raw" / "jobs.json"

if not DATA_PATH.exists():
    DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "jobs.json"


class TDMSAdapter:
    @staticmethod
    def fetch_traction_jobs() -> List[MaintenanceJob]:
        if not DATA_PATH.exists():
            return []

        with open(DATA_PATH, "r", encoding="utf-8") as f:
            all_jobs = json.load(f)

        trc_raw_jobs = [j for j in all_jobs if j.get("department") == "Traction"]
        return [MaintenanceJob(**j) for j in trc_raw_jobs]