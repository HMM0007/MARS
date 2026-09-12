from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date

CriticalityLevel = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
Department = Literal["Engineering", "S&T", "Traction"]
JobStatus = Literal["PENDING", "SCHEDULED", "DEFERRED", "COMPLETED"]
PreferredWindow = Literal["NIGHT", "DAY", "ANY"]

class MaintenanceJob(BaseModel):
    job_id: str
    department: Department
    asset_id: str
    asset_type: Optional[str] = None
    section_id: str
    track_id: str
    location_km: float
    defect_type: str
    criticality_level: CriticalityLevel
    estimated_duration_hours: float = Field(gt=0)
    due_date: date
    preferred_window: PreferredWindow = "ANY"
    machine_required: Optional[str] = None
    power_block_required: bool = False
    dependency_job_id: Optional[str] = None
    work_type: Optional[str] = None
    safety_conflict_tag: Optional[str] = "NORMAL"
    created_date: date
    status: JobStatus = "PENDING"

    # Emergency audit metadata. Optional for normal jobs and persisted for
    # department-reported emergencies so the operational context survives restart.
    emergency_reason: Optional[str] = None
    train_operation_impact: bool = False

    # AI computed fields (filled later)
    base_priority_score: Optional[int] = None
    ai_priority_score: Optional[float] = None
    deferral_count: int = 0
