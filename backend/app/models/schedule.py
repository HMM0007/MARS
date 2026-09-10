from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ScheduledBlock(BaseModel):
    block_id: str
    section_id: str
    track_id: str
    start_time: datetime
    end_time: datetime
    job_ids: List[str]
    departments: List[str]
    is_consolidated: bool = False
    tsr_profile: Optional[str] = None
    explanation: Optional[str] = None

class WeeklyPlan(BaseModel):
    week_id: str
    division: str
    blocks: List[ScheduledBlock]
    total_jobs_scheduled: int
    total_jobs_deferred: int
    conflicts: int = 0
    consolidation_count: int = 0