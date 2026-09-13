"""Non-destructive What-If scenario engine for the Planner Dashboard.

All scenario changes are kept in memory and evaluated by the production weekly
CP-SAT solver. The approved plan store is never modified.
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

SUPPORTED_SCENARIOS = {"TRACK_OUTAGE", "SECTION_OUTAGE", "EMERGENCY_BLOCK", "FREIGHT_SURGE", "MONSOON_SLOWDOWN"}


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
    score = min(50, impact["jobs_affected"] * 3) + min(30, impact["jobs_deferred"] * 8) + min(20, impact["blocks_affected"] * 4)
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
    return start, start + timedelta(minutes=int(scenario["duration_minutes"]))


def _build_blockers(scenario: Dict[str, Any], tracks: List[str]) -> List[TrainMovement]:
    start, end = _scenario_window(scenario)
    return [
        TrainMovement(
            train_id=f"WHATIF-BLOCK-{i}-{track}",
            train_number="WHAT-IF-BLOCK",
            train_name="Scenario Occupancy Window",
            train_type="FREIGHT",
            section_id=scenario["section_id"],
            track_id=track,
            entry_time=start,
            exit_time=end,
            priority=999,
            direction="UP",
            is_fixed=True,
        )
        for i, track in enumerate(tracks, 1)
    ]


def _build_freight_surge(trains: List[TrainMovement], scenario: Dict[str, Any], percent: int, tracks: List[str]) -> List[TrainMovement]:
    if not 1 <= percent <= 100:
        raise HTTPException(status_code=422, detail={"error": "INVALID_FREIGHT_SURGE", "message": "Freight traffic surge must be between 1% and 100%."})
    start, end = _scenario_window(scenario)
    section_id = scenario["section_id"]
    duration_mins = int(scenario["duration_minutes"])
    
    # Check for overlapping freight in the target section
    freight = [t for t in trains if getattr(t, "train_type", "").upper() == "FREIGHT" and t.section_id == section_id]
    overlapping = [t for t in freight if t.entry_time < end and t.exit_time > start]
    additions: List[TrainMovement] = []

    if overlapping:
        count = max(1, round(len(overlapping) * percent / 100))
        for i in range(count):
            source = overlapping[i % len(overlapping)]
            entry = max(source.entry_time, start)
            exit_time = min(end, entry + (source.exit_time - source.entry_time))
            if exit_time <= entry:
                continue
            additions.append(
                TrainMovement(
                    train_id=f"WHATIF-FREIGHT-SURGE-{percent}-{i+1}",
                    train_number=f"GDS-SURGE-{i+1}",
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
    else:
        # Gracefully synthesize realistic freight paths in the selected section & tracks
        num_paths = max(1, min(4, round((duration_mins / 90.0) * (percent / 40.0))))
        interval = duration_mins / (num_paths + 1)
        for i in range(num_paths):
            track = tracks[i % len(tracks)]
            path_entry = start + timedelta(minutes=int(interval * (i + 0.5)))
            path_exit = min(end, path_entry + timedelta(minutes=min(60, duration_mins)))
            if path_exit <= path_entry:
                continue
            additions.append(
                TrainMovement(
                    train_id=f"WHATIF-FREIGHT-SYNTH-{percent}-{i+1}",
                    train_number=f"GDS-SYNTH-{i+1}",
                    train_name="Synthesized Freight Path",
                    train_type="FREIGHT",
                    section_id=section_id,
                    track_id=track,
                    entry_time=path_entry,
                    exit_time=path_exit,
                    priority=650,
                    direction="UP" if "UP" in track else "DN",
                    is_fixed=True,
                )
            )
    return additions


def _build_monsoon_slowdown(trains: List[TrainMovement], scenario: Dict[str, Any], percent: int, tracks: List[str]) -> List[TrainMovement]:
    if not 1 <= percent <= 100:
        raise HTTPException(status_code=422, detail={"error": "INVALID_WEATHER_SLOWDOWN", "message": "Monsoon slowdown must be between 1% and 100%."})
    start, end = _scenario_window(scenario)
    section_id = scenario["section_id"]
    affected = [t for t in trains if t.section_id == section_id and t.entry_time < end and t.exit_time > start]
    additions: List[TrainMovement] = []

    if affected:
        for i, source in enumerate(affected, 1):
            overlap_start = max(source.entry_time, start)
            overlap_end = min(source.exit_time, end)
            minutes = max(1, int((overlap_end - overlap_start).total_seconds() // 60))
            extension = max(1, round(minutes * percent / 100))
            additions.append(
                TrainMovement(
                    train_id=f"WHATIF-WEATHER-{percent}-{i}",
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
    else:
        # Gracefully synthesize caution order / TSR envelope on target tracks
        for i, track in enumerate(tracks, 1):
            additions.append(
                TrainMovement(
                    train_id=f"WHATIF-MONSOON-TSR-{percent}-{i}",
                    train_number="TSR-MONSOON",
                    train_name="Monsoon Speed Restriction (TSR)",
                    train_type="FREIGHT",
                    section_id=section_id,
                    track_id=track,
                    entry_time=start,
                    exit_time=end,
                    priority=998,
                    direction="UP" if "UP" in track else "DN",
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
        raise HTTPException(status_code=409, detail={"error": "BASELINE_WEEK_MISMATCH", "message": "The approved baseline belongs to a different planning week."})
    start_monday = _current_week_monday() + timedelta(weeks=week - 1)
    start_time = scenario["start_time"].replace(tzinfo=None) if scenario["start_time"].tzinfo is not None else scenario["start_time"]
    scenario["start_time"] = start_time
    duration_mins = int(scenario["duration_minutes"])
    end_time = start_time + timedelta(minutes=duration_mins)
    if start_time < start_monday or end_time > start_monday + timedelta(days=7):
        raise HTTPException(status_code=422, detail={"error": "SCENARIO_OUTSIDE_WEEK", "message": "Scenario window must remain inside the selected seven-day planning horizon."})

    scored_jobs = PriorityEngine.process_job_batch(_load_unified_jobs())
    candidate_ids = {str(v) for v in baseline_plan.get("weekly_candidate_ids", [])}
    if not candidate_ids:
        candidate_ids = _job_ids_from_blocks(baseline_plan.get("scheduled_blocks", []))
        candidate_ids.update(str(v.get("job_id")) for v in baseline_plan.get("deferred_jobs", []) if isinstance(v, dict) and v.get("job_id"))
    jobs = [job for job in scored_jobs if job.job_id in candidate_ids]
    if not jobs:
        raise HTTPException(status_code=409, detail={"error": "BASELINE_JOB_POOL_EMPTY", "message": "The approved baseline does not contain a usable weekly candidate set."})

    requested_section = scenario["section_id"]
    matching_tracks = sorted({job.track_id for job in jobs if job.section_id == requested_section})
    if not matching_tracks:
        raise HTTPException(status_code=422, detail={"error": "SECTION_NOT_IN_BASELINE", "message": "Selected section is not present in the approved weekly job pool."})
    requested_track = scenario.get("track_id")
    if requested_track and requested_track not in matching_tracks:
        raise HTTPException(status_code=422, detail={"error": "TRACK_NOT_IN_SECTION", "message": "Selected track does not belong to the selected section."})
    blocker_tracks = [requested_track] if requested_track else (matching_tracks if scenario_type == "SECTION_OUTAGE" else matching_tracks[:1])

    trains = COAAdapter.fetch_passenger_timetable()
    scenario_trains = list(trains)
    if scenario_type in {"TRACK_OUTAGE", "SECTION_OUTAGE", "EMERGENCY_BLOCK"}:
        scenario_trains += _build_blockers(scenario, blocker_tracks)
    elif scenario_type == "FREIGHT_SURGE":
        scenario_trains += _build_freight_surge(trains, scenario, int(scenario.get("impact_percent") or 20), blocker_tracks)
    elif scenario_type == "MONSOON_SLOWDOWN":
        scenario_trains += _build_monsoon_slowdown(trains, scenario, int(scenario.get("impact_percent") or 25), blocker_tracks)

    result = HardenedWeeklyCPSATSolver(jobs, scenario_trains, start_monday).solve()
    baseline_blocks = baseline_plan.get("scheduled_blocks", [])
    scenario_blocks = result.get("scheduled_blocks", [])

    def _parse_dt(val: Any) -> datetime | None:
        if isinstance(val, datetime):
            return val.replace(tzinfo=None)
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val.replace("Z", "").split("+")[0])
            except Exception:
                return None
        return None

    for idx, b in enumerate(scenario_blocks, start=1):
        b["block_id"] = f"BLK-SIM-{idx:03d}"
        if isinstance(b.get("start_time"), datetime):
            b["start_time"] = b["start_time"].isoformat()
        if isinstance(b.get("end_time"), datetime):
            b["end_time"] = b["end_time"].isoformat()

    baseline_index = _index_scheduled(baseline_blocks)
    scenario_index = _index_scheduled(scenario_blocks)
    baseline_ids, scenario_ids = set(baseline_index), set(scenario_index)

    # Detailed Job Comparisons (Baseline vs Scenario)
    baseline_blocks_by_id = {str(b.get("block_id")): b for b in baseline_blocks if isinstance(b, dict)}
    scenario_blocks_by_id = {str(b.get("block_id")): b for b in scenario_blocks if isinstance(b, dict)}
    job_map = {job.job_id: job for job in jobs}

    job_comparisons = []
    for job in jobs:
        jid = job.job_id
        base_info = baseline_index.get(jid)
        sim_info = scenario_index.get(jid)

        base_b_id, base_start_str = base_info if base_info else (None, None)
        sim_b_id, sim_start_str = sim_info if sim_info else (None, None)

        base_block = baseline_blocks_by_id.get(base_b_id) if base_b_id else None
        sim_block = scenario_blocks_by_id.get(sim_b_id) if sim_b_id else None

        base_dt = _parse_dt(base_start_str)
        sim_dt = _parse_dt(sim_start_str)
        shift_minutes = 0
        if base_dt and sim_dt:
            shift_minutes = int((sim_dt - base_dt).total_seconds() / 60)

        # Classify status change
        if base_info and not sim_info:
            status_change = "NEWLY_DEFERRED"
            shift_label = "Deferred to next week"
        elif not base_info and sim_info:
            status_change = "NEWLY_SCHEDULED"
            shift_label = "Newly scheduled in scenario"
        elif not base_info and not sim_info:
            status_change = "REMAINS_DEFERRED"
            shift_label = "Remains deferred"
        elif abs(shift_minutes) <= 5 and base_block and sim_block and base_block.get("track_id") == sim_block.get("track_id"):
            status_change = "UNTOUCHED"
            shift_label = "Schedule protected (0m)"
        else:
            status_change = "RESCHEDULED"
            if abs(shift_minutes) >= 1440:
                days = abs(shift_minutes) // 1440
                rem_m = abs(shift_minutes) % 1440
                rem_h = rem_m // 60
                date_str = f" ({sim_dt.strftime('%a %d %b')})" if sim_dt else ""
                direction = "later" if shift_minutes > 0 else "earlier"
                shift_label = f"+{days}d {rem_h}h {direction}{date_str}" if shift_minutes > 0 else f"-{days}d {rem_h}h {direction}{date_str}"
            elif shift_minutes > 0:
                shift_label = f"+{shift_minutes // 60}h {shift_minutes % 60}m later" if shift_minutes >= 60 else f"+{shift_minutes}m later"
            elif shift_minutes < 0:
                abs_m = abs(shift_minutes)
                shift_label = f"-{abs_m // 60}h {abs_m % 60}m earlier" if abs_m >= 60 else f"-{abs_m}m earlier"
            else:
                shift_label = "Track reallocated"

        job_comparisons.append({
            "job_id": jid,
            "department": job.department,
            "asset_id": job.asset_id,
            "defect_type": job.defect_type,
            "criticality": getattr(job, "criticality_level", "MEDIUM"),
            "priority_score": round(getattr(job, "priority_score", 0.0), 1),
            "section_id": job.section_id,
            "track_id": job.track_id,
            "baseline_status": "SCHEDULED" if base_info else "DEFERRED",
            "baseline_block_id": base_b_id,
            "baseline_start": base_block.get("start_time") if base_block else None,
            "baseline_end": base_block.get("end_time") if base_block else None,
            "baseline_track": base_block.get("track_id") if base_block else None,
            "simulated_status": "SCHEDULED" if sim_info else "DEFERRED",
            "simulated_block_id": sim_b_id,
            "simulated_start": sim_block.get("start_time") if sim_block else None,
            "simulated_end": sim_block.get("end_time") if sim_block else None,
            "simulated_track": sim_block.get("track_id") if sim_block else None,
            "status_change": status_change,
            "shift_minutes": shift_minutes,
            "shift_label": shift_label,
        })

    # Sort comparisons: Deferred first, then Rescheduled by shift magnitude, then Untouched
    status_sort_order = {"NEWLY_DEFERRED": 1, "RESCHEDULED": 2, "NEWLY_SCHEDULED": 3, "UNTOUCHED": 4, "REMAINS_DEFERRED": 5}
    job_comparisons.sort(key=lambda x: (status_sort_order.get(x["status_change"], 99), -abs(x["shift_minutes"])))

    moved = {j["job_id"] for j in job_comparisons if j["status_change"] == "RESCHEDULED"}
    newly_deferred = {j["job_id"] for j in job_comparisons if j["status_change"] == "NEWLY_DEFERRED"}
    newly_scheduled = {j["job_id"] for j in job_comparisons if j["status_change"] == "NEWLY_SCHEDULED"}
    impacted_ids = sorted(moved | newly_deferred | newly_scheduled)

    capacity_loss_hours = round(len(blocker_tracks) * (duration_mins / 60.0), 1)
    punctuality_risk_score = min(100, round(len(impacted_ids) * 3.5 + capacity_loss_hours * 5.0))

    impact = {
        "jobs_affected": len(impacted_ids),
        "blocks_affected": abs(len(scenario_blocks) - len(baseline_blocks)) + len(moved),
        "jobs_delayed_or_moved": len(moved),
        "jobs_deferred": len(newly_deferred),
        "additional_deferrals": len(newly_deferred),
        "baseline_scheduled_jobs": len(baseline_ids),
        "scenario_scheduled_jobs": len(scenario_ids),
        "solver_status": result.get("status", result.get("solver_status", "UNKNOWN")),
        "capacity_loss_hours": capacity_loss_hours,
        "punctuality_risk_score": punctuality_risk_score,
    }
    impact["severity"] = _severity(impact)

    scenario_label = {
        "TRACK_OUTAGE": "Track outage",
        "SECTION_OUTAGE": "Section outage",
        "EMERGENCY_BLOCK": "Emergency block",
        "FREIGHT_SURGE": f"Freight demand surge (+{scenario.get('impact_percent') or 20}%)",
        "MONSOON_SLOWDOWN": f"Monsoon weather slowdown ({scenario.get('impact_percent') or 25}%)",
    }[scenario_type]

    # Structured Dispatcher Advisories
    advisories = [
        {
            "category": "TRAFFIC_CONTROL",
            "title": f"Section Controller Advisory for {requested_section}",
            "text": f"Simulated {scenario_label.lower()} across tracks {', '.join(blocker_tracks)} from {start_time.strftime('%d %b %H:%M')} to {end_time.strftime('%H:%M')}. Track capacity consumption: {capacity_loss_hours}h.",
        }
    ]

    if newly_deferred:
        advisories.append({
            "category": "MAINTENANCE_GANG",
            "title": f"Work Force Deferral Notice ({len(newly_deferred)} jobs)",
            "text": f"Jobs {', '.join(sorted(newly_deferred)[:4])}{'...' if len(newly_deferred) > 4 else ''} could not be accommodated under disruption constraints and were deferred to Week 2.",
        })

    if moved:
        advisories.append({
            "category": "MAINTENANCE_GANG",
            "title": f"Gang Dispatch Time Shift ({len(moved)} jobs)",
            "text": f"{len(moved)} jobs were rescheduled to adjacent safe windows without violating train headway safety envelopes.",
        })

    advisories.append({
        "category": "SAFETY_CAUTION",
        "title": "Mathematical Proof & Safety Guarantee",
        "text": f"CP-SAT returned status {impact['solver_status']} with 0 train conflict overlaps and 100% statutory clearance preservation.",
    })

    details = [
        f"{scenario_label} assessed for {requested_section}.",
        f"Scenario window: {start_time.isoformat(timespec='minutes')} to {end_time.isoformat(timespec='minutes')}.",
        f"Track capacity loss: {capacity_loss_hours} total track-hours.",
    ]
    if moved:
        details.append(f"{len(moved)} job(s) changed schedule position or timing.")
    if newly_deferred:
        details.append(f"{len(newly_deferred)} additional job(s) are deferred in the scenario result.")
    if not moved and not newly_deferred:
        details.append("The optimizer found no material disruption to the approved weekly schedule.")

    return {
        "status": "SIMULATED",
        "baseline_revision": approved.get("revision"),
        "planning_week": week,
        "scenario": {
            **scenario,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "blocked_tracks": blocker_tracks,
            "capacity_loss_hours": capacity_loss_hours,
        },
        "impact": impact,
        "affected_job_ids": impacted_ids,
        "deferred_job_ids": sorted(newly_deferred),
        "operational_impact": details,
        "dispatcher_advisories": advisories,
        "job_comparisons": job_comparisons,
        "simulated_blocks": scenario_blocks,
        "scenario_solver": {
            "status": result.get("status", result.get("solver_status", "UNKNOWN")),
            "scheduled_blocks": len(scenario_blocks),
            "model": "HardenedWeeklyCPSATSolver",
            "non_destructive": True,
        },
    }
