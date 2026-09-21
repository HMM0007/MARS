"""Monthly maintenance-demand forecasting for MARS.

Prophet is used only for strategic workload forecasting. It does not alter
train timetables, block feasibility, job criticality, or the weekly CP-SAT
solver. The forecast is an advisory planning signal for the monthly engine.

The prototype derives historical monthly workload from job ``created_date``
records. Missing calendar months are explicitly represented as zero workload
so the time series has a regular monthly cadence. Production deployment can
replace this history builder with CRIS historical maintenance outcomes without
changing the Prophet interface.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Sequence

import pandas as pd

from app.models.job import MaintenanceJob

MODEL_VERSION = "prophet-monthly-demand-v1"
MIN_HISTORY_MONTHS = 6
DEFAULT_HISTORY_MONTHS = 18
DEFAULT_FORECAST_MONTHS = 1


class MonthlyForecastEngine:
    """Forecast monthly maintenance workload with a fitted Prophet model."""

    @staticmethod
    def build_monthly_history(
        jobs: Sequence[MaintenanceJob],
        history_months: int = DEFAULT_HISTORY_MONTHS,
        anchor_date: date | None = None,
    ) -> pd.DataFrame:
        """Build a regular monthly ``ds``/``y`` series from job creation dates.

        ``y`` is the number of maintenance jobs created in each calendar month.
        The window ends at the month containing ``anchor_date`` (today by
        default), and months with no jobs are retained as zero observations.
        """
        if history_months < MIN_HISTORY_MONTHS:
            raise ValueError(f"history_months must be >= {MIN_HISTORY_MONTHS}")

        anchor = anchor_date or date.today()
        end = pd.Timestamp(anchor).to_period("M")
        start = end - (history_months - 1)
        periods = pd.period_range(start=start, end=end, freq="M")
        counts = {period: 0 for period in periods}

        for job in jobs:
            period = pd.Timestamp(job.created_date).to_period("M")
            if period in counts:
                counts[period] += 1

        return pd.DataFrame(
            {
                "ds": [period.start_time for period in periods],
                "y": [float(counts[period]) for period in periods],
            }
        )

    @staticmethod
    def _get_prophet_class():
        """Import Prophet lazily so non-forecast API paths stay lightweight."""
        try:
            from prophet import Prophet
        except ImportError as exc:
            raise RuntimeError(
                "Prophet is not installed. Run 'python -m pip install -r requirements.txt'."
            ) from exc
        return Prophet

    @classmethod
    def _fit_model(cls, history: pd.DataFrame):
        Prophet = cls._get_prophet_class()

        # A single annual cycle is not enough evidence for yearly seasonality.
        # Enable it only after two full years of monthly observations; otherwise
        # Prophet uses its trend model without inventing an annual pattern.
        yearly_seasonality = len(history) >= 24
        model = Prophet(
            growth="linear",
            yearly_seasonality=yearly_seasonality,
            weekly_seasonality=False,
            daily_seasonality=False,
            seasonality_mode="additive",
            interval_width=0.80,
        )
        model.fit(history)
        return model

    @classmethod
    def forecast(
        cls,
        jobs: Sequence[MaintenanceJob],
        forecast_months: int = DEFAULT_FORECAST_MONTHS,
        history_months: int = DEFAULT_HISTORY_MONTHS,
        anchor_date: date | None = None,
    ) -> Dict[str, Any]:
        """Return Prophet's forecast for the requested future calendar months."""
        if forecast_months < 1 or forecast_months > 12:
            raise ValueError("forecast_months must be between 1 and 12")

        history = cls.build_monthly_history(jobs, history_months, anchor_date)
        if history["ds"].nunique() < MIN_HISTORY_MONTHS:
            raise ValueError("Insufficient monthly history for strategic forecasting")

        model = cls._fit_model(history)
        future = model.make_future_dataframe(
            periods=forecast_months,
            freq="MS",
            include_history=False,
        )
        prediction = model.predict(future)

        rows: List[Dict[str, Any]] = []
        for _, row in prediction.iterrows():
            rows.append(
                {
                    "month": pd.Timestamp(row["ds"]).strftime("%Y-%m"),
                    "forecast_jobs": int(max(0, round(float(row["yhat"])))),
                    "lower_bound": int(max(0, round(float(row["yhat_lower"])))),
                    "upper_bound": int(max(0, round(float(row["yhat_upper"])))),
                }
            )

        recent_average = float(history["y"].tail(3).mean())
        next_forecast = rows[0]["forecast_jobs"]

        return {
            "algorithm": "Prophet",
            "model_version": MODEL_VERSION,
            "forecast_granularity": "MONTHLY",
            "history_months": history_months,
            "forecast_months": forecast_months,
            "training_observations": len(history),
            "yearly_seasonality_used": len(history) >= 24,
            "target": "maintenance_jobs_created_per_month",
            "training_source": "synthetic operational job creation history",
            "recent_3_month_average": round(recent_average, 2),
            "next_month_forecast_jobs": next_forecast,
            "forecast": rows,
        }
