from fastapi import APIRouter
from typing import List, Dict, Any
from datetime import datetime, timedelta

from app.models.job import MaintenanceJob
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.adapters.coa_adapter import COAAdapter
from app.core.priority_engine import PriorityEngine
from app.core.monthly_allocator import MonthlyAllocator
from app.core.weekly_solver import WeeklyCPSATSolver

router = APIRouter(prefix="/api/v1/core", tags=["MARS Core AI Engine"])


def _load_unified_jobs() -> List[MaintenanceJob]:
    """Ingest all three maintenance departments into one unified job pool."""
    return (
        TMSAdapter.fetch_engineering_jobs()
        + SMMSAdapter.fetch_snt_jobs()
        + TDMSAdapter.fetch_traction_jobs()
    )


def _current_week_monday() -> datetime:
    """Return Monday 00:00 for the current planning week."""
    now = datetime.now()
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/jobs/all-scored", response_model=List[MaintenanceJob])
def get_all_scored_jobs():
    """Ingest and score the complete unified Engineering/S&T/Traction job pool."""
    return PriorityEngine.process_job_batch(_load_unified_jobs())


@router.get("/plan/monthly", response_model=Dict[str, Any])
def get_monthly_strategic_plan():
    """Generate the Level 1 four-week strategic workload allocation."""
    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    return MonthlyAllocator.generate_monthly_plan(scored_jobs)


@router.get("/plan/weekly", response_model=Dict[str, Any])
def get_weekly_tactical_plan():
    """Generate the Level 2 unified CP-SAT plan for the current planning week."""
    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    trains = COAAdapter.fetch_passenger_timetable()
    start_monday = _current_week_monday()

    # Do not truncate the unified pool. CP-SAT is the tactical optimizer for
    # all eligible jobs; the solver itself decides what can be scheduled.
    solver_engine = WeeklyCPSATSolver(scored_jobs, trains, start_monday)
    return solver_engine.solve()
