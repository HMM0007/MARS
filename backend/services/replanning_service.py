"""MARS replanning service.

Connects the FastAPI backend to the existing dynamic and cascading
replanning engines and converts their results into API-safe data.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from backend.config import (
    ASSETS_FILE,
    BLOCKS_FILE,
    CURRENT_PLAN_FILE,
    JOBS_FILE,
    TRAIN_SCHEDULE_FILE,
    TRAIN_SECTIONS_FILE,
)
from optimizer.cp_sat.candidate_generator import CandidateGenerator
from optimizer.cp_sat.plan_validator import OptimizedPlanValidator
from optimizer.replanning.cascade_replanner import CascadeReplanner
from optimizer.replanning.disruption_models import DisruptionEvent
from optimizer.replanning.replan_optimizer import ReplanOptimizer


class ReplanningService:
    """Application service for MARS replanning."""

    def __init__(self):
        self.priority_results_path = JOBS_FILE.parent / "priority_results.csv"
        self.jobs_path = Path(JOBS_FILE)
        self.assets_path = Path(ASSETS_FILE)
        self.blocks_path = Path(BLOCKS_FILE)
        self.train_schedule_path = Path(TRAIN_SCHEDULE_FILE)
        self.train_sections_path = Path(TRAIN_SECTIONS_FILE)

    @staticmethod
    def _promote_current_plan(plan: pd.DataFrame) -> None:
        """Atomically promote a validated revised plan to current state."""
        if plan is None or plan.empty:
            raise ValueError("Cannot promote an empty plan to the current plan.")

        CURRENT_PLAN_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary_file = CURRENT_PLAN_FILE.with_name(
            f".{CURRENT_PLAN_FILE.name}.tmp"
        )
        try:
            plan.to_csv(temporary_file, index=False)
            temporary_file.replace(CURRENT_PLAN_FILE)
        except Exception:
            if temporary_file.exists():
                temporary_file.unlink()
            raise

    def _load_current_plan(self) -> pd.DataFrame:
        """Load the authoritative current active maintenance plan."""
        if not CURRENT_PLAN_FILE.exists():
            raise FileNotFoundError(
                "Current maintenance plan not found: "
                f"{CURRENT_PLAN_FILE}. Run initial optimization first."
            )
        return pd.read_csv(CURRENT_PLAN_FILE, keep_default_na=False)

    def _validator(self) -> OptimizedPlanValidator:
        """Create the independent plan validator used before promotion."""
        return OptimizedPlanValidator(
            self.jobs_path,
            self.assets_path,
            self.blocks_path,
            self.train_schedule_path,
            self.train_sections_path,
        )

    @staticmethod
    def _create_event(event_type: str, block_id: str) -> DisruptionEvent:
        """Create a validated disruption event."""
        event_type = str(event_type).strip().upper()
        block_id = str(block_id).strip()
        if not event_type:
            raise ValueError("event_type is required.")
        if not block_id:
            raise ValueError("block_id is required.")
        return DisruptionEvent(
            event_id=f"API-{event_type}-{block_id}",
            event_type=event_type,
            severity="HIGH",
            block_id=block_id,
            description=(
                "Disruption received through the MARS backend API: "
                f"{event_type} for block {block_id}."
            ),
        )

    def replan(self, event_type: str, block_id: str) -> dict:
        """Run dynamic replanning and return the public API contract."""
        current_plan = self._load_current_plan()
        event = self._create_event(event_type, block_id)

        replanner = ReplanOptimizer(
            priority_results_path=self.priority_results_path,
            jobs_path=self.jobs_path,
            assets_path=self.assets_path,
            blocks_path=self.blocks_path,
            train_schedule_path=self.train_schedule_path,
            train_sections_path=self.train_sections_path,
        )

        revised_plan, changes, summary = replanner.replan(
            current_plan=current_plan,
            event=event,
        )

        self._validator().validate(revised_plan)
        self._promote_current_plan(revised_plan)

        return {
            "event": {
                "event_type": event.event_type,
                "block_id": event.block_id,
            },
            "summary": {
                "previous_scheduled": int(summary.get("previous_scheduled_jobs", 0)),
                "revised_scheduled": int(summary.get("revised_scheduled_jobs", 0)),
                "frozen_jobs": int(summary.get("frozen_jobs", 0)),
                "released_jobs": int(summary.get("released_jobs", 0)),
                "affected_jobs": int(summary.get("affected_jobs", 0)),
                "unchanged_jobs": int(summary.get("unchanged_jobs", 0)),
                "rescheduled_jobs": int(summary.get("rescheduled_jobs", 0)),
                "dropped_jobs": int(summary.get("dropped_jobs", 0)),
                "newly_scheduled_jobs": int(summary.get("newly_scheduled_jobs", 0)),
                "schedule_stability": float(summary.get("schedule_stability", 0.0)),
                "candidate_counts": self._serialize_value(summary.get("candidate_counts", {})),
            },
            "optimization": {
                "solver_status": summary.get("solver_status"),
                "objective_values": self._serialize_value(summary.get("objective_values", {})),
            },
            "plan": self._serialize_dataframe(revised_plan),
            "changes": self._serialize_dataframe(changes),
            "current_plan_promoted": True,
        }

    def cascade_replan(self, event_type: str, block_id: str) -> dict:
        """Run cascading replanning and return the public API contract."""
        current_plan = self._load_current_plan()
        event = self._create_event(event_type, block_id)

        generator = CandidateGenerator(
            self.priority_results_path,
            self.jobs_path,
            self.assets_path,
            self.blocks_path,
            self.train_schedule_path,
            self.train_sections_path,
        )
        validator = self._validator()
        replanner = CascadeReplanner(
            candidate_generator=generator,
            validator=validator,
            max_cascade_depth=1,
            random_seed=42,
            max_time_seconds=30.0,
        )
        result = replanner.replan(
            current_plan=current_plan,
            event=event,
        )

        revised_plan = getattr(result, "plan", None)
        validator.validate(revised_plan)
        self._promote_current_plan(revised_plan)

        response = self._serialize_cascade_result(result)
        response["event"] = {
            "event_type": event.event_type,
            "block_id": event.block_id,
        }
        response["summary"] = self._cascade_summary(
            result=result,
            current_plan=current_plan,
            event=event,
            generator=generator,
        )
        response["optimization"] = {
            "solver_status": result.solver_status,
            "objective_values": self._serialize_value(result.objective_values),
        }
        response["current_plan_promoted"] = True
        return response

    @classmethod
    def _cascade_candidate_counts(
        cls,
        result,
        current_plan: pd.DataFrame,
        event: DisruptionEvent,
        generator: CandidateGenerator,
    ) -> dict[str, int]:
        """Report the actual usable candidate windows for reconsidered jobs."""
        cascade_group = getattr(result, "cascade_group", None)
        if cascade_group is None:
            return {}

        job_ids = {str(job_id) for job_id in getattr(cascade_group, "job_ids", [])}
        if not job_ids:
            return {}

        _, _, _, raw_candidates, _ = generator.generate()
        cascade_candidates = [
            candidate
            for candidate in raw_candidates
            if str(candidate.job_id) in job_ids
        ]

        if str(event.event_type).upper() == "BLOCK_UNAVAILABLE":
            event_block = str(getattr(event, "block_id", ""))
            cascade_candidates = [
                candidate
                for candidate in cascade_candidates
                if str(candidate.block_id) != event_block
            ]

        frozen_ids = {
            str(job_id)
            for job_id in getattr(cascade_group, "frozen_job_ids", [])
        }
        frozen_plan = current_plan[
            current_plan.job_id.astype(str).isin(frozen_ids)
        ].copy()

        usable_candidates = CascadeReplanner._remove_frozen_conflicts(
            cascade_candidates,
            frozen_plan,
        )

        counts = {job_id: 0 for job_id in sorted(job_ids)}
        for candidate in usable_candidates:
            job_id = str(candidate.job_id)
            if job_id in counts:
                counts[job_id] += 1

        return counts

    @classmethod
    def _cascade_summary(
        cls,
        result,
        current_plan: pd.DataFrame | None = None,
        event: DisruptionEvent | None = None,
        generator: CandidateGenerator | None = None,
    ) -> dict:
        """Build the schema-compatible cascade summary."""
        changes = getattr(result, "changes", None)
        graph = getattr(result, "impact_graph", None)
        graph_df = graph.to_dataframe() if graph is not None else pd.DataFrame()

        if changes is None or changes.empty:
            return {
                "previous_scheduled": 0,
                "revised_scheduled": 0,
                "frozen_jobs": 0,
                "released_jobs": 0,
                "affected_jobs": 0,
                "unchanged_jobs": 0,
                "rescheduled_jobs": 0,
                "dropped_jobs": 0,
                "newly_scheduled_jobs": 0,
                "schedule_stability": 0.0,
                "candidate_counts": {},
            }

        types = changes["change_type"].astype(str).str.upper()
        old_scheduled = changes["previous_status"].astype(str).str.upper().eq("SCHEDULED")
        new_scheduled = changes["new_status"].astype(str).str.upper().eq("SCHEDULED")
        previous_scheduled = int(old_scheduled.sum())
        revised_scheduled = int(new_scheduled.sum())

        impact = graph_df.get("impact_type", pd.Series(dtype=str)).astype(str).str.upper()
        affected = len(getattr(getattr(result, "cascade_group", None), "job_ids", []))

        previous_blocks = changes["previous_block"].astype(str)
        new_blocks = changes["new_block"].astype(str)
        previous_starts = pd.to_datetime(
            changes["previous_start"],
            errors="coerce",
        )
        new_starts = pd.to_datetime(
            changes["new_start"],
            errors="coerce",
        )
        unchanged_assignment = (
            old_scheduled
            & new_scheduled
            & previous_blocks.eq(new_blocks)
            & previous_starts.eq(new_starts)
        )
        stable_scheduled = int(unchanged_assignment.sum())

        candidate_counts = {}
        if current_plan is not None and event is not None and generator is not None:
            candidate_counts = cls._cascade_candidate_counts(
                result=result,
                current_plan=current_plan,
                event=event,
                generator=generator,
            )

        return {
            "previous_scheduled": previous_scheduled,
            "revised_scheduled": revised_scheduled,
            "frozen_jobs": len(
                getattr(getattr(result, "cascade_group", None), "frozen_job_ids", [])
            ),
            "released_jobs": affected,
            "affected_jobs": affected,
            "unchanged_jobs": stable_scheduled,
            "rescheduled_jobs": int((types == "RESCHEDULED").sum()),
            "dropped_jobs": int((types == "DROPPED").sum()),
            "newly_scheduled_jobs": int((types == "NEWLY_SCHEDULED").sum()),
            "schedule_stability": (
                stable_scheduled / previous_scheduled
                if previous_scheduled else 0.0
            ),
            "candidate_counts": candidate_counts,
        }

    @classmethod
    def _serialize_value(cls, value):
        """Convert pandas/numpy/Python values into JSON-safe values."""
        if value is None:
            return None
        if isinstance(value, pd.Timestamp):
            return value.isoformat()
        if isinstance(value, np.generic):
            return cls._serialize_value(value.item())
        if isinstance(value, np.ndarray):
            return [cls._serialize_value(v) for v in value.tolist()]
        if isinstance(value, float) and pd.isna(value):
            return None
        if isinstance(value, dict):
            return {str(k): cls._serialize_value(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set, frozenset)):
            values = list(value)
            if isinstance(value, (set, frozenset)):
                values = sorted(values, key=str)
            return [cls._serialize_value(v) for v in values]
        return value

    @classmethod
    def _serialize_dataframe(cls, dataframe: pd.DataFrame | None) -> list[dict]:
        """Convert a DataFrame into JSON-safe records."""
        if dataframe is None or dataframe.empty:
            return []
        cleaned = dataframe.copy()
        for column in cleaned.columns:
            cleaned[column] = cleaned[column].map(
                lambda value: value.isoformat() if isinstance(value, pd.Timestamp) else value
            )
        cleaned = cleaned.where(pd.notna(cleaned), None)
        return [
            {str(key): cls._serialize_value(value) for key, value in record.items()}
            for record in cleaned.to_dict(orient="records")
        ]

    @classmethod
    def _serialize_cascade_result(cls, result) -> dict:
        """Serialize CascadeResult for the API."""
        response = {
            "plan": cls._serialize_dataframe(getattr(result, "plan", None)),
            "changes": cls._serialize_dataframe(getattr(result, "changes", None)),
            "impact_graph": [],
            "cascade": {
                "cascade_depth": 0,
                "direct_jobs": 0,
                "indirect_jobs": 0,
                "reconsidered_jobs": 0,
                "frozen_jobs": 0,
            },
        }

        impact_graph = getattr(result, "impact_graph", None)
        if impact_graph is not None:
            response["impact_graph"] = cls._serialize_dataframe(
                impact_graph.to_dataframe()
            )

        cascade_group = getattr(result, "cascade_group", None)
        if cascade_group is not None:
            graph_df = (
                impact_graph.to_dataframe()
                if impact_graph is not None
                else pd.DataFrame()
            )
            impact = graph_df.get("impact_type", pd.Series(dtype=str)).astype(str).str.upper()
            direct = int((impact == "DIRECT").sum())
            indirect = int((impact == "INDIRECT").sum())
            response["cascade"] = {
                "cascade_depth": int(getattr(cascade_group, "max_depth", 0) or 0),
                "direct_jobs": direct,
                "indirect_jobs": indirect,
                "reconsidered_jobs": len(getattr(cascade_group, "job_ids", [])),
                "frozen_jobs": len(getattr(cascade_group, "frozen_job_ids", [])),
            }

        return response
