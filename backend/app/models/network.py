from pydantic import BaseModel
from typing import Optional

class Section(BaseModel):
    section_id: str
    section_name: str
    from_station: str
    to_station: str
    zone: str = "CR"
    division: str = "Pune"
    length_km: float
    num_tracks: int = 2
    traffic_density: str = "HIGH"

class Station(BaseModel):
    station_id: str
    station_name: str
    station_code: str
    section_id: str
    location_km: float
    lat: Optional[float] = None
    lon: Optional[float] = None

class Track(BaseModel):
    track_id: str
    section_id: str
    track_name: str
    is_electrified: bool = True