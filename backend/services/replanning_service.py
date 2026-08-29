"""MARS replanning service.

Connects the FastAPI backend to the existing MARS dynamic
and cascading replanning engines.

This service contains no optimization logic.
It only prepares inputs, invokes the existing engines,
and converts their results into API-safe JSON data.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from backend.config import (
    ASSETS_FILE,
    BLOCKS_FILE,
    JOBS_FILE,
    OPTIMIZED_PLAN_FILE,
    TRAIN_SCHEDULE_FILE,
    TRAIN_SECTIONS_FILE,
)

from optimizer.cp_sat.candidate_generator import (
    CandidateGenerator,
)

from optimizer.cp_sat.plan_validator import (
    OptimizedPlanValidator,
)

from optimizer.replanning.cascade_replanner import (
    CascadeReplanner,
)

from optimizer.replanning.disruption_models import (
    DisruptionEvent,
)

from optimizer.replanning.replan_optimizer import (
    ReplanOptimizer,
)


class ReplanningService:
    """Application service for MARS replanning."""

    def __init__(self):
        """Initialize dataset paths."""

        self.priority_results_path = (
            JOBS_FILE.parent
            / "priority_results.csv"
        )

        self.jobs_path = Path(JOBS_FILE)
        self.assets_path = Path(ASSETS_FILE)
        self.blocks_path = Path(BLOCKS_FILE)

        self.train_schedule_path = Path(
            TRAIN_SCHEDULE_FILE
        )

        self.train_sections_path = Path(
            TRAIN_SECTIONS_FILE
        )

    # ============================================================
    # CURRENT PLAN
    # ============================================================

    def _load_current_plan(self) -> pd.DataFrame:
        """Load the latest optimized maintenance plan."""

        if not OPTIMIZED_PLAN_FILE.exists():
            raise FileNotFoundError(
                "Optimized maintenance plan not found: "
                f"{OPTIMIZED_PLAN_FILE}"
            )

        return pd.read_csv(
            OPTIMIZED_PLAN_FILE,
            keep_default_na=False,
        )

    # ============================================================
    # EVENT CREATION
    # ============================================================

    @staticmethod
    def _create_event(
        event_type: str,
        block_id: str,
    ) -> DisruptionEvent:
        """Create a validated disruption event."""

        event_type = (
            str(event_type)
            .strip()
            .upper()
        )

        block_id = (
            str(block_id)
            .strip()
        )

        if not event_type:
            raise ValueError(
                "event_type is required."
            )

        if not block_id:
            raise ValueError(
                "block_id is required."
            )

        return DisruptionEvent(
            event_id=(
                f"API-{event_type}-{block_id}"
            ),
            event_type=event_type,
            severity="HIGH",
            block_id=block_id,
            description=(
                "Disruption received through "
                "the MARS backend API: "
                f"{event_type} for block {block_id}."
            ),
        )

    # ============================================================
    # DYNAMIC REPLANNING
    # ============================================================

    def replan(
        self,
        event_type: str,
        block_id: str,
    ) -> dict:
        """Run the existing dynamic replanning engine."""

        current_plan = (
            self._load_current_plan()
        )

        event = self._create_event(
            event_type=event_type,
            block_id=block_id,
        )

        replanner = ReplanOptimizer(
            priority_results_path=(
                self.priority_results_path
            ),
            jobs_path=self.jobs_path,
            assets_path=self.assets_path,
            blocks_path=self.blocks_path,
            train_schedule_path=(
                self.train_schedule_path
            ),
            train_sections_path=(
                self.train_sections_path
            ),
        )

        # IMPORTANT:
        # ReplanOptimizer.replan() returns:
        #
        #     (
        #         revised_plan,
        #         changes,
        #         summary,
        #     )
        #
        revised_plan, changes, summary = (
            replanner.replan(
                current_plan=current_plan,
                event=event,
            )
        )

        return {
            "event": {
                "event_id": event.event_id,
                "event_type": event.event_type,
                "severity": event.severity,
                "block_id": event.block_id,
                "train_id": event.train_id,
                "section_id": event.section_id,
                "job_id": event.job_id,
                "delay_minutes": event.delay_minutes,
                "description": event.description,
            },

            "solver_status": summary.get(
                "solver_status"
            ),

            "objective_values": self._serialize_value(
                summary.get(
                    "objective_values",
                    {},
                )
            ),

            "summary": self._serialize_value(
                summary
            ),

            "plan": self._serialize_dataframe(
                revised_plan
            ),

            "changes": self._serialize_dataframe(
                changes
            ),
        }

    # ============================================================
    # CASCADING REPLANNING
    # ============================================================

    def cascade_replan(
        self,
        event_type: str,
        block_id: str,
    ) -> dict:
        """Run the existing cascading replanning engine."""

        current_plan = (
            self._load_current_plan()
        )

        event = self._create_event(
            event_type=event_type,
            block_id=block_id,
        )

        # --------------------------------------------------------
        # Candidate generator
        # --------------------------------------------------------

        generator = CandidateGenerator(
            self.priority_results_path,
            self.jobs_path,
            self.assets_path,
            self.blocks_path,
            self.train_schedule_path,
            self.train_sections_path,
        )

        # --------------------------------------------------------
        # Independent validator
        # --------------------------------------------------------

        validator = OptimizedPlanValidator(
            self.jobs_path,
            self.assets_path,
            self.blocks_path,
            self.train_schedule_path,
            self.train_sections_path,
        )

        # --------------------------------------------------------
        # Cascade replanner
        # --------------------------------------------------------

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

        return self._serialize_cascade_result(
            result
        )

    # ============================================================
    # VALUE SERIALIZATION
    # ============================================================

    @classmethod
    def _serialize_value(
        cls,
        value,
    ):
        """Convert pandas/Python values into JSON-safe values."""

        if value is None:
            return None

        if isinstance(
            value,
            pd.Timestamp,
        ):
            return value.isoformat()

        if isinstance(
            value,
            dict,
        ):
            return {
                str(key): cls._serialize_value(
                    item
                )
                for key, item in value.items()
            }

        if isinstance(
            value,
            (list, tuple),
        ):
            return [
                cls._serialize_value(
                    item
                )
                for item in value
            ]

        return value

    # ============================================================
    # DATAFRAME SERIALIZATION
    # ============================================================

    @classmethod
    def _serialize_dataframe(
        cls,
        dataframe: pd.DataFrame | None,
    ) -> list[dict]:
        """Convert a DataFrame into JSON-safe records."""

        if dataframe is None:
            return []

        if dataframe.empty:
            return []

        cleaned = dataframe.copy()

        for column in cleaned.columns:

            cleaned[column] = cleaned[
                column
            ].map(
                lambda value: (
                    value.isoformat()
                    if isinstance(
                        value,
                        pd.Timestamp,
                    )
                    else value
                )
            )

        cleaned = cleaned.where(
            pd.notna(cleaned),
            None,
        )

        return [
            {
                str(key): cls._serialize_value(
                    value
                )
                for key, value in record.items()
            }
            for record in cleaned.to_dict(
                orient="records"
            )
        ]

    # ============================================================
    # CASCADE RESULT SERIALIZATION
    # ============================================================

    @classmethod
    def _serialize_cascade_result(
        cls,
        result,
    ) -> dict:
        """Serialize CascadeResult for the API."""

        response = {
            "solver_status": getattr(
                result,
                "solver_status",
                None,
            ),
            "objective_values": cls._serialize_value(
                getattr(
                    result,
                    "objective_values",
                    {},
                )
            ),
            "plan": cls._serialize_dataframe(
                getattr(
                    result,
                    "plan",
                    None,
                )
            ),
            "changes": cls._serialize_dataframe(
                getattr(
                    result,
                    "changes",
                    None,
                )
            ),
            "impact_graph": [],
            "cascade": None,
        }

        # --------------------------------------------------------
        # Impact graph
        # --------------------------------------------------------

        impact_graph = getattr(
            result,
            "impact_graph",
            None,
        )

        if impact_graph is not None:

            response["impact_graph"] = (
                cls._serialize_dataframe(
                    impact_graph.to_dataframe()
                )
            )

        # --------------------------------------------------------
        # Cascade group
        # --------------------------------------------------------

        cascade_group = getattr(
            result,
            "cascade_group",
            None,
        )

        if cascade_group is not None:

            response["cascade"] = {
                "job_ids": list(
                    getattr(
                        cascade_group,
                        "job_ids",
                        [],
                    )
                ),
                "summary": cls._serialize_value(
                    getattr(
                        cascade_group,
                        "summary",
                        None,
                    )
                ),
            }

        return response