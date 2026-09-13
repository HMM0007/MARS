from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.plan_state_store import get_approved_plan
from app.core.priority_engine import PriorityEngine
from app.core.what_if_engine import SUPPORTED_SCENARIOS, simulate_scenario
from app.core.router import _load_unified_jobs

router = APIRouter(prefix="/api/v1/what-if", tags=["MARS What-If Scenario Analysis"])


class WhatIfScenarioRequest(BaseModel):
    week: int = Field(default=1, ge=1, le=4)
    scenario_type: Literal["TRACK_OUTAGE", "SECTION_OUTAGE", "EMERGENCY_BLOCK", "FREIGHT_SURGE", "MONSOON_SLOWDOWN"]
    section_id: str = Field(min_length=1, max_length=80)
    track_id: Optional[str] = Field(default=None, min_length=1, max_length=80)
    start_time: datetime
    duration_minutes: int = Field(default=120, ge=15, le=720)
    impact_percent: Optional[int] = Field(default=None, ge=1, le=100)


@router.get("/options", response_model=Dict[str, Any])
def get_what_if_options():
    approved = get_approved_plan()
    if not approved:
        return {"scenario_types": sorted(SUPPORTED_SCENARIOS), "sections": [], "baseline_available": False}
    baseline_plan = approved.get("plan") or {}
    candidate_ids = {str(v) for v in baseline_plan.get("weekly_candidate_ids", [])}
    if not candidate_ids:
        for block in baseline_plan.get("scheduled_blocks", []):
            if isinstance(block, dict):
                candidate_ids.update(str(v) for v in block.get("job_ids", []))
        candidate_ids.update(str(v.get("job_id")) for v in baseline_plan.get("deferred_jobs", []) if isinstance(v, dict) and v.get("job_id"))
    jobs = [job for job in PriorityEngine.process_job_batch(_load_unified_jobs()) if job.job_id in candidate_ids]
    sections: Dict[str, set[str]] = {}
    for job in jobs:
        sections.setdefault(job.section_id, set()).add(job.track_id)

    # Realistic Railway Scenario Presets
    presets = [
        {
            "id": "BHOR_GHAT_MONSOON",
            "name": "Bhor Ghat Torrential Rain (LNL-KJT)",
            "description": "Heavy monsoon weather on the ghat section causing severe speed restrictions and train headway inflation.",
            "scenario_type": "MONSOON_SLOWDOWN",
            "section_id": "LNL-KJT",
            "track_id": "LNL-KJT-UP",
            "impact_percent": 35,
            "start_time": "2026-09-08T11:00:00",
            "duration_minutes": 180,
            "badge": "Weather Stress",
            "icon": "CloudRain",
        },
        {
            "id": "EMERGENCY_RAIL_FRACTURE",
            "name": "Emergency Rail Fracture (PUNE-LNL Up)",
            "description": "Sudden welded joint fracture during morning hours requiring immediate track closure and emergency clamping.",
            "scenario_type": "EMERGENCY_BLOCK",
            "section_id": "PUNE-LNL",
            "track_id": "PUNE-LNL-UP",
            "impact_percent": None,
            "start_time": "2026-09-08T07:30:00",
            "duration_minutes": 150,
            "badge": "Track Hazard",
            "icon": "AlertTriangle",
        },
        {
            "id": "FREIGHT_CORRIDOR_SURGE",
            "name": "Automobile / Freight Loading Surge (PUNE-DD)",
            "description": "High-priority goods traffic spike injecting additional freight paths across the Daund corridor.",
            "scenario_type": "FREIGHT_SURGE",
            "section_id": "PUNE-DD",
            "track_id": "PUNE-DD-DN",
            "impact_percent": 30,
            "start_time": "2026-09-09T14:00:00",
            "duration_minutes": 180,
            "badge": "Goods Traffic Spike",
            "icon": "Truck",
        },
        {
            "id": "INTERLOCKING_SHUTDOWN",
            "name": "CWD Yard Outage (Mon Morning)",
            "description": "Down line track closure during Monday morning shift forcing ballast screening work to reschedule to Friday.",
            "scenario_type": "TRACK_OUTAGE",
            "section_id": "CWD-YARD",
            "track_id": "CWD-YARD-DN",
            "impact_percent": None,
            "start_time": "2026-09-07T04:30:00",
            "duration_minutes": 270,
            "badge": "Track Outage",
            "icon": "SlidersHorizontal",
        },
    ]

    return {
        "scenario_types": sorted(SUPPORTED_SCENARIOS),
        "baseline_available": True,
        "planning_week": approved.get("planning_week", 1),
        "planning_horizon": {
            "start": "2026-09-07T00:00:00",
            "end": "2026-09-13T23:59:59",
            "week": approved.get("planning_week", 1),
            "label": "Mon 07 Sept — Sun 13 Sept 2026",
        },
        "presets": presets,
        "sections": [{"section_id": s, "track_ids": sorted(t)} for s, t in sorted(sections.items())],
    }


class PromoteScenarioRequest(BaseModel):
    week: int = Field(default=1, ge=1, le=4)
    scenario_type: str
    scenario_name: str
    simulated_blocks: List[Dict[str, Any]]
    deferred_job_ids: Optional[List[str]] = Field(default_factory=list)
    reason: Optional[str] = "What-If Scenario contingency promoted to candidate"


@router.post("/promote-candidate", response_model=Dict[str, Any])
def promote_scenario_to_candidate(request: PromoteScenarioRequest):
    approved = get_approved_plan()
    if not approved:
        raise HTTPException(status_code=409, detail={"error": "NO_APPROVED_BASELINE", "message": "An approved weekly baseline is required."})
    
    from app.core.plan_state_store import save_pending_revision
    candidate_plan = {
        "status": "OPTIMAL",
        "solver_status": "OPTIMAL",
        "planning_week": request.week,
        "scheduled_blocks": request.simulated_blocks,
        "blocks": request.simulated_blocks,
        "deferred_jobs": request.deferred_job_ids or [],
        "contingency_source": f"WHATIF_{request.scenario_type}",
        "scenario_name": request.scenario_name,
        "contingency_reason": request.reason,
    }
    pending = save_pending_revision(
        plan=candidate_plan,
        week=request.week,
        source_revision=approved.get("revision"),
        job_id=f"WHATIF-{request.scenario_type}",
    )
    return {
        "promoted": True,
        "message": "Scenario successfully promoted as a pending contingency plan. Review and sanction on the Command Center.",
        "pending_revision": pending,
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
