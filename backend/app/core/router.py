from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timedelta

from app.models.job import MaintenanceJob
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.adapters.coa_adapter import COAAdapter
from app.core.priority_engine import PriorityEngine
from app.core.monthly_allocator import MonthlyAllocator
from app.core.hardened_weekly_solver import HardenedWeeklyCPSATSolver
from app.core.compliance_validator import RailwayComplianceValidator

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

    monthly_plan = MonthlyAllocator.generate_monthly_plan(scored_jobs)
    monthly_job_ids = _monthly_week_job_ids(monthly_plan, week)

    scored_by_id = {job.job_id: job for job in scored_jobs}
    missing_job_ids = sorted(monthly_job_ids - set(scored_by_id))
    if missing_job_ids:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "MONTHLY_WEEK_JOB_INTEGRITY_FAILURE",
                "message": "Monthly allocation contains job IDs missing from the unified job pool.",
                "planning_week": week,
                "missing_job_ids": missing_job_ids,
            },
        )

    weekly_jobs = [job for job in scored_jobs if job.job_id in monthly_job_ids]
    weekly_job_ids = {job.job_id for job in weekly_jobs}

    if weekly_job_ids != monthly_job_ids:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "MONTHLY_WEEK_HANDOFF_MISMATCH",
                "message": "Weekly CP-SAT candidate set does not exactly match the selected monthly week.",
                "planning_week": week,
                "monthly_candidate_count": len(monthly_job_ids),
                "weekly_candidate_count": len(weekly_job_ids),
                "missing_from_weekly": sorted(monthly_job_ids - weekly_job_ids),
                "unexpected_in_weekly": sorted(weekly_job_ids - monthly_job_ids),
            },
        )

    trains = COAAdapter.fetch_passenger_timetable()
    start_monday = _current_week_monday() + timedelta(weeks=week - 1)

    solver_engine = HardenedWeeklyCPSATSolver(weekly_jobs, trains, start_monday)
    result = solver_engine.solve()

    if result.get("status") in ("OPTIMAL", "FEASIBLE"):
        result["compliance"] = RailwayComplianceValidator(
            jobs=weekly_jobs,
            trains=trains,
            scheduled_blocks=result.get("scheduled_blocks", []),
        ).validate()
    else:
        result["compliance"] = {
            "overall_status": "NOT_EVALUATED",
            "compliance_score": 0.0,
            "hard_rules_passed": 0,
            "hard_rules_total": 8,
            "advisory_count": 0,
            "rules": [],
            "details": "No compliance score is produced because CP-SAT did not return a usable weekly plan.",
        }

    # The base solver historically used W1 in block IDs. Normalize the public
    # API identifier to the actual requested strategic week without touching
    # solver decisions or compliance semantics.
    for index, block in enumerate(result.get("scheduled_blocks", []), start=1):
        block["block_id"] = f"BLK-W{week}-{index:03d}"

    result["planning_week"] = week
    result["monthly_candidate_count"] = len(monthly_job_ids)
    result["weekly_candidate_count"] = len(weekly_jobs)
    result["monthly_plan_month"] = monthly_plan.get("month")
    result["monthly_unallocated_count"] = monthly_plan.get("summary", {}).get("deferred_next_month", 0)
    result["weekly_candidate_ids"] = sorted(weekly_job_ids)
    result["monthly_candidate_ids"] = sorted(monthly_job_ids)
    result["weekly_candidate_lookup_complete"] = True

    return result
