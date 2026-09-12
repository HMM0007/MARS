from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.models.job import MaintenanceJob
from app.core import emergency_router


def test_emergency_metadata_is_part_of_persisted_job_model():
    job = MaintenanceJob(
        job_id="ENG-EMG-PERSIST-01",
        department="Engineering",
        asset_id="TRK-CWD-001",
        asset_type="TRACK",
        section_id="CWD-YARD",
        track_id="CWD-YARD-DN",
        location_km=210.6,
        defect_type="RAIL_FAILURE",
        criticality_level="CRITICAL",
        estimated_duration_hours=2.0,
        due_date=date(2026, 9, 12),
        preferred_window="NIGHT",
        machine_required="DEPARTMENT_MACHINE",
        work_type="EMERGENCY_MAINTENANCE",
        created_date=date(2026, 9, 12),
        emergency_reason="Rail failure affecting train operations",
        train_operation_impact=True,
    )
    restored = MaintenanceJob(**job.model_dump(mode="json"))
    assert restored.emergency_reason == "Rail failure affecting train operations"
    assert restored.train_operation_impact is True


def test_hardened_emergency_returns_explicit_repair_outcome(monkeypatch):
    class FakeRepair:
        def __init__(self, *args, **kwargs):
            pass

        def solve(self):
            return {
                "status": "FEASIBLE",
                "scheduled_blocks": [
                    {
                        "block_id": "BLK-W1-999",
                        "job_ids": ["ENG-EMG-HARDENED-01"],
                        "start_time": "2026-09-12T23:00:00",
                        "end_time": "2026-09-13T01:00:00",
                        "track_id": "CWD-YARD-DN",
                        "section_id": "CWD-YARD",
                    }
                ],
            }

    monkeypatch.setattr(emergency_router, "IncrementalCPSATSolver", FakeRepair)
    monkeypatch.setattr(
        emergency_router.core_router,
        "_load_unified_jobs",
        lambda: [],
    )
    monkeypatch.setattr(
        emergency_router,
        "get_approved_plan",
        lambda: {
            "planning_week": 1,
            "revision": 2,
            "plan": {"scheduled_blocks": []},
        },
    )
    stored = {}
    monkeypatch.setattr(
        emergency_router,
        "add_intake_job",
        lambda job: stored.update(job) or job,
    )
    monkeypatch.setattr(
        emergency_router,
        "save_pending_revision",
        lambda plan, week, source_revision, job_id: {
            "new_job_id": job_id,
            "source_revision": source_revision,
        },
    )
    monkeypatch.setattr(
        emergency_router,
        "PriorityEngine",
        emergency_router.PriorityEngine,
    )
    monkeypatch.setattr(
        emergency_router.core_router,
        "_current_week_monday",
        lambda: __import__("datetime").datetime(2026, 9, 7),
    )
    monkeypatch.setattr(
        emergency_router.COAAdapter,
        "fetch_passenger_timetable",
        lambda: [],
    )
    monkeypatch.setattr(
        emergency_router.core_router,
        "RailwayComplianceValidator",
        lambda **kwargs: type("Validator", (), {"validate": lambda self: {"overall_status": "PASS", "compliance_score": 100.0}})(),
    )

    response = TestClient(app).post(
        "/api/v1/core/jobs/emergency",
        json={
            "job_id": "ENG-EMG-HARDENED-01",
            "department": "Engineering",
            "asset_id": "TRK-CWD-001",
            "asset_type": "TRACK",
            "section_id": "CWD-YARD",
            "track_id": "CWD-YARD-DN",
            "location_km": 210.6,
            "defect_type": "RAIL_FAILURE",
            "emergency_reason": "Rail failure affecting train operations",
            "estimated_duration_hours": 2,
            "due_date": "2026-09-12",
            "preferred_window": "NIGHT",
            "machine_required": "YES",
            "safety_conflict_tag": "NORMAL",
            "power_block_required": False,
            "train_operation_impact": True,
            "planning_week": 1,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "EMERGENCY_REPAIR_PROPOSED"
    assert body["repair_status"] == "FEASIBLE"
    assert body["scheduled_new_job"] is True
    assert body["pending_revision"] is True
    assert body["requires_planner_approval"] is True
    assert body["baseline_revision"] == 2
    assert stored["emergency_reason"] == "Rail failure affecting train operations"
    assert stored["train_operation_impact"] is True
