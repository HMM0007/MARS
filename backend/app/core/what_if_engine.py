"""Non-destructive What-If scenario engine for the Planner Dashboard.

All scenario changes are kept in memory and evaluated by the production weekly
CP-SAT solver. The approved plan store is never modified.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, Iterable, List, Tuple

from fastapi import HTTPException

from app.adapters.coa_adapter import COAAdapter
from app.core.hardened_weekly_solver import HardenedWeeklyCPSATSolver
from app.core.priority_engine import PriorityEngine
from app.core.router import _current_week_monday, _load_unified_jobs
from app.models.train import TrainMovement

SUPPORTED_SCENARIOS = {
    "TRACK_OUTAGE",
    "SECTION_OUTAGE",
    "EMERGENCY_BLOCK",
    "FREIGHT_SURGE",
    "MONSOON_SLOWDOWN",
}


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
    score = min(50, impact["jobs_affected"] * 3)
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


def _scenario_window(scenario: Dict[str, Any]):
    start = scenario["start_time"]
    end = start + timedelta(minutes=scenario["duration_minutes"])
    return start, end


def _build_blockers(scenario: Dict[str, Any], tracks: List[str]) -> List[TrainMovement]:
    start, end = _scenario_window(scenario)
    return [
        TrainMovement(
            train_id=f"WHATIF-BLOCK-{index}-{track_id}",
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
        for index, track_id in enumerate(tracks, start=1)
    ]


def _build_freight_surge(trains: List[TrainMovement], scenario: Dict[str, Any], percent: int) -> List[TrainMovement]:
    if percent not in {20, 40}:
        raise HTTPException(status_code=422, detail={"error": "INVALID_FREIGHT_SURGE", "message": "Freight surge must be 20% or 40%."})
    start, end = _scenario_window(scenario)
    freight = [train for train in trains if getattr(train, "train_type", "") == "FREIGHT"]
    if not freight:
        raise HTTPException(status_code=422, detail={"error": "NO_FREIGHT_BASELINE", "message": "No freight movements are available in the timetable for the selected scenario."})

    # Use the existing freight timetable movements as the baseline demand shape;
    # the added paths are synthetic in-memory demand stress, never source-data edits.
    count = max(1, round(len(freight) * percent / 100))
    additions: List[TrainMovement] = []
    for index, source in enumerate(freight[:count], start=1):
        span = max(15, int((source.exit_time - source.entry_time).total_seconds() // 60))
        entry = max(source.entry_time, start)
        if entry >= end:
            continue
        exit_time = min(end, entry + timedelta(minutes=span))
        additions.append(
            TrainMovement(
                train_id=f"WHATIF-FREIGHT-{percent}-{index}",
                train_number="WHAT-IF-FRT",
                train_name="Freight Demand Surge",
                train_type="FREIGHT",
                section_id=source.section_id,
                track_id=source.track_id,
                entry_time=entry,
                exit_time=exit_time,
                priority=source.priority,
                direction=source.direction,
                is_fixed=True,
            )
        )
    if not additions:
        raise HTTPException(status_code=422, detail={"error": "SURGE_WINDOW_EMPTY", "message": "The selected freight surge window does not overlap timetable freight movements."})
    return additions


def _build_monsoon_slowdown(trains: List[TrainMovement], scenario: Dict[str, Any], percent: int) -> List[TrainMovement]:
    if percent not in {10, 20, 30}:
        raise HTTPException(status_code=422, detail={"error": "INVALID_WEATHER_SLOWDOWN", "message": "Monsoon slowdown must be 10%, 20%, or 30%."})
    start, end = _scenario_window(scenario)
    affected = [train for train in trains if train.entry_time < end and train.exit_time > start]
    if not affected:
        raise HTTPException(status_code=422, detail={"error": "WEATHER_WINDOW_EMPTY", "message": "The selected weather window does not overlap timetable movements."})

    additions: List[TrainMovement] = []
    for index, source in enumerate(affected, start=1):
        overlap_start = max(source.entry_time, start)
        overlap_end = min(source.exit_time, end)
        minutes = max(1, int((overlap_end - overlap_start).total_seconds() // 60))
        extension = max(5, round(minutes * percent / 100))
        additions.append(
            TrainMovement(
                train_id=f"WHATIF-WEATHER-{percent}-{index}",
                train_number="WHAT-IF-WX",
                train_name="Monsoon Slowdown Occupancy",
                train_type=source.train_type,
                section_id=source.section_id,
                track_id=source.track_id,
                entry_time=overlap_start,
                exit_time=min(end, overlap_end + timedelta(minutes=extension)),
                priority=998,
                direction=source.direction,
                is_fixed=True,
            )
        )
    return additions


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
    candidate_ids = {str(value) for value in baseline_plan.get("weekly_candidate_ids", [])}
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
    scenario_trains = list(trains)
    if scenario_type in {"TRACK_OUTAGE", "SECTION_OUTAGE", "EMERGENCY_BLOCK"}:
        scenario_trains += _build_blockers(scenario, blocker_tracks)
    elif scenario_type == "FREIGHT_SURGE":
        scenario_trains += _build_freight_surge(trains, scenario, int(scenario["impact_percent"]))
    elif scenario_type == "MONSOON_SLOWDOWN":
        scenario_trains += _build_monsoon_slowdown(trains, scenario, int(scenario["impact_percent"]))

    result = HardenedWeeklyCPSATSolver(jobs, scenario_trains, start_monday).solve()

    baseline_blocks = baseline_plan.get("scheduled_blocks", [])
    baseline_index = _index_scheduled(baseline_blocks)
    scenario_index = _index_scheduled(result.get("scheduled_blocks", []))
    baseline_ids = set(baseline_index)
    scenario_ids = set(scenario_index)
    moved = {job_id for job_id in baseline_ids | scenario_ids if baseline_index.get(job_id) != scenario_index.get(job_id)}

    deferred_ids = {str(value.get("job_id")) for value in result.get("deferred_jobs", []) if isinstance(value, dict) and value.get("job_id")}
    baseline_deferred_ids = {str(value.get("job_id")) for value in baseline_plan.get("deferred_jobs", []) if isinstance(value, dict) and value.get("job_id")}
    newly_deferred = deferred_ids - baseline_deferred_ids
    impacted_ids = sorted(moved | (baseline_ids - scenario_ids) | (scenario_ids - baseline_ids))
    baseline_block_count = len(baseline_blocks)
    scenario_block_count = len(result.get("scheduled_blocks", []))
    impact = {
        "jobs_affected": len(impacted_ids),
        "blocks_affected": abs(scenario_block_count - baseline_block_count) + len(moved),
        "jobs_delayed_or_moved": len(moved),
        "jobs_deferred": len(newly_deferred),
        "additional_deferrals": len(newly_deferred),
        "baseline_scheduled_jobs": len(baseline_ids),
        "scenario_scheduled_jobs": len(scenario_ids),
        "solver_status": result.get("status", result.get("solver_status", "UNKNOWN")),
    }
    impact["severity"] = _severity(impact)

    scenario_label = {
        "TRACK_OUTAGE": "Track outage",
        "SECTION_OUTAGE": "Section outage",
        "EMERGENCY_BLOCK": "Emergency block",
        "FREIGHT_SURGE": f"Freight demand surge (+{scenario['impact_percent']}%)",
        "MONSOON_SLOWDOWN": f"Monsoon weather slowdown ({scenario['impact_percent']}%)",
    }[scenario_type]
    details: List[str] = [
        f"{scenario_label} assessed for {requested_section}.",
        f"Scenario window: {start_time.isoformat(timespec='minutes')} to {end_time.isoformat(timespec='minutes')}.",
    ]
    if scenario_type == "FREIGHT_SURGE":
        details.append("Freight demand stress adds in-memory freight paths using the existing timetable as the demand shape; source timetable data is unchanged.")
    elif scenario_type == "MONSOON_SLOWDOWN":
        details.append("Weather stress is modelled as conservative occupancy-time extension; it is a scenario proxy, not a live railway speed restriction feed.")
    if moved:
        details.append(f"{len(moved)} job(s) changed schedule position or scheduling state.")
    if newly_deferred:
        details.append(f"{len(newly_deferred)} additional job(s) are deferred in the scenario result.")
    if not moved and not newly_deferred:
        details.append("The optimizer found no material change to the approved weekly schedule.")

    return {
        "status": "SIMULATED",
        "baseline_revision": approved.get("revision"),
        "planning_week": week,
        "scenario": {**scenario, "start_time": start_time.isoformat(), "end_time": end_time.isoformat(), "blocked_tracks": blocker_tracks},
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
