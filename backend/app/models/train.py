from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime

TrainType = Literal["SUPERFAST_EXPRESS", "EXPRESS", "PASSENGER_LOCAL", "MEMU", "FREIGHT"]

class TrainMovement(BaseModel):
    train_id: str
    train_number: str
    train_name: Optional[str] = None
    train_type: TrainType
    section_id: str
    track_id: str
    entry_time: datetime
    exit_time: datetime
    priority: int = 1
    direction: Literal["UP", "DN"] = "UP"
    is_fixed: bool = True

class FreightForecast(BaseModel):
    forecast_id: str
    section_id: str
    date: str
    freight_level: Literal["NORMAL", "HIGH", "SURGE"]
    expected_trains_count: int
    busy_window_start: Optional[datetime] = None
    busy_window_end: Optional[datetime] = None
    confidence: float = 0.8