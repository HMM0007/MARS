from datetime import date, datetime, timedelta

from app.core.compliance_validator import RailwayComplianceValidator
from app.models.job import MaintenanceJob
from app.models.train import TrainMovement


def make_job(job_id="ENG-TEST-1", duration=2.5, machine=None):
    return MaintenanceJob(
        job_id=job_id,
        department="Engineering",
        asset_id="ASSET-1",
        asset_type="TRACK",
        section_id="PUNE-LNL",
        track_id="PUNE-LNL-UP",
        location_km=200.0,
        defect_type="TRACK_GEOMETRY_TGI",
        criticality_level="HIGH",
        estimated_duration_hours=duration,
        due_date=date(2026, 9, 20),
        preferred_window="NIGHT",
        machine_required=machine,
        power_block_required=False,
        work_type="TRACK_MAINTENANCE",
        safety_conflict_tag="NORMAL",
        created_date=date(2026, 9, 1),
        ai_priority_score=80,
    )


def make_train(start):
    return TrainMovement(
        train_id="TRAIN-1",
        train_number="12128",
        train_name="Test Train",
        train_type="EXPRESS",
        section_id="PUNE-LNL",
        track_id="PUNE-LNL-UP",
        entry_time=start,
        exit_time=start + timedelta(minutes=30),
        priority=1,
        direction="UP",
        is_fixed=True,
    )


def make_block(start, end, job_id="ENG-TEST-1"):
    return {
        "block_id": "BLK-W1-TEST",
        "section_id": "PUNE-LNL",
        "track_id": "PUNE-LNL-UP",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "job_ids": [job_id],
        "departments": ["Engineering"],
        "is_consolidated": False,
    }


def test_validator_passes_safe_heavy_machine_window():
    train_start = datetime(2026, 9, 7, 8, 0)
    job = make_job(duration=2.5, machine="CSM 09-32 Tamping Machine")
    block = make_block(datetime(2026, 9, 7, 2, 0), datetime(2026, 9, 7, 4, 30))

    result = RailwayComplianceValidator([job], [make_train(train_start)], [block]).validate()

    assert result["overall_status"] in {"PASS", "PASS_WITH_ADVISORIES"}
    assert result["compliance_score"] == 100.0
    assert all(rule["status"] != "FAIL" for rule in result["rules"])


def test_validator_detects_train_buffer_violation():
    train_start = datetime(2026, 9, 7, 8, 0)
    job = make_job(duration=1.0)
    block = make_block(datetime(2026, 9, 7, 7, 40), datetime(2026, 9, 7, 8, 40))

    result = RailwayComplianceValidator([job], [make_train(train_start)], [block]).validate()

    rule_2 = next(rule for rule in result["rules"] if rule["rule_id"] == 2)
    assert rule_2["status"] == "FAIL"
    assert result["overall_status"] == "FAIL"
