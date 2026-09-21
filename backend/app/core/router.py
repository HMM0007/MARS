from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import date, datetime, timedelta

from app.models.job import MaintenanceJob
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.adapters.coa_adapter import COAAdapter
from app.core.priority_engine import PriorityEngine
from app.core.monthly_allocator import MonthlyAllocator
from app.core.forecast_engine import MonthlyForecastEngine
from app.core.hardened_weekly_solver import HardenedWeeklyCPSATSolver
from app.core.incremental_cpsat import IncrementalCPSATSolver
from app.core.compliance_validator import RailwayComplianceValidator
from app.core.plan_state_store import (
    add_intake_job,
    approve_plan,
    clear_pending_revision,
    get_approved_plan,
    get_pending_revision,
    list_approved_plan_history,
    list_intake_jobs,
    save_pending_revision,
)

router = APIRouter(prefix="/api/v1/core", tags=["MARS Core AI Engine"])


class IncrementalPlanRequest(BaseModel):
    week: int = Field(default=1, ge=1, le=4)
    new_job: MaintenanceJob
    existing_plan: Dict[str, Any]


class WeeklyPlanApprovalRequest(BaseModel):
    week: int = Field(default=1, ge=1, le=4)
    plan: Dict[str, Any]
    approved_by: str = Field(default="PLANNER", min_length=1, max_length=120)


class JobIntakeRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=80)
    department: Literal["Engineering", "S&T", "Traction"]
    asset_id: str = Field(min_length=1, max_length=120)
    asset_type: Optional[str] = None
    section_id: str = Field(min_length=1, max_length=80)
    track_id: str = Field(min_length=1, max_length=80)
    location_km: float = Field(ge=0)
    defect_type: str = Field(min_length=1, max_length=160)
    estimated_duration_hours: float = Field(gt=0, le=24)
    criticality_level: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    due_date: date
    preferred_window: Literal["NIGHT", "DAY", "ANY"] = "ANY"
    machine_required: Optional[str] = None
    dependency_job_id: Optional[str] = None
    safety_conflict_tag: Optional[str] = "NORMAL"
    power_block_required: bool = False
    work_type: Optional[str] = None
    planning_week: int = Field(default=1, ge=1, le=4)


class EmergencyJobIntakeRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=80)
    department: Literal["Engineering", "S&T", "Traction"]
    asset_id: str = Field(min_length=1, max_length=120)
    asset_type: Optional[str] = None
    section_id: str = Field(min_length=1, max_length=80)
    track_id: str = Field(min_length=1, max_length=80)
    location_km: float = Field(ge=0)
    defect_type: str = Field(min_length=1, max_length=160)
    emergency_reason: str = Field(min_length=3, max_length=240)
    estimated_duration_hours: float = Field(gt=0, le=24)
    due_date: date
    preferred_window: Literal["NIGHT", "DAY", "ANY"] = "ANY"
    machine_required: Optional[str] = None
    dependency_job_id: Optional[str] = None
    safety_conflict_tag: Optional[str] = "NORMAL"
    power_block_required: bool = False
    train_operation_impact: bool = False
    planning_week: int = Field(default=1, ge=1, le=4)


def _load_unified_jobs() -> List[MaintenanceJob]:
    source_jobs = TMSAdapter.fetch_engineering_jobs() + SMMSAdapter.fetch_snt_jobs() + TDMSAdapter.fetch_traction_jobs()
    runtime_jobs = [MaintenanceJob(**item) for item in list_intake_jobs()]
    by_id = {job.job_id: job for job in source_jobs}
    for job in runtime_jobs:
        by_id[job.job_id] = job
    return list(by_id.values())


def _current_week_monday() -> datetime:
    # MARS September 2026 planning horizon Week 1 starts on Monday 2026-09-07
    # Exactly matches the COA train timetable in trains.json (07 Sept - 13 Sept)
    return datetime(2026, 9, 7, 0, 0, 0)


def _monthly_week_job_ids(monthly_plan: Dict[str, Any], week: int) -> set[str]:
    week_key = f"week_{week}"
    job_ids: set[str] = set()
    for section in monthly_plan.get("section_allocations", {}).values():
        weekly_breakdown = section.get("weekly_breakdown", {})
        job_ids.update(weekly_breakdown.get(week_key, {}).get("job_ids", []))
    return job_ids


