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
    scenario_type: Literal[
        "TRACK_OUTAGE",
        "SECTION_OUTAGE",
        "EMERGENCY_BLOCK",
        "FREIGHT_SURGE",
        "MONSOON_SLOWDOWN",
    ]
    section_id: str = Field(min_length=1, max_length=80)
    track_id: Optional[str] = Field(default=None, min_length=1, max_length=80)
    start_time: datetime
    duration_minutes: int = Field(default=120, ge=15, le=720)
    impact_percent: Optional[int] = Field(default=None, ge=1, le=100)


@router.get("/options", response_model=Dict[str, Any])
def get_what_if_options():
    approved = get_approved_plan()
    if not approved:
        return {
            "scenario_types": sorted(SUPPORTED_SCENARIOS),
            "sections": [],
            "baseline_available": False,
            "freight_surge_levels": [20, 40],
            "monsoon_slowdown_levels": [10, 20, 30],
        }

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
        "freight_surge_levels": [20, 40],
        "monsoon_slowdown_levels": [10, 20, 30],
    }


@router.post("/simulate", response_model=Dict[str, Any])
def run_what_if(request: WhatIfScenarioRequest):
    approved = get_approved_plan()
    if not approved:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "NO_APPROVED_BASELINE",
                "message": "What-If analysis requires an approved weekly baseline. Generate and approve a weekly plan first.",
            },
        )

    if request.scenario_type in {"TRACK_OUTAGE", "EMERGENCY_BLOCK"} and not request.track_id:
        raise HTTPException(
            status_code=422,
            detail={"error": "TRACK_REQUIRED", "message": "A track must be selected for this scenario type."},
        )
    if request.scenario_type == "FREIGHT_SURGE" and request.impact_percent not in {20, 40}:
        raise HTTPException(
            status_code=422,
            detail={"error": "INVALID_FREIGHT_SURGE", "message": "Freight surge must be 20% or 40%."},
        )
    if request.scenario_type == "MONSOON_SLOWDOWN" and request.impact_percent not in {10, 20, 30}:
        raise HTTPException(
            status_code=422,
            detail={"error": "INVALID_WEATHER_SLOWDOWN", "message": "Monsoon slowdown must be 10%, 20%, or 30%."},
        )

    try:
        return simulate_scenario(request.model_dump(), approved)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "WHAT_IF_SIMULATION_FAILED",
                "message": "The scenario could not be evaluated by the planning engine.",
                "reason": str(exc),
            },
        ) from exc
