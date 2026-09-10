import json
from pathlib import Path
from typing import List
from app.models.job import MaintenanceJob

# Robust path resolution checking both root data and backend data
BASE_DIR = Path(__file__).resolve().parents[3] # MARS-2.0 root
DATA_PATH = BASE_DIR / "data" / "raw" / "jobs.json"

if not DATA_PATH.exists():
    # Fallback to backend/data/raw/jobs.json if run from inside backend
    DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "jobs.json"


class TMSAdapter:
    @staticmethod
    def fetch_engineering_jobs() -> List[MaintenanceJob]:
        if not DATA_PATH.exists():
            return []

        with open(DATA_PATH, "r", encoding="utf-8") as f:
            all_jobs = json.load(f)

        eng_raw_jobs = [j for j in all_jobs if j.get("department") == "Engineering"]
        return [MaintenanceJob(**j) for j in eng_raw_jobs]