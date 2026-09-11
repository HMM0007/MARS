from app.core.monthly_allocator import MonthlyAllocator
from app.models.job import MaintenanceJob
from scripts.generate_mock_data import generate_jobs


def _job(job_id, department, duration=2.0, score=80.0):
    return MaintenanceJob(
        job_id=job_id,
        department=department,
        asset_id=f"ASSET-{job_id}",
        asset_type="Test",
        section_id="PUNE-LNL",
        track_id="PUNE-LNL-UP",
        location_km=227.4,
        defect_type="TEST",
        criticality_level="HIGH",
        estimated_duration_hours=duration,
        due_date=__import__("datetime").date.today(),
        preferred_window="NIGHT",
        machine_required=None,
        power_block_required=False,
        dependency_job_id=None,
        work_type="TEST_MAINTENANCE",
        safety_conflict_tag="NORMAL",
        created_date=__import__("datetime").date.today(),
        status="PENDING",
        ai_priority_score=score,
    )


def test_compatible_cross_department_pair_is_kept_in_one_week():
    engineering = _job("ENG-PLN-044", "Engineering")
    snt = _job("SNT-PLN-044", "S&T")

    result = MonthlyAllocator.generate_monthly_plan([engineering, snt])

    allocations = result["section_allocations"]["PUNE-LNL"]["weekly_breakdown"]
    pair_weeks = [
        week
        for week in allocations.values()
        if {"ENG-PLN-044", "SNT-PLN-044"}.issubset(set(week["job_ids"]))
    ]

    assert len(pair_weeks) == 1
    assert ["ENG-PLN-044", "SNT-PLN-044"] in pair_weeks[0]["consolidation_groups"]
    assert result["summary"]["consolidation_groups"] == 1


def test_generated_demo_pair_is_deterministic_and_consolidation_eligible():
    generated = generate_jobs(150)
    jobs = [MaintenanceJob(**record) for record in generated]

    result = MonthlyAllocator.generate_monthly_plan(jobs)
    allocations = result["section_allocations"]["PUNE-LNL"]["weekly_breakdown"]

    pair_weeks = [
        week
        for week in allocations.values()
        if {"ENG-PLN-044", "SNT-PLN-044"}.issubset(set(week["job_ids"]))
    ]

    assert len(pair_weeks) == 1
    assert ["ENG-PLN-044", "SNT-PLN-044"] in pair_weeks[0]["consolidation_groups"]
