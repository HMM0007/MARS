from datetime import date, datetime

from app.core.incremental_cpsat import IncrementalCPSATSolver
from app.models.job import MaintenanceJob


START_MONDAY = datetime(2026, 9, 7)
DUE_DATE = date(2026, 9, 13)


def make_job(
    job_id: str,
    *,
    section: str = "PUNE-LNL",
    track: str = "TRACK_1_UP",
    asset: str = "ASSET-1",
    duration: float = 1.0,
    priority: float = 60.0,
) -> MaintenanceJob:
    return MaintenanceJob(
        job_id=job_id,
        department="Engineering",
        asset_id=asset,
        asset_type="TRACK",
        section_id=section,
        track_id=track,
        location_km=227.4,
        defect_type="TRACK_GEOMETRY",
        criticality_level="HIGH",
        estimated_duration_hours=duration,
        due_date=DUE_DATE,
        preferred_window="ANY",
        machine_required=None,
        power_block_required=False,
        dependency_job_id=None,
        work_type="TRACK_MAINTENANCE",
        safety_conflict_tag="NORMAL",
        created_date=date(2026, 9, 1),
        status="PENDING",
        ai_priority_score=priority,
    )


def test_incremental_freezes_unaffected_approved_job():
    affected = make_job("JOB-A", track="TRACK_1_UP", asset="ASSET-1")
    unaffected = make_job(
        "JOB-B",
        section="CWD-YARD",
        track="TRACK_YARD",
        asset="ASSET-2",
    )
    new_job = make_job("JOB-NEW", track="TRACK_1_UP", asset="ASSET-3", priority=95.0)

    existing_plan = {
        "scheduled_blocks": [
            {
                "block_id": "BLK-W1-001",
                "section_id": "PUNE-LNL",
                "track_id": "TRACK_1_UP",
                "start_time": "2026-09-07T02:00:00",
                "end_time": "2026-09-07T03:00:00",
                "job_ids": ["JOB-A"],
            },
            {
                "block_id": "BLK-W1-002",
                "section_id": "CWD-YARD",
                "track_id": "TRACK_YARD",
                "start_time": "2026-09-07T04:00:00",
                "end_time": "2026-09-07T05:00:00",
                "job_ids": ["JOB-B"],
            },
        ]
    }

    solver = IncrementalCPSATSolver(
        jobs=[affected, unaffected, new_job],
        trains=[],
        start_monday=START_MONDAY,
        existing_plan=existing_plan,
        new_job_id="JOB-NEW",
    )

    assert "JOB-A" in solver.affected_job_ids
    assert "JOB-NEW" in solver.affected_job_ids
    assert "JOB-B" not in solver.affected_job_ids
    assert solver.fixed_assignments == {"JOB-B": 16}

    result = solver.solve()

    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["incremental"]["frozen_job_count"] == 1
    assert result["incremental"]["scheduled_new_job"] is True
    assert "JOB-B" in result["incremental"]["frozen_job_ids"]

    job_b_blocks = [
        block for block in result["scheduled_blocks"] if "JOB-B" in block["job_ids"]
    ]
    assert len(job_b_blocks) == 1
    assert job_b_blocks[0]["start_time"].startswith("2026-09-07T04:00:00")


def test_incremental_rejects_missing_new_job_from_pool():
    existing_plan = {"scheduled_blocks": []}
    try:
        IncrementalCPSATSolver(
            jobs=[make_job("JOB-A")],
            trains=[],
            start_monday=START_MONDAY,
            existing_plan=existing_plan,
            new_job_id="MISSING",
        )
    except ValueError as exc:
        assert "MISSING" in str(exc)
    else:
        raise AssertionError("Expected missing new job to raise ValueError")
