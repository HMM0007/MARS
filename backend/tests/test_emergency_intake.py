from datetime import date

from app.core import router


def test_emergency_intake_forces_critical_and_emergency_work_type(monkeypatch):
    captured = {}

    def fake_submit(request, *, emergency=False, emergency_reason=None, train_operation_impact=False):
        captured["request"] = request
        captured["emergency"] = emergency
        captured["reason"] = emergency_reason
        captured["train_operation_impact"] = train_operation_impact
        return {"status": "EMERGENCY_REPAIR_PROPOSED"}

    monkeypatch.setattr(router, "_submit_intake_job", fake_submit)

    result = router.submit_emergency_job(
        router.EmergencyJobIntakeRequest(
            job_id="ENG-EMG-TEST",
            department="Engineering",
            asset_id="TRK-TEST-01",
            asset_type="TRACK",
            section_id="PUNE-LNL",
            track_id="PUNE-LNL-UP",
            location_km=227.4,
            defect_type="RAIL_CRACK_USFD",
            emergency_reason="Safety-critical rail defect reported during inspection",
            estimated_duration_hours=2.0,
            due_date=date(2026, 9, 13),
            preferred_window="ANY",
            machine_required="YES",
            safety_conflict_tag="NORMAL",
            train_operation_impact=True,
            planning_week=1,
        )
    )

    assert result["status"] == "EMERGENCY_REPAIR_PROPOSED"
    assert captured["emergency"] is True
    assert captured["request"].criticality_level == "CRITICAL"
    assert captured["request"].work_type == "EMERGENCY_MAINTENANCE"
    assert captured["reason"].startswith("Safety-critical rail defect")
    assert captured["train_operation_impact"] is True
