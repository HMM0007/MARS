from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.adapters.coa_adapter import COAAdapter
from app.core import router as core_router
from app.core.incremental_cpsat import IncrementalCPSATSolver
from app.core.plan_state_store import add_intake_job, get_approved_plan, save_pending_revision
from app.core.priority_engine import PriorityEngine
from app.models.job import MaintenanceJob

router = APIRouter(prefix="/api/v1/core", tags=["MARS Emergency Operations"])


@router.post("/jobs/emergency", response_model=Dict[str, Any])
def submit_emergency_job_hardened(request: core_router.EmergencyJobIntakeRequest):
    """Durable emergency intake with explicit repair outcome and metadata.

    This route is registered before the legacy emergency route. It keeps the
    approved baseline protected, runs the existing incremental CP-SAT engine,
    and persists emergency metadata with the job so it survives restart.
    """
    existing_ids = {job.job_id for job in core_router._load_unified_jobs()}
    if request.job_id in existing_ids:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "DUPLICATE_JOB_ID",
                "message": "Job ID already exists.",
                "job_id": request.job_id,
            },
        )

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
        criticality_level="CRITICAL",
        estimated_duration_hours=request.estimated_duration_hours,
        due_date=request.due_date,
        preferred_window=request.preferred_window,
        machine_required=machine_value,
        power_block_required=request.power_block_required or request.safety_conflict_tag == "OHE_ISOLATION",
        dependency_job_id=request.dependency_job_id,
        work_type="EMERGENCY_MAINTENANCE",
        safety_conflict_tag=request.safety_conflict_tag,
        created_date=__import__("datetime").date.today(),
        status="PENDING",
        emergency_reason=request.emergency_reason,
        train_operation_impact=request.train_operation_impact,
    )
    scored_job = PriorityEngine.score_job(job)
    approved = get_approved_plan()

    if not approved:
        add_intake_job(scored_job.model_dump(mode="json"))
        return {
            "status": "EMERGENCY_INTAKE_ONLY",
            "job_id": scored_job.job_id,
            "repair_status": "NOT_EVALUATED",
            "scheduled_new_job": False,
            "pending_revision": False,
            "baseline_revision": None,
            "requires_planner_approval": False,
            "message": "Emergency accepted into the Unified Job Pool. No approved weekly baseline exists, so incremental repair was not required.",
            "job": scored_job,
            "emergency_reason": request.emergency_reason,
            "train_operation_impact": request.train_operation_impact,
        }

    baseline_week = int(approved.get("planning_week", request.planning_week))
    try:
        trains = COAAdapter.fetch_passenger_timetable()
        start_monday = core_router._current_week_monday() + timedelta(weeks=baseline_week - 1)
        all_jobs = PriorityEngine.process_job_batch(core_router._load_unified_jobs() + [scored_job])
        repair = IncrementalCPSATSolver(
            all_jobs,
            trains,
            start_monday,
            approved.get("plan", {}),
            scored_job.job_id,
        ).solve()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "INCREMENTAL_REPAIR_FAILED",
                "message": "Emergency job was not committed because incremental repair could not be evaluated.",
                "job_id": scored_job.job_id,
                "reason": str(exc),
            },
        ) from exc

    repair_status = repair.get("status") or repair.get("solver_status") or "UNKNOWN"
    usable = repair_status in ("FEASIBLE", "OPTIMAL")

    add_intake_job(scored_job.model_dump(mode="json"))

    pending = None
    compliance = {"overall_status": "NOT_EVALUATED", "compliance_score": 0.0}
    if usable:
        scheduled_blocks = repair.get("scheduled_blocks", [])
        compliance = core_router.RailwayComplianceValidator(
            jobs=all_jobs,
            trains=trains,
            scheduled_blocks=scheduled_blocks,
        ).validate()
        pending = save_pending_revision(
            repair,
            baseline_week,
            approved.get("revision"),
            scored_job.job_id,
        )

    scheduled_ids = {
        job_id
        for block in repair.get("scheduled_blocks", [])
        for job_id in block.get("job_ids", [])
    }

    return {
        "status": "EMERGENCY_REPAIR_PROPOSED" if usable else "EMERGENCY_REPAIR_UNAVAILABLE",
        "job_id": scored_job.job_id,
        "repair_status": repair_status,
        "scheduled_new_job": scored_job.job_id in scheduled_ids,
        "pending_revision": pending is not None,
        "baseline_revision": approved.get("revision"),
        "requires_planner_approval": pending is not None,
        "message": (
            "Emergency accepted and an incremental revision proposal was generated from the approved weekly baseline. Planner approval is required before BDMS publication."
            if usable
            else "Emergency accepted into the Unified Job Pool, but incremental repair did not produce a usable plan. The approved baseline remains unchanged and the emergency requires planner review."
        ),
        "job": scored_job,
        "proposal": repair,
        "compliance": compliance,
        "emergency_reason": request.emergency_reason,
        "train_operation_impact": request.train_operation_impact,
    }