@router.get("/jobs/all-scored", response_model=List[MaintenanceJob])
def get_all_scored_jobs():
    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    approved = get_approved_plan()
    if approved and isinstance(approved.get("plan"), dict):
        blocks = approved["plan"].get("scheduled_blocks") or approved["plan"].get("blocks") or []
        scheduled_ids = {jid for b in blocks if isinstance(b, dict) for jid in b.get("job_ids", [])}
        deferred_ids = set(approved["plan"].get("deferred_jobs") or [])
        for job in scored_jobs:
            if job.status != "COMPLETED":
                if job.job_id in scheduled_ids:
                    job.status = "SCHEDULED"
                elif job.job_id in deferred_ids:
                    job.status = "DEFERRED"
                else:
                    job.status = "PENDING"
    return scored_jobs


@router.get("/jobs/intake", response_model=List[MaintenanceJob])
def get_intake_jobs():
    return [MaintenanceJob(**item) for item in list_intake_jobs()]


def _submit_intake_job(request: JobIntakeRequest, *, emergency: bool = False, emergency_reason: Optional[str] = None, train_operation_impact: bool = False):
    existing_ids = {job.job_id for job in _load_unified_jobs()}
    if request.job_id in existing_ids:
        raise HTTPException(status_code=409, detail={"error": "DUPLICATE_JOB_ID", "message": "Job ID already exists.", "job_id": request.job_id})

    machine_value = request.machine_required
    if machine_value == "YES":
        machine_value = "DEPARTMENT_MACHINE"
    elif machine_value == "NO":
        machine_value = None

    job = MaintenanceJob(
        job_id=request.job_id,
        department=request.department,
        asset_id=request.asset_id,
        asset_type=request.asset_type,
        section_id=request.section_id,
        track_id=request.track_id,
        location_km=request.location_km,
        defect_type=request.defect_type,
        criticality_level="CRITICAL" if emergency else request.criticality_level,
        estimated_duration_hours=request.estimated_duration_hours,
        due_date=request.due_date,
        preferred_window=request.preferred_window,
        machine_required=machine_value,
        power_block_required=request.power_block_required or request.safety_conflict_tag == "OHE_ISOLATION",
        dependency_job_id=request.dependency_job_id,
        work_type="EMERGENCY_MAINTENANCE" if emergency else (request.work_type or "DEPARTMENT_MAINTENANCE"),
        safety_conflict_tag=request.safety_conflict_tag,
        created_date=date.today(),
        status="PENDING",
    )
    scored_job = PriorityEngine.score_job(job)
    approved = get_approved_plan()

    if not approved:
        add_intake_job(scored_job.model_dump(mode="json"))
        return {
            "status": "EMERGENCY_INTAKE_ONLY" if emergency else "INTAKE_ONLY",
            "message": "Emergency job accepted into the Unified Job Pool. No approved weekly baseline exists yet, so no incremental repair was required." if emergency else "Job accepted into the Unified Job Pool. No approved weekly baseline exists yet, so no incremental repair was required.",
            "job": scored_job,
            "emergency": emergency,
            "emergency_reason": emergency_reason,
            "train_operation_impact": train_operation_impact,
        }

    baseline_week = int(approved.get("planning_week", request.planning_week))
    try:
        repair = get_incremental_weekly_plan(IncrementalPlanRequest(week=baseline_week, new_job=scored_job, existing_plan=approved.get("plan", {})))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "INCREMENTAL_REPAIR_FAILED", "message": "The job was not committed because the incremental repair could not be evaluated.", "job_id": job.job_id, "reason": str(exc)}) from exc

    add_intake_job(scored_job.model_dump(mode="json"))
    if repair.get("status") in ("FEASIBLE", "OPTIMAL"):
        pending = save_pending_revision(repair, baseline_week, approved.get("revision"), job.job_id)
    else:
        pending = None

    return {
        "status": "EMERGENCY_REPAIR_PROPOSED" if emergency else "REPAIR_PROPOSED",
        "message": "Emergency job accepted and an incremental revision proposal was generated from the approved weekly baseline." if emergency else "Job accepted and an incremental revision proposal was generated from the approved weekly baseline.",
        "job": scored_job,
        "baseline_revision": approved.get("revision"),
        "proposal": repair,
        "pending_revision": pending,
        "requires_planner_approval": pending is not None,
        "emergency": emergency,
        "emergency_reason": emergency_reason,
        "train_operation_impact": train_operation_impact,
    }


