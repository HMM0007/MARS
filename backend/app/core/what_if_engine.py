"""Non-destructive What-If scenario engine for the Planner Dashboard.

The scenario engine reuses the production hardened weekly CP-SAT solver. A
scenario only changes the in-memory train/block occupancy supplied to the
solver; the approved plan store is never written to.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Tuple

from fastapi import HTTPException

from app.adapters.coa_adapter import COAAdapter
from app.core.hardened_weekly_solver import HardenedWeeklyCPSATSolver
from app.core.priority_engine import PriorityEngine
from app.core.router import _current_week_monday, _load_unified_jobs
from app.models.train import TrainMovement


SUPPORTED_SCENARIOS = {"TRACK_OUTAGE", "SECTION_OUTAGE", "EMERGENCY_BLOCK"}


def _job_ids_from_blocks(blocks: Iterable[Dict[str, Any]]) -> set[str]:
    ids: set[str] = set()
    for block in blocks:
        if isinstance(block, dict):
            ids.update(str(value) for value in block.get("job_ids", []))
    return ids


def _index_scheduled(blocks: Iterable[Dict[str, Any]]) -> Dict[str, Tuple[str, str | None]]:
    index: Dict[str, Tuple[str, str | None]] = {}
    for block in blocks:
        if not isinstance(block, dict):
            continue
        block_id = str(block.get("block_id", ""))
        start = block.get("start_time")
        for job_id in block.get("job_ids", []):
            index[str(job_id)] = (block_id, str(start) if start else None)
    return index


def _severity(impact: Dict[str, Any]) -> str:
    score = 0
    score += min(50, impact["jobs_affected"] * 3)
    score += min(30, impact["jobs_deferred"] * 8)
    score += min(20, impact["blocks_affected"] * 4)
    if impact["solver_status"] not in {"FEASIBLE", "OPTIMAL"}:
        return "CRITICAL"
    if score >= 60:
        return "CRITICAL"
    if score >= 35:
        return "HIGH"
    if score >= 15:
        return "MODERATE"
    return "LOW"


def _build_blockers(scenario: Dict[str, Any], tracks: List[str]) -> List[TrainMovement]:
    start = scenario["start_time"]
    end = start + timedelta(minutes=scenario["duration_minutes"])
    blockers: List[TrainMovement] = []
    for index, track_id in enumerate(tracks, start=1):
        blockers.append(
            TrainMovement(
                train_id=f"WHATIF-{index}-{track_id}",
                train_number="WHAT-IF-BLOCK",
                train_name="Scenario Occupancy Window",
                train_type="FREIGHT",
                section_id=scenario["section_id"],
                track_id=track_id,
                entry_time=start,
                exit_time=end,
                priority=999,
                direction="UP",
                is_fixed=True,
            )
        )
    return blockers


def simulate_scenario(scenario: Dict[str, Any], approved: Dict[str, Any]) -> Dict[str, Any]:
    scenario_type = scenario["scenario_type"]
    if scenario_type not in SUPPORTED_SCENARIOS:
        raise HTTPException(status_code=422, detail={"error": "UNSUPPORTED_SCENARIO", "message": "Unsupported What-If scenario type."})

    week = int(scenario["week"])
    baseline_plan = approved.get("plan") or {}
    baseline_week = int(approved.get("planning_week", week))
    if baseline_week != week:
        raise HTTPException(status_code=409, detail={"error": "BASELINE_WEEK_MISMATCH", "message": "The approved baseline belongs to a different planning week.", "requested_week": week, "baseline_week": baseline_week})

    start_monday = _current_week_monday() + timedelta(weeks=week - 1)
    start_time = scenario["start_time"]
    if start_time.tzinfo is not None:
        start_time = start_time.replace(tzinfo=None)
    scenario["start_time"] = start_time
    end_time = start_time + timedelta(minutes=scenario["duration_minutes"])
    if start_time < start_monday or end_time > start_monday + timedelta(days=7):
        raise HTTPException(status_code=422, detail={"error": "SCENARIO_OUTSIDE_WEEK", "message": "Scenario window must remain inside the selected seven-day planning horizon."})

    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    candidate_ids = set(str(value) for value in baseline_plan.get("weekly_candidate_ids", []))
    if not candidate_ids:
        candidate_ids = _job_ids_from_blocks(baseline_plan.get("scheduled_blocks", []))
        candidate_ids.update(str(value.get("job_id")) for value in baseline_plan.get("deferred_jobs", []) if isinstance(value, dict) and value.get("job_id"))
    jobs = [job for job in scored_jobs if job.job_id in candidate_ids]
    if not jobs:
        raise HTTPException(status_code=409, detail={"error": "BASELINE_JOB_POOL_EMPTY", "message": "The approved baseline does not contain a usable weekly candidate set."})

    requested_section = scenario["section_id"]
    matching_tracks = sorted({job.track_id for job in jobs if job.section_id == requested_section})
    if not matching_tracks:
        raise HTTPException(status_code=422, detail={"error": "SECTION_NOT_IN_BASELINE", "message": "Selected section is not present in the approved weekly job pool.", "section_id": requested_section})

    requested_track = scenario.get("track_id")
    if requested_track:
        if requested_track not in matching_tracks:
            raise HTTPException(status_code=422, detail={"error": "TRACK_NOT_IN_SECTION", "message": "Selected track does not belong to the selected section in the weekly job pool."})
        blocker_tracks = [requested_track]
    else:
        blocker_tracks = matching_tracks if scenario_type == "SECTION_OUTAGE" else matching_tracks[:1]

    trains = COAAdapter.fetch_passenger_timetable()
    baseline_blocks = baseline_plan.get("scheduled_blocks", [])
    scenario_trains = list(trains) + _build_blockers({**scenario, "section_id": requested_section}, blocker_tracks)
    result = HardenedWeeklyCPSATSolver(jobs, scenario_trains, start_monday).solve()

    baseline_index = _index_scheduled(baseline_blocks)
    scenario_index = _index_scheduled(result.get("scheduled_blocks", []))
    baseline_ids = set(baseline_index)
    scenario_ids = set(scenario_index)
    affected: set[str] = set(baseline_ids | scenario_ids)
    moved: set[str] = set()
    for job_id in affected:
        if baseline_index.get(job_id) != scenario_index.get(job_id):
            moved.add(job_id)

    deferred_ids = {str(value.get("job_id")) for value in result.get("deferred_jobs", []) if isinstance(value, dict) and value.get("job_id")}
    impacted_ids = sorted(moved | (baseline_ids - scenario_ids) | (scenario_ids - baseline_ids))
    baseline_block_count = len(baseline_blocks)
    scenario_block_count = len(result.get("scheduled_blocks", []))
    impact = {
        "jobs_affected": len(impacted_ids),
        "blocks_affected": abs(scenario_block_count - baseline_block_count) + len(moved),
        "jobs_delayed_or_moved": len(moved),
        "jobs_deferred": len(deferred_ids - baseline_ids),
        "conflicts_introduced": max(0, len(result.get("deferred_jobs", [])) - len(baseline_plan.get("deferred_jobs", []))),
        "baseline_scheduled_jobs": len(baseline_ids),
        "scenario_scheduled_jobs": len(scenario_ids),
        "solver_status": result.get("status", result.get("solver_status", "UNKNOWN")),
    }
    impact["severity"] = _severity(impact)

    details: List[str] = [
        f"{scenario_type.replace('_', ' ').title()} applied to {requested_section}.",
        f"Scenario window: {start_time.isoformat(timespec='minutes')} to {end_time.isoformat(timespec='minutes')}.",
    ]
    if moved:
        details.append(f"{len(moved)} baseline job(s) changed schedule position or scheduling state.")
    if deferred_ids:
        details.append(f"{len(deferred_ids)} job(s) are deferred in the scenario result.")
    if not moved and not deferred_ids:
        details.append("The optimizer found no material change to the approved weekly schedule.")

    return {
        "status": "SIMULATED",
        "baseline_revision": approved.get("revision"),
        "planning_week": week,
        "scenario": {
            **scenario,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "blocked_tracks": blocker_tracks,
        },
        "impact": impact,
        "affected_job_ids": impacted_ids,
        "deferred_job_ids": sorted(deferred_ids),
        "operational_impact": details,
        "scenario_solver": {
            "status": result.get("status", result.get("solver_status", "UNKNOWN")),
            "scheduled_blocks": scenario_block_count,
            "model": "HardenedWeeklyCPSATSolver",
            "non_destructive": True,
        },
    }
