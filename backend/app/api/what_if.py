from datetime import datetime
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.plan_state_store import get_approved_plan
from app.core.priority_engine import PriorityEngine
from app.core.what_if_engine import SUPPORTED_SCENARIOS, simulate_scenario
from app.core.router import _load_unified_jobs

router = APIRouter(prefix="/api/v1/what-if", tags=["MARS What-If Scenario Analysis"])


class WhatIfScenarioRequest(BaseModel):
    week: int = Field(default=1, ge=1, le=4)
    scenario_type: Literal["TRACK_OUTAGE", "SECTION_OUTAGE", "EMERGENCY_BLOCK"]
    section_id: str = Field(min_length=1, max_length=80)
    track_id: Optional[str] = Field(default=None, min_length=1, max_length=80)
    start_time: datetime
    duration_minutes: int = Field(default=120, ge=15, le=720)


@router.get("/options", response_model=Dict[str, Any])
def get_what_if_options():
    approved = get_approved_plan()
    if not approved:
        return {"scenario_types": sorted(SUPPORTED_SCENARIOS), "sections": [], "baseline_available": False}

    baseline_plan = approved.get("plan") or {}
    candidate_ids = {str(value) for value in baseline_plan.get("weekly_candidate_ids", [])}
    if not candidate_ids:
        for block in baseline_plan.get("scheduled_blocks", []):
            if isinstance(block, dict):
                candidate_ids.update(str(value) for value in block.get("job_ids", []))
        candidate_ids.update(
            str(value.get("job_id"))
            for value in baseline_plan.get("deferred_jobs", [])
            if isinstance(value, dict) and value.get("job_id")
        )

    jobs = [job for job in PriorityEngine.process_job_batch(_load_unified_jobs()) if job.job_id in candidate_ids]
    sections: Dict[str, set[str]] = {}
    for job in jobs:
        sections.setdefault(job.section_id, set()).add(job.track_id)
    return {
        "scenario_types": sorted(SUPPORTED_SCENARIOS),
        "baseline_available": True,
        "planning_week": approved.get("planning_week"),
        "sections": [
            {"section_id": section_id, "track_ids": sorted(track_ids)}
            for section_id, track_ids in sorted(sections.items())
        ],
    }


@router.post("/simulate", response_model=Dict[str, Any])
def run_what_if(request: WhatIfScenarioRequest):
    approved = get_approved_plan()
    if not approved:
        raise HTTPException(status_code=409, detail={"error": "NO_APPROVED_BASELINE", "message": "What-If analysis requires an approved weekly baseline. Generate and approve a weekly plan first."})
    if request.scenario_type in {"TRACK_OUTAGE", "EMERGENCY_BLOCK"} and not request.track_id:
        raise HTTPException(status_code=422, detail={"error": "TRACK_REQUIRED", "message": "A track must be selected for this scenario type."})
    try:
        return simulate_scenario(request.model_dump(), approved)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": "WHAT_IF_SIMULATION_FAILED", "message": "The scenario could not be evaluated by the planning engine.", "reason": str(exc)}) from exc