@router.post("/jobs/intake", response_model=Dict[str, Any])
def submit_job_intake(request: JobIntakeRequest):
    return _submit_intake_job(request)


@router.post("/jobs/emergency", response_model=Dict[str, Any])
def submit_emergency_job(request: EmergencyJobIntakeRequest):
    intake = JobIntakeRequest(
        job_id=request.job_id,
        department=request.department,
        asset_id=request.asset_id,
        asset_type=request.asset_type,
        section_id=request.section_id,
        track_id=request.track_id,
        location_km=request.location_km,
        defect_type=request.defect_type,
        criticality_level="CRITICAL",
        due_date=request.due_date,
        preferred_window=request.preferred_window,
        machine_required=request.machine_required,
        dependency_job_id=request.dependency_job_id,
        safety_conflict_tag=request.safety_conflict_tag,
        power_block_required=request.power_block_required,
        work_type="EMERGENCY_MAINTENANCE",
        planning_week=request.planning_week,
        estimated_duration_hours=request.estimated_duration_hours,
    )
    return _submit_intake_job(request=intake, emergency=True, emergency_reason=request.emergency_reason, train_operation_impact=request.train_operation_impact)


@router.get("/plan/weekly/approved", response_model=Dict[str, Any])
def get_approved_weekly_plan():
    record = get_approved_plan()
    if not record:
        return {"approved": False, "plan": None}
    return {"approved": True, **record}


@router.get("/plan/weekly/approved-history", response_model=List[Dict[str, Any]])
def get_approved_weekly_plan_history():
    return list_approved_plan_history()


@router.get("/plan/weekly/pending-revision", response_model=Dict[str, Any])
def get_pending_weekly_revision():
    record = get_pending_revision()
    if not record:
        return {"pending": False, "revision": None}
    return {"pending": True, "revision": record}


@router.post("/plan/weekly/approve", response_model=Dict[str, Any])
def approve_weekly_plan(request: WeeklyPlanApprovalRequest):
    status = request.plan.get("status") or request.plan.get("solver_status")
    if status not in ("OPTIMAL", "FEASIBLE"):
        raise HTTPException(status_code=409, detail={"error": "PLAN_NOT_APPROVABLE", "message": "Only a FEASIBLE or OPTIMAL solver result can be approved."})
    blocks = request.plan.get("scheduled_blocks", request.plan.get("blocks", []))
    if not isinstance(blocks, list):
        raise HTTPException(status_code=422, detail={"error": "INVALID_PLAN_BLOCKS", "message": "Approved plan must contain a block list."})
    result = approve_plan(request.plan, request.week, request.approved_by)
    clear_pending_revision()
    return {"approved": True, **result}


@router.get("/forecast/monthly", response_model=Dict[str, Any])
def get_monthly_demand_forecast(
    months: int = Query(1, ge=1, le=12, description="Number of future calendar months to forecast"),
    history: int = Query(18, ge=6, le=60, description="Historical monthly observations used by Prophet"),
):
    return MonthlyForecastEngine.forecast(_load_unified_jobs(), forecast_months=months, history_months=history)


@router.get("/plan/monthly", response_model=Dict[str, Any])
def get_monthly_strategic_plan():
    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    return MonthlyAllocator.generate_monthly_plan(scored_jobs)


