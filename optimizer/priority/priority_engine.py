from pathlib import Path
from datetime import datetime
from typing import Optional

import pandas as pd


class PriorityEngine:
    """
    MARS Priority Engine

    Calculates a transparent 0-100 priority score for each
    pending maintenance job.

    Score:
        35% -> Job Priority
        30% -> Asset Criticality
        25% -> Deadline Urgency
        10% -> Job Age
    """

    WEIGHTS = {
        "job_priority": 0.35,
        "asset_criticality": 0.30,
        "deadline_urgency": 0.25,
        "job_age": 0.10,
    }

    PRIORITY_MAP = {
        "LOW": 25,
        "MEDIUM": 50,
        "HIGH": 75,
        "CRITICAL": 100,
    }

    STATUS_EXCLUDED = {
        "COMPLETED",
        "CANCELLED",
        "CLOSED",
    }

    def __init__(
        self,
        jobs_path: str,
        assets_path: str,
        reference_date: Optional[str] = None,
    ):
        self.jobs_path = Path(jobs_path)
        self.assets_path = Path(assets_path)

        if reference_date:
            self.reference_date = pd.Timestamp(reference_date)
        else:
            self.reference_date = pd.Timestamp.now().normalize()

    # ---------------------------------------------------------
    # DATA LOADING
    # ---------------------------------------------------------

    def load_data(self):
        """Load maintenance jobs and asset data."""

        if not self.jobs_path.exists():
            raise FileNotFoundError(
                f"Maintenance jobs file not found: {self.jobs_path}"
            )

        if not self.assets_path.exists():
            raise FileNotFoundError(
                f"Assets file not found: {self.assets_path}"
            )

        jobs = pd.read_csv(self.jobs_path)
        assets = pd.read_csv(self.assets_path)

        self._validate_columns(jobs, assets)

        return jobs, assets

    # ---------------------------------------------------------
    # VALIDATION
    # ---------------------------------------------------------

    @staticmethod
    def _validate_columns(jobs: pd.DataFrame, assets: pd.DataFrame):
        """Validate required columns."""

        required_job_columns = {
            "job_id",
            "asset_id",
            "priority",
            "deadline",
            "status",
            "created_date",
        }

        required_asset_columns = {
            "asset_id",
            "criticality",
        }

        missing_jobs = required_job_columns - set(jobs.columns)
        missing_assets = required_asset_columns - set(assets.columns)

        if missing_jobs:
            raise ValueError(
                f"Missing columns in maintenance_jobs.csv: "
                f"{sorted(missing_jobs)}"
            )

        if missing_assets:
            raise ValueError(
                f"Missing columns in assets.csv: "
                f"{sorted(missing_assets)}"
            )

    # ---------------------------------------------------------
    # NORMALIZATION
    # ---------------------------------------------------------

    @staticmethod
    def normalize_priority(value) -> float:
        """
        Convert job priority to a 0-100 score.

        Supports:
            LOW
            MEDIUM
            HIGH
            CRITICAL

        Also accepts numeric values.
        """

        if pd.isna(value):
            return 0.0

        # Numeric priority
        if isinstance(value, (int, float)):
            return float(max(0, min(100, value)))

        value = str(value).strip().upper()

        if value in PriorityEngine.PRIORITY_MAP:
            return float(PriorityEngine.PRIORITY_MAP[value])

        # Try numeric string
        try:
            numeric_value = float(value)
            return float(max(0, min(100, numeric_value)))
        except ValueError:
            return 0.0

    @staticmethod
    def normalize_criticality(value) -> float:
        """
        Convert asset criticality to a 0-100 score.

        Supports:
            LOW
            MEDIUM
            HIGH
            CRITICAL

        Also accepts numeric values.
        """

        if pd.isna(value):
            return 0.0

        if isinstance(value, (int, float)):
            return float(max(0, min(100, value)))

        value = str(value).strip().upper()

        if value in PriorityEngine.PRIORITY_MAP:
            return float(PriorityEngine.PRIORITY_MAP[value])

        try:
            numeric_value = float(value)
            return float(max(0, min(100, numeric_value)))
        except ValueError:
            return 0.0

    # ---------------------------------------------------------
    # DEADLINE URGENCY
    # ---------------------------------------------------------

    def calculate_deadline_urgency(self, deadline) -> float:
        """
        Calculate deadline urgency on a 0-100 scale.

        Earlier deadlines receive higher urgency.

        Rules:
            Overdue             -> 100
            Today               -> 100
            1-2 days            -> 90
            3-5 days            -> 75
            6-10 days           -> 60
            11-20 days          -> 40
            21-30 days          -> 25
            >30 days            -> 10
        """

        if pd.isna(deadline):
            return 0.0

        deadline = pd.Timestamp(deadline)

        days_remaining = (deadline.normalize() - self.reference_date).days

        if days_remaining <= 0:
            return 100.0
        elif days_remaining <= 2:
            return 90.0
        elif days_remaining <= 5:
            return 75.0
        elif days_remaining <= 10:
            return 60.0
        elif days_remaining <= 20:
            return 40.0
        elif days_remaining <= 30:
            return 25.0
        else:
            return 10.0

    # ---------------------------------------------------------
    # JOB AGE
    # ---------------------------------------------------------

    def calculate_job_age(self, created_date, max_age_days: float) -> float:
        """
        Calculate job age on a 0-100 scale.

        Older jobs receive higher scores.

        max_age_days is used as the normalization reference
        for the current dataset.
        """

        if pd.isna(created_date):
            return 0.0

        created_date = pd.Timestamp(created_date)

        age_days = max(
            0,
            (self.reference_date - created_date.normalize()).days
        )

        if max_age_days <= 0:
            return 0.0

        score = (age_days / max_age_days) * 100

        return float(max(0, min(100, score)))

    # ---------------------------------------------------------
    # MAIN CALCULATION
    # ---------------------------------------------------------

    def calculate_scores(self) -> pd.DataFrame:
        """
        Load data, calculate all component scores,
        calculate final priority score, and rank jobs.
        """

        jobs, assets = self.load_data()

        # -----------------------------------------------------
        # Keep only active/pending jobs
        # -----------------------------------------------------

        jobs["status"] = jobs["status"].astype(str).str.upper().str.strip()

        jobs = jobs[
            ~jobs["status"].isin(self.STATUS_EXCLUDED)
        ].copy()

        if jobs.empty:
            raise ValueError("No active maintenance jobs found.")

        # -----------------------------------------------------
        # Merge asset criticality
        # -----------------------------------------------------

        asset_data = assets[
            ["asset_id", "criticality"]
        ].copy()

        asset_data = asset_data.rename(
            columns={
                "criticality": "asset_criticality"
            }
        )

        jobs = jobs.merge(
            asset_data,
            on="asset_id",
            how="left",
        )

        # -----------------------------------------------------
        # Convert dates
        # -----------------------------------------------------

        jobs["deadline"] = pd.to_datetime(
            jobs["deadline"],
            errors="coerce"
        )

        jobs["created_date"] = pd.to_datetime(
            jobs["created_date"],
            errors="coerce"
        )

        # -----------------------------------------------------
        # Component scores
        # -----------------------------------------------------

        jobs["job_priority_score"] = jobs["priority"].apply(
            self.normalize_priority
        )

        jobs["asset_criticality_score"] = jobs[
            "asset_criticality"
        ].apply(
            self.normalize_criticality
        )

        jobs["deadline_urgency_score"] = jobs[
            "deadline"
        ].apply(
            self.calculate_deadline_urgency
        )

        # Find oldest active job
        age_days = (
            self.reference_date
            - jobs["created_date"].dt.normalize()
        ).dt.days

        age_days = age_days.clip(lower=0)

        max_age_days = age_days.max()

        jobs["job_age_score"] = jobs[
            "created_date"
        ].apply(
            lambda date: self.calculate_job_age(
                date,
                max_age_days
            )
        )

        # -----------------------------------------------------
        # Weighted priority score
        # -----------------------------------------------------

        jobs["priority_score"] = (
            jobs["job_priority_score"]
            * self.WEIGHTS["job_priority"]
            +
            jobs["asset_criticality_score"]
            * self.WEIGHTS["asset_criticality"]
            +
            jobs["deadline_urgency_score"]
            * self.WEIGHTS["deadline_urgency"]
            +
            jobs["job_age_score"]
            * self.WEIGHTS["job_age"]
        )

        # Round for clean output
        jobs["priority_score"] = jobs[
            "priority_score"
        ].round(2)

        jobs["job_priority_score"] = jobs[
            "job_priority_score"
        ].round(2)

        jobs["asset_criticality_score"] = jobs[
            "asset_criticality_score"
        ].round(2)

        jobs["deadline_urgency_score"] = jobs[
            "deadline_urgency_score"
        ].round(2)

        jobs["job_age_score"] = jobs[
            "job_age_score"
        ].round(2)

        # -----------------------------------------------------
        # Rank jobs
        # -----------------------------------------------------

        jobs = jobs.sort_values(
            by=[
                "priority_score",
                "deadline",
            ],
            ascending=[
                False,
                True,
            ],
        ).reset_index(drop=True)

        jobs["priority_rank"] = (
            jobs["priority_score"]
            .rank(
                method="min",
                ascending=False
            )
            .astype(int)
        )

        # -----------------------------------------------------
        # Final output
        # -----------------------------------------------------

        output_columns = [
            "job_id",
            "job_priority_score",
            "asset_criticality_score",
            "deadline_urgency_score",
            "job_age_score",
            "priority_score",
            "priority_rank",
        ]

        return jobs[output_columns]

    # ---------------------------------------------------------
    # SAVE RESULTS
    # ---------------------------------------------------------

    def save_results(
        self,
        output_path: str = "data/sample/priority_results.csv"
    ):
        """Calculate and save priority results."""

        results = self.calculate_scores()

        output_file = Path(output_path)
        output_file.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        results.to_csv(
            output_file,
            index=False
        )

        return results


# -------------------------------------------------------------
# COMMAND-LINE EXECUTION
# -------------------------------------------------------------

if __name__ == "__main__":

    BASE_DIR = Path(__file__).resolve().parents[2]

    jobs_path = (
        BASE_DIR
        / "data"
        / "sample"
        / "maintenance_jobs.csv"
    )

    assets_path = (
        BASE_DIR
        / "data"
        / "sample"
        / "assets.csv"
    )

    output_path = (
        BASE_DIR
        / "data"
        / "sample"
        / "priority_results.csv"
    )

    engine = PriorityEngine(
        jobs_path=jobs_path,
        assets_path=assets_path,
    )

    results = engine.save_results(
        output_path=output_path
    )

    print("=" * 70)
    print("MARS PRIORITY ENGINE")
    print("=" * 70)

    print(f"Jobs processed : {len(results)}")
    print(f"Output         : {output_path}")

    print("\nTop priority jobs:")
    print(
        results.head(10).to_string(index=False)
    )

    print("\n" + "=" * 70)
    print("✅ PRIORITY ENGINE COMPLETED")
    print("=" * 70)