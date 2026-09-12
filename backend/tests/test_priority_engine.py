from datetime import date, timedelta

from app.core.priority_engine import (
    BASE_CRITICALITY_MAP,
    FEATURE_NAMES,
    MODEL_VERSION,
    PriorityEngine,
)
from app.models.job import MaintenanceJob


def _job(
    job_id: str,
    criticality: str = "HIGH",
    department: str = "Engineering",
    due_offset_days: int = 7,
    deferral_count: int = 0,
    section_id: str = "PUNE-LNL",
) -> MaintenanceJob:
    today = date.today()
    return MaintenanceJob(
        job_id=job_id,
        department=department,
        asset_id=f"ASSET-{job_id}",
        asset_type="Test",
        section_id=section_id,
        track_id=f"{section_id}-UP",
        location_km=227.4,
        defect_type="TRACK_GEOMETRY_TGI",
        criticality_level=criticality,
        estimated_duration_hours=2.0,
        due_date=today + timedelta(days=due_offset_days),
        preferred_window="NIGHT",
        machine_required=None,
        power_block_required=False,
        dependency_job_id=None,
        work_type="TEST_MAINTENANCE",
        safety_conflict_tag="NORMAL",
        created_date=today,
        status="PENDING",
        deferral_count=deferral_count,
    )


def test_priority_engine_uses_a_real_fitted_xgboost_model():
    model = PriorityEngine._get_model()

    assert model.__class__.__name__ == "XGBRegressor"
    assert model.get_booster().num_boosted_rounds() == 180
    assert model.n_features_in_ == len(FEATURE_NAMES)
    assert PriorityEngine.model_metadata()["algorithm"] == "XGBoost Regressor"
    assert PriorityEngine.model_metadata()["model_version"] == MODEL_VERSION


def test_priority_score_is_bounded_and_respects_criticality():
    low = PriorityEngine.score_job(_job("LOW-1", criticality="LOW"))
    critical = PriorityEngine.score_job(_job("CRIT-1", criticality="CRITICAL"))

    assert low.base_priority_score == int(BASE_CRITICALITY_MAP["LOW"])
    assert critical.base_priority_score == int(BASE_CRITICALITY_MAP["CRITICAL"])
    assert 0.0 <= low.ai_priority_score <= 100.0
    assert 0.0 <= critical.ai_priority_score <= 100.0
    assert critical.ai_priority_score > low.ai_priority_score


def test_priority_score_responds_to_overdue_and_deferrals():
    current = PriorityEngine.score_job(_job("HIGH-0", due_offset_days=7, deferral_count=0))
    overdue = PriorityEngine.score_job(_job("HIGH-OVERDUE", due_offset_days=-10, deferral_count=0))
    deferred = PriorityEngine.score_job(_job("HIGH-DEFERRED", due_offset_days=7, deferral_count=2))

    assert overdue.ai_priority_score > current.ai_priority_score
    assert deferred.ai_priority_score > current.ai_priority_score


def test_batch_scoring_is_deterministic_and_sorted():
    jobs = [
        _job("LOW", criticality="LOW"),
        _job("CRITICAL", criticality="CRITICAL"),
        _job("MEDIUM", criticality="MEDIUM"),
    ]
    scored = PriorityEngine.process_job_batch(jobs)

    assert len(scored) == 3
    assert all(0.0 <= job.ai_priority_score <= 100.0 for job in scored)
    assert [job.ai_priority_score for job in scored] == sorted(
        [job.ai_priority_score for job in scored], reverse=True
    )
