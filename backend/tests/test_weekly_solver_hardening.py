from datetime import date, datetime

from app.core.hardened_weekly_solver import HardenedWeeklyCPSATSolver
from app.models.job import MaintenanceJob


def _job(job_id: str, department: str, *, location_km: float = 227.4, duration: float = 2.0,
         machine: str | None = None, power_block: bool = False,
         safety_tag: str = "NORMAL") -> MaintenanceJob:
    return MaintenanceJob(
        job_id=job_id,
        department=department,
        asset_id=f"ASSET-{job_id}",
        asset_type="Test",
        section_id="PUNE-LNL",
        track_id="PUNE-LNL-UP",
        location_km=location_km,
        defect_type="TRACK_GEOMETRY_TGI",
        criticality_level="HIGH",
        estimated_duration_hours=duration,
        due_date=date(2026, 9, 13),
        preferred_window="NIGHT",
        machine_required=machine,
        power_block_required=power_block,
        dependency_job_id=None,
        work_type="TEST_MAINTENANCE",
        safety_conflict_tag=safety_tag,
        created_date=date(2026, 9, 1),
        status="PENDING",
        ai_priority_score=80.0,
    )


def test_shared_possession_requires_physical_proximity():
    near_eng = _job("ENG-NEAR", "Engineering", location_km=227.40)
    near_snt = _job("SNT-NEAR", "S&T", location_km=227.44)
    far_snt = _job("SNT-FAR", "S&T", location_km=227.51)

    assert HardenedWeeklyCPSATSolver._can_share_possession(near_eng, near_snt)
    assert not HardenedWeeklyCPSATSolver._can_share_possession(near_eng, far_snt)


def test_shared_possession_rejects_power_machine_and_safety_conflicts():
    normal = _job("ENG-NORMAL", "Engineering")
    power = _job("TRC-POWER", "Traction", power_block=True)
    heavy = _job("ENG-HEAVY", "Engineering", machine="BCM 80")
    welding = _job("ENG-WELD", "Engineering", safety_tag="WELDING")
    signal = _job("SNT-SIGNAL", "S&T", safety_tag="SIGNAL_SENSITIVE")

    assert not HardenedWeeklyCPSATSolver._can_share_possession(normal, power)
    assert not HardenedWeeklyCPSATSolver._can_share_possession(normal, heavy)
    assert not HardenedWeeklyCPSATSolver._can_share_possession(welding, signal)


def test_generated_consolidation_pair_solves_as_one_block():
    engineering = _job("ENG-PLN-044", "Engineering")
    snt = _job("SNT-PLN-044", "S&T")

    result = HardenedWeeklyCPSATSolver(
        [engineering, snt],
        [],
        datetime(2026, 9, 7),
    ).solve()

    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["weekly_metrics"]["scheduled_jobs_count"] == 2
    assert result["weekly_metrics"]["consolidated_blocks_count"] == 1

    consolidated = [b for b in result["scheduled_blocks"] if b["is_consolidated"]]
    assert len(consolidated) == 1
    assert set(consolidated[0]["job_ids"]) == {"ENG-PLN-044", "SNT-PLN-044"}
