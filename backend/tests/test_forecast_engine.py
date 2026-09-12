from datetime import date

import pandas as pd

from app.core.forecast_engine import MonthlyForecastEngine
from app.models.job import MaintenanceJob


def _job(job_id: str, created_date: date) -> MaintenanceJob:
    return MaintenanceJob(
        job_id=job_id,
        department="Engineering",
        asset_id=f"AST-{job_id}",
        asset_type="TRACK",
        section_id="PUNE-LNL",
        track_id="TRACK_1_UP",
        location_km=227.4,
        defect_type="TRACK_GEOMETRY",
        criticality_level="HIGH",
        estimated_duration_hours=2.0,
        due_date=created_date,
        created_date=created_date,
    )


def test_monthly_history_is_regular_and_fills_missing_months():
    jobs = [
        _job("J1", date(2026, 1, 10)),
        _job("J2", date(2026, 1, 20)),
        _job("J3", date(2026, 3, 5)),
    ]

    history = MonthlyForecastEngine.build_monthly_history(
        jobs,
        history_months=6,
        anchor_date=date(2026, 3, 15),
    )

    assert list(history.columns) == ["ds", "y"]
    assert len(history) == 6
    assert history["ds"].is_monotonic_increasing
    assert history.loc[history["ds"] == pd.Timestamp("2026-01-01"), "y"].iloc[0] == 2
    assert history.loc[history["ds"] == pd.Timestamp("2026-02-01"), "y"].iloc[0] == 0
    assert history.loc[history["ds"] == pd.Timestamp("2026-03-01"), "y"].iloc[0] == 1


def test_forecast_uses_prophet_and_returns_monthly_bounds(monkeypatch):
    class FakeProphet:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def fit(self, history):
            assert list(history.columns) == ["ds", "y"]
            assert len(history) == 12
            return self

        def make_future_dataframe(self, periods, freq, include_history):
            assert freq == "MS"
            assert include_history is False
            return pd.DataFrame(
                {"ds": pd.date_range("2026-01-01", periods=periods, freq="MS")}
            )

        def predict(self, future):
            return pd.DataFrame(
                {
                    "ds": future["ds"],
                    "yhat": [12.4] * len(future),
                    "yhat_lower": [8.2] * len(future),
                    "yhat_upper": [16.8] * len(future),
                }
            )

    monkeypatch.setattr(MonthlyForecastEngine, "_get_prophet_class", staticmethod(lambda: FakeProphet))

    jobs = [
        _job(f"J{i}", date(2025 + ((i - 1) // 12), ((i - 1) % 12) + 1, 5))
        for i in range(1, 13)
    ]

    result = MonthlyForecastEngine.forecast(
        jobs,
        forecast_months=2,
        history_months=12,
        anchor_date=date(2025, 12, 15),
    )

    assert result["algorithm"] == "Prophet"
    assert result["model_version"] == "prophet-monthly-demand-v1"
    assert result["training_observations"] == 12
    assert result["next_month_forecast_jobs"] == 12
    assert len(result["forecast"]) == 2
    assert result["forecast"][0]["lower_bound"] == 8
    assert result["forecast"][0]["upper_bound"] == 17
