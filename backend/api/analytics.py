"""Operational analytics calculated from MARS source and plan data."""

import json
from pathlib import Path

import pandas as pd
from fastapi import APIRouter

from backend.config import ASSETS_FILE, BLOCKS_FILE, CURRENT_PLAN_FILE, OPTIMIZATION_SUMMARY_FILE
from backend.services.job_service import job_service
from backend.services.conflict_service import conflict_service

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def _read(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, keep_default_na=False) if path.exists() else pd.DataFrame()


@router.get("")
def get_analytics():
    """Return metrics derived from the current prototype data, not hard-coded demo values."""
    jobs = job_service.get_all_jobs()
    conflicts = conflict_service.detect_conflicts()
    assets = _read(Path(ASSETS_FILE))
    blocks = _read(Path(BLOCKS_FILE))
    plan = _read(Path(CURRENT_PLAN_FILE))

    total = len(jobs)
    normalized_status = [str(j.get("status", "")).upper().strip() for j in jobs]
    open_requests = sum(s in {"OPEN", "PENDING", "SUBMITTED", "UNDER REVIEW"} for s in normalized_status)
    planned_requests = sum(s in {"PLANNED", "APPROVED", "IN PROGRESS"} for s in normalized_status)
    completed = sum(s == "COMPLETED" for s in normalized_status)
    critical_high = sum(str(j.get("priority", "")).upper() in {"CRITICAL", "HIGH"} for j in jobs)

    workload: dict[str, int] = {}
    for job in jobs:
        dept = str(job.get("department") or "Unknown")
        workload[dept] = workload.get(dept, 0) + 1

    asset_availability = 0.0
    if not assets.empty and "status" in assets.columns:
        asset_availability = round((assets["status"].astype(str).str.upper().eq("OPERATIONAL").sum() / len(assets)) * 100, 2)

    block_utilization = 0.0
    used_blocks = 0
    scheduled_minutes = 0
    total_block_minutes = 0
    if not blocks.empty:
        total_block_minutes = int(pd.to_numeric(blocks.get("duration_min", 0), errors="coerce").fillna(0).sum())
    if not plan.empty and "plan_status" in plan.columns:
        scheduled = plan[plan["plan_status"].astype(str).str.upper().eq("SCHEDULED")]
        used_blocks = int(scheduled.get("block_id", pd.Series(dtype=str)).astype(str).replace("", pd.NA).dropna().nunique())
        scheduled_minutes = int(pd.to_numeric(scheduled.get("duration_min", 0), errors="coerce").fillna(0).sum())
        if total_block_minutes:
            block_utilization = round((scheduled_minutes / total_block_minutes) * 100, 2)

    optimization_score = None
    solver_status = None
    if Path(OPTIMIZATION_SUMMARY_FILE).exists():
        try:
            summary = json.loads(Path(OPTIMIZATION_SUMMARY_FILE).read_text(encoding="utf-8"))
            solver_status = summary.get("solver_status")
            scheduled_jobs = float(summary.get("optimized_scheduled_jobs", 0))
            base_jobs = max(float(total), 1.0)
            conflict_penalty = min(len(conflicts) / base_jobs, 1.0)
            optimization_score = round(max(0.0, (scheduled_jobs / base_jobs) * 100 * (1 - conflict_penalty)), 2)
        except (OSError, ValueError, TypeError):
            pass

    return {"metrics": {
        "total_maintenance_requests": total,
        "open_requests": open_requests,
        "critical_high_requests": critical_high,
        "planned_jobs": planned_requests,
        "completed_jobs": completed,
        "active_conflicts": len(conflicts),
        "asset_availability": asset_availability,
        "block_utilization": block_utilization,
        "used_blocks": used_blocks,
        "total_blocks": len(blocks),
        "available_blocks": int(blocks["status"].astype(str).str.upper().eq("AVAILABLE").sum()) if not blocks.empty and "status" in blocks.columns else 0,
        "optimization_score": optimization_score,
        "solver_status": solver_status,
        "department_workload": workload,
    }}