@router.get("/plan/weekly", response_model=Dict[str, Any])
def get_weekly_tactical_plan(
    week: int = Query(1, ge=1, le=4, description="Monthly planning week (1-4)"),
    fresh: bool = Query(False, description="Bypass an approved baseline and generate a fresh candidate plan."),
):
    approved = get_approved_plan()
    if not fresh and approved and int(approved.get("planning_week", 0)) == week:
        approved_plan = approved.get("plan")
        if isinstance(approved_plan, dict):
            return {
                **approved_plan,
                "planning_week": week,
                "baseline_governance": {
                    "mode": "APPROVED_BASELINE",
                    "revision": approved.get("revision"),
                    "approved_at": approved.get("approved_at"),
                    "approved_by": approved.get("approved_by"),
                    "requires_explicit_fresh_request": True,
                },
            }

    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    monthly_plan = MonthlyAllocator.generate_monthly_plan(scored_jobs)
    monthly_job_ids = _monthly_week_job_ids(monthly_plan, week)
    scored_by_id = {job.job_id: job for job in scored_jobs}
    missing_job_ids = sorted(monthly_job_ids - set(scored_by_id))
    if missing_job_ids:
        raise HTTPException(status_code=409, detail={"error": "MONTHLY_WEEK_JOB_INTEGRITY_FAILURE", "message": "Monthly allocation contains job IDs missing from the unified job pool.", "planning_week": week, "missing_job_ids": missing_job_ids})
    weekly_jobs = [job for job in scored_jobs if job.job_id in monthly_job_ids]
    weekly_job_ids = {job.job_id for job in weekly_jobs}
    if weekly_job_ids != monthly_job_ids:
        raise HTTPException(status_code=500, detail={"error": "MONTHLY_WEEK_HANDOFF_MISMATCH", "message": "Weekly CP-SAT candidate set does not exactly match the selected monthly week.", "planning_week": week, "monthly_candidate_count": len(monthly_job_ids), "weekly_candidate_count": len(weekly_job_ids), "missing_from_weekly": sorted(monthly_job_ids - weekly_job_ids), "unexpected_in_weekly": sorted(weekly_job_ids - monthly_job_ids)})
    trains = COAAdapter.fetch_passenger_timetable()
    start_monday = _current_week_monday() + timedelta(weeks=week - 1)
    result = HardenedWeeklyCPSATSolver(weekly_jobs, trains, start_monday).solve()
    if result.get("status") in ("OPTIMAL", "FEASIBLE"):
        result["compliance"] = RailwayComplianceValidator(jobs=weekly_jobs, trains=trains, scheduled_blocks=result.get("scheduled_blocks", [])).validate()
    else:
        result["compliance"] = {"overall_status": "NOT_EVALUATED", "compliance_score": 0.0, "hard_rules_passed": 0, "hard_rules_total": 8, "advisory_count": 0, "rules": [], "details": "No compliance score is produced because CP-SAT did not return a usable weekly plan."}
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
    result["baseline_governance"] = {
        "mode": "FRESH_CANDIDATE",
        "requires_planner_approval": True,
        "reason": "No matching approved baseline was used, or an explicit fresh request was made.",
    }
    return result


@router.post("/plan/incremental", response_model=Dict[str, Any])
def get_incremental_weekly_plan(request: IncrementalPlanRequest):
    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    existing_ids = {job.job_id for job in scored_jobs}
    if request.new_job.job_id in existing_ids:
        raise HTTPException(status_code=409, detail={"error": "DUPLICATE_JOB_ID", "message": "The incremental job ID already exists in the unified job pool.", "job_id": request.new_job.job_id})
    new_job = PriorityEngine.score_job(request.new_job)
    all_jobs = scored_jobs + [new_job]
    existing_plan_ids = {job_id for block in request.existing_plan.get("scheduled_blocks", []) if isinstance(block, dict) for job_id in block.get("job_ids", [])}
    unknown_plan_ids = sorted(existing_plan_ids - existing_ids)
    if unknown_plan_ids:
        raise HTTPException(status_code=409, detail={"error": "EXISTING_PLAN_JOB_INTEGRITY_FAILURE", "message": "The supplied plan contains job IDs that are not in the current unified pool.", "unknown_job_ids": unknown_plan_ids})
    trains = COAAdapter.fetch_passenger_timetable()
    start_monday = _current_week_monday() + timedelta(weeks=request.week - 1)
    result = IncrementalCPSATSolver(jobs=all_jobs, trains=trains, start_monday=start_monday, existing_plan=request.existing_plan, new_job_id=new_job.job_id).solve()
    if result.get("status") in ("OPTIMAL", "FEASIBLE"):
        result["compliance"] = RailwayComplianceValidator(jobs=all_jobs, trains=trains, scheduled_blocks=result.get("scheduled_blocks", [])).validate()
    else:
        result["compliance"] = {"overall_status": "NOT_EVALUATED", "compliance_score": 0.0, "hard_rules_passed": 0, "hard_rules_total": 8, "advisory_count": 0, "rules": [], "details": "No compliance score is produced because incremental CP-SAT did not return a usable repaired plan."}
    for index, block in enumerate(result.get("scheduled_blocks", []), start=1):
        block["block_id"] = f"BLK-W{request.week}-{index:03d}"
    result["planning_week"] = request.week
    result["incremental"]["new_job_priority_score"] = new_job.ai_priority_score
    return result
