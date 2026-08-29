"""Railway-aware deterministic heuristic for an initial maintenance plan.

This module constructs a feasible starting plan for a later optimizer.  It is
deliberately greedy and explainable; it does not attempt to solve the CP-SAT
optimization problem.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd


@dataclass(frozen=True)
class TimeInterval:
    """A half-open datetime interval: [start, end)."""

    start: pd.Timestamp
    end: pd.Timestamp

    def overlaps(self, other: "TimeInterval") -> bool:
        return self.start < other.end and other.start < self.end


class RailwayAwareHeuristic:
    """Build an initial feasible maintenance plan from MARS Dataset V1."""

    ACTIVE_STATUS_EXCLUDED = {"COMPLETED", "CANCELLED", "CLOSED"}
    OUTPUT_COLUMNS = [
        "job_id",
        "plan_status",
        "priority_rank",
        "priority_score",
        "asset_id",
        "section_id",
        "department",
        "work_type",
        "duration_min",
        "deadline",
        "block_id",
        "block_date",
        "scheduled_start",
        "scheduled_end",
        "block_type",
        "block_restrictions",
        "block_isolation_required",
        "train_conflict_checked",
        "scheduling_reason_code",
        "scheduling_reason_detail",
    ]

    REQUIRED_COLUMNS = {
        "priority": {"job_id", "priority_rank", "priority_score"},
        "jobs": {
            "job_id", "asset_id", "department", "work_type", "duration_min",
            "deadline", "status", "isolation_required",
        },
        "assets": {"asset_id", "section_id"},
        "blocks": {
            "block_id", "section_id", "block_date", "start_time", "end_time",
            "duration_min", "status", "block_type", "restrictions",
            "isolation_required",
        },
        "train_schedule": {"train_id", "schedule_date", "status"},
        "train_sections": {
            "train_section_id", "train_id", "section_id", "sequence",
            "arrival_time", "departure_time",
        },
    }

    RESTRICTION_DEPARTMENTS = {
        "ENGINEERING WORK ONLY": {"ENGINEERING"},
        "OHE WORK ONLY": {"TRACTION"},
        "NONE": None,
        "LIMITED SPEED": None,
    }

    def __init__(
        self,
        priority_results_path: str | Path,
        maintenance_jobs_path: str | Path,
        assets_path: str | Path,
        block_availability_path: str | Path,
        train_schedule_path: str | Path,
        train_sections_path: str | Path,
        output_path: str | Path | None = None,
    ):
        self.priority_results_path = Path(priority_results_path)
        self.maintenance_jobs_path = Path(maintenance_jobs_path)
        self.assets_path = Path(assets_path)
        self.block_availability_path = Path(block_availability_path)
        self.train_schedule_path = Path(train_schedule_path)
        self.train_sections_path = Path(train_sections_path)
        self.output_path = Path(output_path) if output_path else None

    @staticmethod
    def _read_csv(path: Path, label: str) -> pd.DataFrame:
        if not path.exists():
            raise FileNotFoundError(f"{label} file not found: {path}")
        # Dataset V1 uses the literal string "None" as a block restriction.
        return pd.read_csv(path, keep_default_na=False)

    @classmethod
    def _require_columns(cls, frame: pd.DataFrame, label: str) -> None:
        missing = cls.REQUIRED_COLUMNS[label] - set(frame.columns)
        if missing:
            raise ValueError(f"Missing {label} columns: {sorted(missing)}")

    @staticmethod
    def _require_unique(frame: pd.DataFrame, column: str, label: str) -> None:
        duplicates = frame.loc[frame[column].duplicated(), column].tolist()
        if duplicates:
            raise ValueError(f"Duplicate {column} values in {label}: {duplicates}")

    @staticmethod
    def _timestamp(date_value: object, time_value: object) -> pd.Timestamp:
        value = pd.to_datetime(f"{date_value} {time_value}", errors="coerce")
        if pd.isna(value):
            raise ValueError(f"Invalid date/time: {date_value} {time_value}")
        return pd.Timestamp(value)

    @classmethod
    def normalize_interval(
        cls, date_value: object, start_time: object, end_time: object
    ) -> TimeInterval:
        """Return an interval, rolling end into the next day when needed."""
        start = cls._timestamp(date_value, start_time)
        end = cls._timestamp(date_value, end_time)
        if end <= start:
            end += pd.Timedelta(days=1)
        return TimeInterval(start=start, end=end)

    @classmethod
    def normalize_train_intervals(
        cls, train_schedule: pd.DataFrame, train_sections: pd.DataFrame
    ) -> pd.DataFrame:
        """Attach real datetimes to ordered train-section movements.

        ``train_sections`` stores only times.  Dates are reconstructed from
        ``schedule_date`` and sequence order, advancing the operating day when
        a later leg wraps past midnight.
        """
        merged = train_sections.merge(
            train_schedule[["train_id", "schedule_date", "status"]],
            on="train_id",
            how="left",
            validate="many_to_one",
        )
        if merged["schedule_date"].isna().any():
            missing = merged.loc[merged["schedule_date"].isna(), "train_id"].unique()
            raise ValueError(f"Train sections without schedule records: {sorted(missing)}")

        normalized: list[dict] = []
        for train_id, group in merged.sort_values(["train_id", "sequence"]).groupby("train_id"):
            previous_end: pd.Timestamp | None = None
            for row in group.to_dict("records"):
                start = cls._timestamp(row["schedule_date"], row["arrival_time"])
                while previous_end is not None and start < previous_end:
                    start += pd.Timedelta(days=1)

                end = cls._timestamp(start.date(), row["departure_time"])
                if end <= start:
                    end += pd.Timedelta(days=1)

                normalized.append(
                    {
                        "train_section_id": row["train_section_id"],
                        "train_id": train_id,
                        "section_id": row["section_id"],
                        "start": start,
                        "end": end,
                    }
                )
                previous_end = end

        return pd.DataFrame(
            normalized,
            columns=["train_section_id", "train_id", "section_id", "start", "end"],
        )

    def load_data(self) -> dict[str, pd.DataFrame]:
        """Load inputs and validate their structural contract."""
        data = {
            "priority": self._read_csv(self.priority_results_path, "Priority results"),
            "jobs": self._read_csv(self.maintenance_jobs_path, "Maintenance jobs"),
            "assets": self._read_csv(self.assets_path, "Assets"),
            "blocks": self._read_csv(self.block_availability_path, "Block availability"),
            "train_schedule": self._read_csv(self.train_schedule_path, "Train schedule"),
            "train_sections": self._read_csv(self.train_sections_path, "Train sections"),
        }
        for label, frame in data.items():
            self._require_columns(frame, label)

        self._require_unique(data["priority"], "job_id", "priority results")
        self._require_unique(data["jobs"], "job_id", "maintenance jobs")
        self._require_unique(data["assets"], "asset_id", "assets")
        self._require_unique(data["blocks"], "block_id", "block availability")
        self._require_unique(data["train_schedule"], "train_id", "train schedule")
        self._require_unique(data["train_sections"], "train_section_id", "train sections")

        data["jobs"]["status"] = data["jobs"]["status"].astype(str).str.upper().str.strip()
        active_jobs = data["jobs"].loc[
            ~data["jobs"]["status"].isin(self.ACTIVE_STATUS_EXCLUDED)
        ].copy()
        priority_counts = data["priority"]["job_id"].value_counts()
        invalid_priority = active_jobs.loc[
            active_jobs["job_id"].map(priority_counts).fillna(0).ne(1), "job_id"
        ].tolist()
        if invalid_priority:
            raise ValueError(
                "Every active job must have exactly one priority result: "
                f"{invalid_priority}"
            )
        data["active_jobs"] = active_jobs
        return data

    @staticmethod
    def _restriction_allows(department: object, restriction: object) -> bool:
        allowed = RailwayAwareHeuristic.RESTRICTION_DEPARTMENTS.get(
            str(restriction).upper().strip()
        )
        if str(restriction).upper().strip() not in RailwayAwareHeuristic.RESTRICTION_DEPARTMENTS:
            return False
        return allowed is None or str(department).upper().strip() in allowed

    @staticmethod
    def _subtract_intervals(
        interval: TimeInterval, exclusions: Iterable[TimeInterval]
    ) -> list[TimeInterval]:
        """Subtract overlapping half-open intervals from an interval."""
        remaining = [interval]
        for exclusion in sorted(exclusions, key=lambda item: item.start):
            next_remaining: list[TimeInterval] = []
            for candidate in remaining:
                if not candidate.overlaps(exclusion):
                    next_remaining.append(candidate)
                    continue
                if candidate.start < exclusion.start:
                    next_remaining.append(TimeInterval(candidate.start, exclusion.start))
                if exclusion.end < candidate.end:
                    next_remaining.append(TimeInterval(exclusion.end, candidate.end))
            remaining = next_remaining
        return remaining

    @staticmethod
    def _fits(intervals: Iterable[TimeInterval], duration_min: int) -> bool:
        duration = pd.Timedelta(minutes=duration_min)
        return any(interval.end - interval.start >= duration for interval in intervals)

    @staticmethod
    def _format_timestamp(value: pd.Timestamp | None) -> str:
        return "" if value is None else value.strftime("%Y-%m-%d %H:%M")

    def _unscheduled_row(
        self, job: pd.Series, reason_code: str, reason_detail: str
    ) -> dict:
        deadline = job["deadline"]
        if not pd.isna(deadline):
            deadline = pd.Timestamp(deadline).strftime("%Y-%m-%d")
        return {
            "job_id": job["job_id"],
            "plan_status": "UNSCHEDULED",
            "priority_rank": job["priority_rank"],
            "priority_score": job["priority_score"],
            "asset_id": job["asset_id"],
            "section_id": job.get("section_id", ""),
            "department": job["department"],
            "work_type": job["work_type"],
            "duration_min": job["duration_min"],
            "deadline": deadline,
            "block_id": "",
            "block_date": "",
            "scheduled_start": "",
            "scheduled_end": "",
            "block_type": "",
            "block_restrictions": "",
            "block_isolation_required": "",
            "train_conflict_checked": False,
            "scheduling_reason_code": reason_code,
            "scheduling_reason_detail": reason_detail,
        }

    def build_plan(self) -> pd.DataFrame:
        """Build one scheduled or unscheduled plan row for every active job."""
        data = self.load_data()
        jobs = data["active_jobs"].merge(
            data["priority"][["job_id", "priority_rank", "priority_score"]],
            on="job_id",
            how="left",
            validate="one_to_one",
        ).merge(
            data["assets"][["asset_id", "section_id"]],
            on="asset_id",
            how="left",
            validate="many_to_one",
        )

        jobs["deadline"] = pd.to_datetime(jobs["deadline"], errors="coerce")
        jobs["duration_min"] = pd.to_numeric(jobs["duration_min"], errors="coerce")
        blocks = data["blocks"].copy()
        blocks["interval"] = blocks.apply(
            lambda row: self.normalize_interval(row["block_date"], row["start_time"], row["end_time"]),
            axis=1,
        )
        train_intervals = self.normalize_train_intervals(
            data["train_schedule"], data["train_sections"]
        )

        jobs = jobs.sort_values(
            ["priority_rank", "priority_score", "deadline", "duration_min", "job_id"],
            ascending=[True, False, True, False, True],
            kind="mergesort",
        )
        reservations: dict[str, list[TimeInterval]] = {}
        output: list[dict] = []

        for _, job in jobs.iterrows():
            if pd.isna(job["section_id"]) or pd.isna(job["deadline"]) or pd.isna(job["duration_min"]):
                output.append(self._unscheduled_row(job, "INVALID_INPUT", "Missing asset section, deadline, or duration."))
                continue
            duration = int(job["duration_min"])
            if duration <= 0:
                output.append(self._unscheduled_row(job, "INVALID_INPUT", "Maintenance duration must be positive."))
                continue

            section_blocks = blocks.loc[
                (blocks["section_id"] == job["section_id"])
                & (blocks["status"].astype(str).str.upper().str.strip() == "AVAILABLE")
            ].copy()
            if section_blocks.empty:
                output.append(self._unscheduled_row(job, "NO_SECTION_BLOCK", "No available maintenance block exists on the asset section."))
                continue

            deadline_end = pd.Timestamp(job["deadline"]).normalize() + pd.Timedelta(days=1)
            deadline_blocks = section_blocks.loc[
                section_blocks["interval"].apply(lambda interval: interval.end <= deadline_end)
            ].copy()
            if deadline_blocks.empty:
                output.append(self._unscheduled_row(job, "BLOCK_AFTER_DEADLINE", "No available section block ends by the job deadline."))
                continue

            restriction_blocks = deadline_blocks.loc[
                deadline_blocks.apply(
                    lambda block: self._restriction_allows(job["department"], block["restrictions"]),
                    axis=1,
                )
            ].copy()
            if restriction_blocks.empty:
                output.append(self._unscheduled_row(job, "RESTRICTION_INCOMPATIBLE", "No deadline-compatible block permits this department's work."))
                continue

            needs_isolation = str(job["isolation_required"]).upper().strip() == "YES"
            if needs_isolation:
                isolation_blocks = restriction_blocks.loc[
                    restriction_blocks["isolation_required"].astype(str).str.upper().str.strip() == "YES"
                ].copy()
            else:
                isolation_blocks = restriction_blocks.copy()
            if isolation_blocks.empty:
                output.append(self._unscheduled_row(job, "ISOLATION_UNAVAILABLE", "No compatible block provides the required isolation."))
                continue

            section_trains = [
                TimeInterval(row.start, row.end)
                for row in train_intervals.loc[train_intervals["section_id"] == job["section_id"]].itertuples()
            ]
            candidates = (
                isolation_blocks.assign(
                    _block_start=isolation_blocks["interval"].map(lambda interval: interval.start)
                )
                .sort_values(["_block_start", "block_id"], kind="mergesort")
            )
            raw_fits = False
            train_fits = False
            selection: tuple[pd.Series, TimeInterval] | None = None

            for _, block in candidates.iterrows():
                block_interval: TimeInterval = block["interval"]
                raw_fits = raw_fits or self._fits([block_interval], duration)
                after_trains = self._subtract_intervals(block_interval, section_trains)
                train_fits = train_fits or self._fits(after_trains, duration)
                free_intervals = self._subtract_intervals(
                    block_interval,
                    [*section_trains, *reservations.get(job["section_id"], [])],
                )
                fitting = next(
                    (
                        interval for interval in free_intervals
                        if interval.end - interval.start >= pd.Timedelta(minutes=duration)
                    ),
                    None,
                )
                if fitting is not None:
                    selection = (block, TimeInterval(fitting.start, fitting.start + pd.Timedelta(minutes=duration)))
                    break

            if selection is None:
                if not raw_fits:
                    reason = "INSUFFICIENT_CONTIGUOUS_CAPACITY"
                    detail = "No compatible block is long enough for the maintenance duration."
                elif not train_fits:
                    reason = "TRAIN_CONFLICT"
                    detail = "Scheduled train movements leave no contiguous maintenance interval."
                else:
                    reason = "INSUFFICIENT_CONTIGUOUS_CAPACITY"
                    detail = "Existing maintenance reservations leave no contiguous interval."
                row = self._unscheduled_row(job, reason, detail)
                row["train_conflict_checked"] = True
                output.append(row)
                continue

            block, scheduled_interval = selection
            reservations.setdefault(job["section_id"], []).append(scheduled_interval)
            output.append(
                {
                    "job_id": job["job_id"],
                    "plan_status": "SCHEDULED",
                    "priority_rank": job["priority_rank"],
                    "priority_score": job["priority_score"],
                    "asset_id": job["asset_id"],
                    "section_id": job["section_id"],
                    "department": job["department"],
                    "work_type": job["work_type"],
                    "duration_min": duration,
                    "deadline": pd.Timestamp(job["deadline"]).strftime("%Y-%m-%d"),
                    "block_id": block["block_id"],
                    "block_date": block["block_date"],
                    "scheduled_start": self._format_timestamp(scheduled_interval.start),
                    "scheduled_end": self._format_timestamp(scheduled_interval.end),
                    "block_type": block["block_type"],
                    "block_restrictions": block["restrictions"],
                    "block_isolation_required": block["isolation_required"],
                    "train_conflict_checked": True,
                    "scheduling_reason_code": "SCHEDULED",
                    "scheduling_reason_detail": "Scheduled in the earliest feasible interval for its deterministic priority order.",
                }
            )

        return pd.DataFrame(output, columns=self.OUTPUT_COLUMNS)

    def save_plan(self, output_path: str | Path | None = None) -> pd.DataFrame:
        """Build and write the plan to an explicit output path."""
        target = Path(output_path) if output_path else self.output_path
        if target is None:
            raise ValueError("An output path is required to save the initial plan.")
        plan = self.build_plan()
        target.parent.mkdir(parents=True, exist_ok=True)
        plan.to_csv(target, index=False)
        return plan


if __name__ == "__main__":
    BASE_DIR = Path(__file__).resolve().parents[2]
    heuristic = RailwayAwareHeuristic(
        priority_results_path=BASE_DIR / "data" / "sample" / "priority_results.csv",
        maintenance_jobs_path=BASE_DIR / "data" / "sample" / "maintenance_jobs.csv",
        assets_path=BASE_DIR / "data" / "sample" / "assets.csv",
        block_availability_path=BASE_DIR / "data" / "sample" / "block_availability.csv",
        train_schedule_path=BASE_DIR / "data" / "sample" / "train_schedule.csv",
        train_sections_path=BASE_DIR / "data" / "sample" / "train_sections.csv",
        output_path=BASE_DIR / "data" / "output" / "initial_maintenance_plan.csv",
    )
    plan = heuristic.save_plan()
    print(f"Initial plan written: {heuristic.output_path}")
    print(f"Scheduled: {(plan['plan_status'] == 'SCHEDULED').sum()}")
    print(f"Unscheduled: {(plan['plan_status'] == 'UNSCHEDULED').sum()}")
