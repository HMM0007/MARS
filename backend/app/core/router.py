from fastapi import APIRouter, Query
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


def _monthly_week_job_ids(monthly_plan: Dict[str, Any], week: int) -> set[str]:
    """Extract job IDs allocated to one of the four strategic planning weeks."""
    week_key = f"week_{week}"
    job_ids: set[str] = set()

    for section in monthly_plan.get("section_allocations", {}).values():
        weekly_breakdown = section.get("weekly_breakdown", {})
        job_ids.update(weekly_breakdown.get(week_key, {}).get("job_ids", []))

    return job_ids


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
def get_weekly_tactical_plan(
    week: int = Query(1, ge=1, le=4, description="Monthly planning week (1-4)"),
):
    """Generate the Level 2 CP-SAT plan for jobs allocated to the requested monthly week."""
    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())

    # Level 1 must precede Level 2: only jobs allocated to the requested
    # strategic week are eligible for tactical CP-SAT planning.
    monthly_plan = MonthlyAllocator.generate_monthly_plan(scored_jobs)
    monthly_job_ids = _monthly_week_job_ids(monthly_plan, week)

    scored_by_id = {job.job_id: job for job in scored_jobs}
    weekly_jobs = [job for job in scored_jobs if job.job_id in monthly_job_ids]

    trains = COAAdapter.fetch_passenger_timetable()
    start_monday = _current_week_monday() + timedelta(weeks=week - 1)

    solver_engine = WeeklyCPSATSolver(weekly_jobs, trains, start_monday)
    result = solver_engine.solve()

    # Keep solver output intact while exposing the strategic-to-tactical
    # linkage for the dashboard and audit trail.
    result["planning_week"] = week
    result["monthly_candidate_count"] = len(monthly_job_ids)
    result["weekly_candidate_count"] = len(weekly_jobs)
    result["monthly_plan_month"] = monthly_plan.get("month")
    result["monthly_unallocated_count"] = monthly_plan.get("summary", {}).get("deferred_next_month", 0)

    # Defensive consistency check: every solver input must have come from the
    # selected monthly week. This catches future regressions in this endpoint.
    result["weekly_candidate_ids"] = [job.job_id for job in weekly_jobs]
    result["monthly_candidate_ids"] = sorted(monthly_job_ids)
    result["weekly_candidate_lookup_complete"] = all(
        job_id in scored_by_id for job_id in monthly_job_ids
    )

    return result
