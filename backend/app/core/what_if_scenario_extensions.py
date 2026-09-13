from datetime import timedelta
from typing import List

from fastapi import HTTPException

from app.models.train import TrainMovement


def build_freight_surge_trains(trains: List[TrainMovement], scenario: dict, percent: int) -> List[TrainMovement]:
    if percent not in {20, 40}:
        raise HTTPException(status_code=422, detail={"error": "INVALID_FREIGHT_SURGE", "message": "Freight surge must be 20% or 40%."})
    freight = [t for t in trains if getattr(t, "train_type", "").upper() == "FREIGHT"]
    if not freight:
        raise HTTPException(status_code=422, detail={"error": "NO_FREIGHT_BASELINE", "message": "No freight movements are available in the COA timetable for this scenario."})
    count = max(1, round(len(freight) * percent / 100))
    start = scenario["start_time"]
    end = start + timedelta(minutes=scenario["duration_minutes"])
    result = []
    for i, source in enumerate(freight[:count], 1):
        entry = max(source.entry_time, start)
        exit_time = min(source.exit_time, end)
        if exit_time > entry:
            result.append(TrainMovement(train_id=f"WHATIF-FREIGHT-{percent}-{i}", train_number="WHAT-IF-FRT", train_name="Freight Surge Scenario Path", train_type="FREIGHT", section_id=source.section_id, track_id=source.track_id, entry_time=entry, exit_time=exit_time, priority=source.priority, direction=source.direction, is_fixed=True))
    if not result:
        raise HTTPException(status_code=422, detail={"error": "SURGE_WINDOW_EMPTY", "message": "The selected freight surge window does not overlap baseline freight movements."})
    return result


def build_monsoon_slowdown_trains(trains: List[TrainMovement], scenario: dict, percent: int) -> List[TrainMovement]:
    if percent not in {10, 20, 30}:
        raise HTTPException(status_code=422, detail={"error": "INVALID_WEATHER_SLOWDOWN", "message": "Weather slowdown must be 10%, 20%, or 30%."})
    start = scenario["start_time"]
    end = start + timedelta(minutes=scenario["duration_minutes"])
    affected = [t for t in trains if t.entry_time < end and t.exit_time > start]
    if not affected:
        raise HTTPException(status_code=422, detail={"error": "WEATHER_WINDOW_EMPTY", "message": "The selected weather window does not overlap timetable movements."})
    result = []
    for i, source in enumerate(affected, 1):
        overlap_start = max(source.entry_time, start)
        overlap_end = min(source.exit_time, end)
        minutes = max(1, int((overlap_end - overlap_start).total_seconds() // 60))
        extra = max(5, round(minutes * percent / 100))
        result.append(TrainMovement(train_id=f"WHATIF-WEATHER-{percent}-{i}", train_number="WHAT-IF-WX", train_name="Monsoon Slowdown Occupancy", train_type=source.train_type, section_id=source.section_id, track_id=source.track_id, entry_time=overlap_start, exit_time=min(end, overlap_end + timedelta(minutes=extra)), priority=998, direction=source.direction, is_fixed=True))
    return result
