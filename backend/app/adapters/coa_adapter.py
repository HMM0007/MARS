
import json
from pathlib import Path
from typing import List
from app.models.train import TrainMovement, FreightForecast

# Robust path resolution checking both root data and backend data
BASE_DIR = Path(__file__).resolve().parents[3]  # MARS-2.0 root
RAW_DIR = BASE_DIR / "data" / "raw"

if not (RAW_DIR / "trains.json").exists():
    # Fallback to backend/data/raw/ if run from inside backend
    RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"


class COAAdapter:
    """
    Adapter simulating REST API webhooks from CRIS COA
    (Control Office Application).
    Provides train timetables (passenger/express) and goods movement forecasts.
    """

    @staticmethod
    def fetch_passenger_timetable() -> List[TrainMovement]:
        timetable_path = RAW_DIR / "trains.json"
        if not timetable_path.exists():
            return []

        with open(timetable_path, "r", encoding="utf-8") as f:
            raw_trains = json.load(f)

        return [TrainMovement(**t) for t in raw_trains]

    @staticmethod
    def fetch_freight_forecast() -> List[FreightForecast]:
        forecast_path = RAW_DIR / "freight_forecast.json"
        if not forecast_path.exists():
            return []

        with open(forecast_path, "r", encoding="utf-8") as f:
            raw_forecasts = json.load(f)

        return [FreightForecast(**fg) for fg in raw_forecasts]