"""MARS maintenance priority intelligence.

The priority engine keeps the Railway-approved categorical criticality input as
its baseline, then uses a real XGBoost regressor to learn the nonlinear
interaction between criticality, overdue exposure, deferrals, corridor traffic
and the monsoon factor.

The prototype is calibrated against deterministic synthetic operational labels
because the SIH dataset does not contain historical labelled failure outcomes.
This is deliberately documented rather than presenting synthetic calibration
as field-trained railway data. The model interface is ready to be retrained
with CRIS historical outcomes when those become available.
"""

from datetime import date, datetime
from typing import List, Tuple

import numpy as np
from xgboost import XGBRegressor

from app.models.job import MaintenanceJob


BASE_CRITICALITY_MAP = {
    "CRITICAL": 90.0,
    "HIGH": 70.0,
    "MEDIUM": 50.0,
    "LOW": 30.0,
}

ALPHA_DECAY_RATES = {
    "Engineering": 0.08,
    "S&T": 0.05,
    "Traction": 0.06,
}

DEPARTMENT_FEATURES = {
    "Engineering": (1.0, 0.0, 0.0),
    "S&T": (0.0, 1.0, 0.0),
    "Traction": (0.0, 0.0, 1.0),
}

FEATURE_NAMES = [
    "base_criticality",
    "days_overdue",
    "deferral_count",
    "traffic_density",
    "monsoon_factor",
    "department_engineering",
    "department_snt",
    "department_traction",
]

MODEL_VERSION = "xgboost-priority-v1-synthetic-calibration"


class PriorityEngine:
    """Score maintenance jobs with a deterministic, real XGBoost model."""

    _model: XGBRegressor | None = None
    _training_rows: int = 0

    @staticmethod
    def calculate_days_overdue(due_date: date) -> int:
        if isinstance(due_date, datetime):
            due_date = due_date.date()
        return max(0, (date.today() - due_date).days)

    @staticmethod
    def calculate_exponential_risk(
        base_score: float, deferral_count: int, department: str
    ) -> float:
        """Exponential Risk Clock: Base * (1 + alpha)^deferrals."""
        alpha = ALPHA_DECAY_RATES.get(department, 0.05)
        escalated_score = base_score * ((1.0 + alpha) ** max(0, deferral_count))
        return min(100.0, escalated_score)

    @classmethod
    def _domain_target(
        cls,
        base_score: float,
        days_overdue: int,
        deferral_count: int,
        traffic_density: float,
        monsoon_factor: float,
        department: str,
    ) -> float:
        """Create deterministic prototype labels from the locked risk policy."""
        escalated = cls.calculate_exponential_risk(
            base_score, deferral_count, department
        )
        overdue_penalty = min(20.0, max(0, days_overdue) * 2.5)
        raw_score = (escalated + overdue_penalty) * traffic_density * monsoon_factor
        return float(np.clip(raw_score, 0.0, 100.0))

    @classmethod
    def _build_training_data(cls) -> Tuple[np.ndarray, np.ndarray]:
        """Build a reproducible calibration matrix covering the operating range."""
        rows: List[List[float]] = []
        targets: List[float] = []
        overdue_values = (0, 1, 2, 4, 7, 10, 14, 20, 30)
        deferral_values = (0, 1, 2, 3, 4)
        density_values = (1.0, 1.15)
        monsoon_values = (1.0, 1.12)

        for base_score in BASE_CRITICALITY_MAP.values():
            for department, department_flags in DEPARTMENT_FEATURES.items():
                for days_overdue in overdue_values:
                    for deferral_count in deferral_values:
                        for traffic_density in density_values:
                            for monsoon_factor in monsoon_values:
                                rows.append(
                                    [
                                        base_score,
                                        days_overdue,
                                        deferral_count,
                                        traffic_density,
                                        monsoon_factor,
                                        *department_flags,
                                    ]
                                )
                                targets.append(
                                    cls._domain_target(
                                        base_score,
                                        days_overdue,
                                        deferral_count,
                                        traffic_density,
                                        monsoon_factor,
                                        department,
                                    )
                                )

        return (
            np.asarray(rows, dtype=np.float32),
            np.asarray(targets, dtype=np.float32),
        )

    @classmethod
    def _get_model(cls) -> XGBRegressor:
        """Train the model once per backend process and reuse it for all jobs."""
        if cls._model is None:
            X, y = cls._build_training_data()
            model = XGBRegressor(
                n_estimators=180,
                max_depth=4,
                learning_rate=0.05,
                min_child_weight=1,
                subsample=0.9,
                colsample_bytree=1.0,
                objective="reg:squarederror",
                eval_metric="rmse",
                random_state=26027,
                n_jobs=1,
                tree_method="hist",
                verbosity=0,
            )
            model.fit(X, y, verbose=False)
            cls._model = model
            cls._training_rows = int(X.shape[0])
        return cls._model

    @classmethod
    def _feature_vector(cls, job: MaintenanceJob) -> np.ndarray:
        base_score = BASE_CRITICALITY_MAP.get(job.criticality_level, 50.0)
        days_overdue = cls.calculate_days_overdue(job.due_date)
        deferral_count = max(0, int(getattr(job, "deferral_count", 0)))
        traffic_density = 1.15 if "PUNE-LNL" in job.section_id else 1.0
        monsoon_factor = (
            1.12
            if datetime.now().month in (6, 7, 8, 9)
            and job.department == "Engineering"
            else 1.0
        )
        department_flags = DEPARTMENT_FEATURES.get(job.department, (0.0, 0.0, 0.0))
        return np.asarray(
            [[
                base_score,
                days_overdue,
                deferral_count,
                traffic_density,
                monsoon_factor,
                *department_flags,
            ]],
            dtype=np.float32,
        )

    @classmethod
    def model_metadata(cls) -> dict:
        """Expose model provenance for diagnostics and future UI explainability."""
        model = cls._get_model()
        return {
            "algorithm": "XGBoost Regressor",
            "model_version": MODEL_VERSION,
            "training_rows": cls._training_rows,
            "features": FEATURE_NAMES,
            "target": "priority_score_0_100",
            "training_source": "deterministic synthetic operational calibration",
        }

    @classmethod
    def score_job(cls, job: MaintenanceJob) -> MaintenanceJob:
        """Calculate the AI priority score for one maintenance job."""
        job.base_priority_score = int(
            BASE_CRITICALITY_MAP.get(job.criticality_level, 50.0)
        )
        model = cls._get_model()
        prediction = float(model.predict(cls._feature_vector(job))[0])
        job.ai_priority_score = round(float(np.clip(prediction, 0.0, 100.0)), 2)
        return job

    @classmethod
    def process_job_batch(cls, jobs: List[MaintenanceJob]) -> List[MaintenanceJob]:
        """Score and return the unified job pool in descending priority order."""
        if not jobs:
            return []

        model = cls._get_model()
        features = np.vstack([cls._feature_vector(job) for job in jobs])
        predictions = model.predict(features)

        scored_jobs: List[MaintenanceJob] = []
        for job, prediction in zip(jobs, predictions):
            job.base_priority_score = int(
                BASE_CRITICALITY_MAP.get(job.criticality_level, 50.0)
            )
            job.ai_priority_score = round(
                float(np.clip(float(prediction), 0.0, 100.0)), 2
            )
            scored_jobs.append(job)

        scored_jobs.sort(
            key=lambda item: (item.ai_priority_score or 0.0, item.job_id),
            reverse=True,
        )
        return scored_jobs
