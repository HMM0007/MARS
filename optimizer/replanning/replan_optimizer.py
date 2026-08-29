"""Dynamic CP-SAT replanning for MARS.

V1 supports BLOCK_UNAVAILABLE disruptions.

Behavior:
    Existing optimized plan
        ↓
    Identify directly affected jobs
        ↓
    Freeze unaffected scheduled jobs
        ↓
    Release affected jobs
        ↓
    Remove unavailable block
        ↓
    Subtract frozen maintenance intervals from replacement windows
        ↓
    CP-SAT globally re-optimizes released jobs
        ↓
    Validate revised plan
        ↓
    Produce change report and summary

The original CP-SAT optimizer is not modified.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import pandas as pd
from ortools.sat.python import cp_model

from optimizer.cp_sat.candidate_generator import Candidate, CandidateGenerator
from optimizer.cp_sat.plan_validator import OptimizedPlanValidator
from optimizer.replanning.change_analyzer import ChangeAnalyzer
from optimizer.replanning.disruption_models import DisruptionEvent
from optimizer.replanning.freeze_manager import FreezeManager
from optimizer.replanning.impact_analyzer import ImpactAnalyzer


class ReplanOptimizer:
    """Re-optimize affected maintenance jobs after a disruption."""

    def __init__(
        self,
        priority_results_path,
        jobs_path,
        assets_path,
        blocks_path,
        train_schedule_path,
        train_sections_path,
    ):
        self.priority_results_path = Path(priority_results_path)
        self.jobs_path = Path(jobs_path)
        self.assets_path = Path(assets_path)
        self.blocks_path = Path(blocks_path)
        self.train_schedule_path = Path(train_schedule_path)
        self.train_sections_path = Path(train_sections_path)

        self.generator = CandidateGenerator(
            self.priority_results_path,
            self.jobs_path,
            self.assets_path,
            self.blocks_path,
            self.train_schedule_path,
            self.train_sections_path,
        )

        self.impact_analyzer = ImpactAnalyzer()
        self.freeze_manager = FreezeManager()
        self.change_analyzer = ChangeAnalyzer()

    # ------------------------------------------------------------------
    # Interval utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _overlaps(
        start_a: pd.Timestamp,
        end_a: pd.Timestamp,
        start_b: pd.Timestamp,
        end_b: pd.Timestamp,
    ) -> bool:
        """Return True when half-open intervals actually overlap.

        Intervals use [start, end).

        Therefore:
            [09:00, 10:00) and [10:00, 11:00)
        do NOT overlap.
        """
        return start_a < end_b and start_b < end_a

    @staticmethod
    def _subtract_interval(
        source_start: pd.Timestamp,
        source_end: pd.Timestamp,
        occupied_start: pd.Timestamp,
        occupied_end: pd.Timestamp,
    ) -> list[tuple[pd.Timestamp, pd.Timestamp]]:
        """Subtract one occupied interval from a source interval.

        Returns zero, one, or two remaining intervals.
        """

        if not ReplanOptimizer._overlaps(
            source_start,
            source_end,
            occupied_start,
            occupied_end,
        ):
            return [(source_start, source_end)]

        remaining = []

        # Left side.
        if source_start < occupied_start:
            left_end = min(occupied_start, source_end)

            if source_start < left_end:
                remaining.append(
                    (source_start, left_end)
                )

        # Right side.
        if occupied_end < source_end:
            right_start = max(occupied_end, source_start)

            if right_start < source_end:
                remaining.append(
                    (right_start, source_end)
                )

        return remaining

    @classmethod
    def _subtract_intervals(
        cls,
        source_start: pd.Timestamp,
        source_end: pd.Timestamp,
        occupied_intervals: list[tuple[pd.Timestamp, pd.Timestamp]],
    ) -> list[tuple[pd.Timestamp, pd.Timestamp]]:
        """Subtract multiple occupied intervals from a source window."""

        windows = [(source_start, source_end)]

        # Sorting makes the operation deterministic.
        occupied_intervals = sorted(
            occupied_intervals,
            key=lambda value: (value[0], value[1]),
        )

        for occupied_start, occupied_end in occupied_intervals:

            next_windows = []

            for window_start, window_end in windows:

                next_windows.extend(
                    cls._subtract_interval(
                        window_start,
                        window_end,
                        occupied_start,
                        occupied_end,
                    )
                )

            windows = next_windows

            if not windows:
                break

        return windows

    # ------------------------------------------------------------------
    # Frozen-job handling
    # ------------------------------------------------------------------

    @staticmethod
    def _get_frozen_intervals(
        frozen_plan: pd.DataFrame,
    ) -> dict[str, list[tuple[pd.Timestamp, pd.Timestamp]]]:
        """Build frozen maintenance intervals by section."""

        result: dict[
            str,
            list[tuple[pd.Timestamp, pd.Timestamp]],
        ] = {}

        if frozen_plan.empty:
            return result

        scheduled = frozen_plan[
            frozen_plan["plan_status"]
            .astype(str)
            .str.upper()
            == "SCHEDULED"
        ]

        for row in scheduled.itertuples():

            if pd.isna(row.scheduled_start) or pd.isna(
                row.scheduled_end
            ):
                continue

            section_id = str(row.section_id)

            start = pd.Timestamp(
                row.scheduled_start
            )

            end = pd.Timestamp(
                row.scheduled_end
            )

            if end <= start:
                continue

            result.setdefault(
                section_id,
                [],
            ).append(
                (start, end)
            )

        return result

    @classmethod
    def _build_replanning_candidates(
        cls,
        candidates: list[Candidate],
        jobs: pd.DataFrame,
        frozen_plan: pd.DataFrame,
    ) -> list[Candidate]:
        """Subtract frozen maintenance from train-free candidates.

        CandidateGenerator already removes train movements.

        This method performs the second layer of interval subtraction:

            train-free window
                    ↓
            subtract frozen maintenance
                    ↓
            actual replanning windows
        """

        frozen_by_section = cls._get_frozen_intervals(
            frozen_plan
        )

        job_lookup = jobs.set_index("job_id")

        result = []

        for candidate in candidates:

            if candidate.job_id not in job_lookup.index:
                continue

            job = job_lookup.loc[
                candidate.job_id
            ]

            duration = int(
                job.duration_min
            )

            occupied = frozen_by_section.get(
                str(candidate.section_id),
                [],
            )

            remaining_windows = cls._subtract_intervals(
                candidate.start,
                candidate.end,
                occupied,
            )

            for start, end in remaining_windows:

                if (
                    end - start
                    >= pd.Timedelta(
                        minutes=duration
                    )
                ):
                    result.append(
                        Candidate(
                            job_id=candidate.job_id,
                            block_id=candidate.block_id,
                            section_id=candidate.section_id,
                            start=start,
                            end=end,
                        )
                    )

        return result

    # ------------------------------------------------------------------
    # CP-SAT model
    # ------------------------------------------------------------------

    def _build_model(
        self,
        jobs: pd.DataFrame,
        candidates: list[Candidate],
        released_job_ids: set[str],
    ):
        """Build a CP-SAT model for released jobs."""

        model = cp_model.CpModel()

        selected = {}
        starts = {}
        ends = {}
        selected_ends = {}

        by_job: dict[str, list[int]] = {}
        by_section: dict[str, list] = {}
        by_block: dict[str, list] = {}

        candidate_records = []

        if not candidates:
            return {
                "model": model,
                "origin": None,
                "selected": selected,
                "starts": starts,
                "ends": ends,
                "selected_ends": selected_ends,
                "by_job": by_job,
                "by_section": by_section,
                "by_block": by_block,
                "candidate_records": candidate_records,
            }

        origin = min(
            candidate.start
            for candidate in candidates
        )

        for index, candidate in enumerate(candidates):

            if candidate.job_id not in released_job_ids:
                continue

            job_rows = jobs[
                jobs.job_id == candidate.job_id
            ]

            if job_rows.empty:
                continue

            job = job_rows.iloc[0]

            duration = int(
                job.duration_min
            )

            low = int(
                (
                    candidate.start - origin
                ).total_seconds()
                // 60
            )

            high = int(
                (
                    candidate.end - origin
                ).total_seconds()
                // 60
            ) - duration

            if high < low:
                continue

            x = model.NewBoolVar(
                f"replan_x_{index}"
            )

            start = model.NewIntVar(
                low,
                high,
                f"replan_start_{index}",
            )

            end = model.NewIntVar(
                low + duration,
                high + duration,
                f"replan_end_{index}",
            )

            model.Add(
                end == start + duration
            )

            interval = model.NewOptionalIntervalVar(
                start,
                duration,
                end,
                x,
                f"replan_interval_{index}",
            )

            selected_end = model.NewIntVar(
                0,
                high + duration,
                f"replan_selected_end_{index}",
            )

            model.Add(
                selected_end == end
            ).OnlyEnforceIf(x)

            model.Add(
                selected_end == 0
            ).OnlyEnforceIf(x.Not())

            selected[index] = x
            starts[index] = start
            ends[index] = end
            selected_ends[index] = selected_end

            by_job.setdefault(
                candidate.job_id,
                [],
            ).append(index)

            by_section.setdefault(
                str(candidate.section_id),
                [],
            ).append(interval)

            by_block.setdefault(
                str(candidate.block_id),
                [],
            ).append(interval)

            candidate_records.append(
                {
                    "index": index,
                    "candidate": candidate,
                    "job": job,
                }
            )

        # One assignment at most per released job.
        for job_id, indexes in by_job.items():

            model.Add(
                sum(
                    selected[index]
                    for index in indexes
                )
                <= 1
            )

        # No overlapping released maintenance on same section.
        for intervals in by_section.values():

            if len(intervals) > 1:
                model.AddNoOverlap(
                    intervals
                )

        # No overlapping released maintenance inside same block.
        for intervals in by_block.values():

            if len(intervals) > 1:
                model.AddNoOverlap(
                    intervals
                )

        return {
            "model": model,
            "origin": origin,
            "selected": selected,
            "starts": starts,
            "ends": ends,
            "selected_ends": selected_ends,
            "by_job": by_job,
            "by_section": by_section,
            "by_block": by_block,
            "candidate_records": candidate_records,
        }

    # ------------------------------------------------------------------
    # Lexicographic optimization
    # ------------------------------------------------------------------

    def _solve_lexicographically(
        self,
        state,
        jobs: pd.DataFrame,
        blocks: pd.DataFrame,
        time_limit_seconds: float,
    ):
        """Solve the released-job replanning model lexicographically."""

        model = state["model"]
        selected = state["selected"]
        selected_ends = state["selected_ends"]
        candidate_records = state["candidate_records"]

        job_lookup = jobs.set_index(
            "job_id"
        )

        block_lookup = blocks.set_index(
            "block_id"
        )

        priority_terms = []
        criticality_terms = []
        scheduled_terms = []
        emergency_terms = []
        completion_terms = []

        used_block_vars = {}

        for record in candidate_records:

            index = record["index"]
            candidate = record["candidate"]

            x = selected[index]

            job = job_lookup.loc[
                candidate.job_id
            ]

            priority = int(
                round(
                    float(
                        job.priority_score
                    )
                    * 100
                )
            )

            criticality = int(
                round(
                    float(
                        job.asset_criticality_score
                    )
                    * 100
                )
            )

            priority_terms.append(
                priority * x
            )

            criticality_terms.append(
                criticality * x
            )

            scheduled_terms.append(x)

            completion_terms.append(
                selected_ends[index]
            )

            block_id = str(
                candidate.block_id
            )

            if block_id not in used_block_vars:

                used_block_vars[block_id] = (
                    model.NewBoolVar(
                        f"replan_used_block_{block_id}"
                    )
                )

            model.AddImplication(
                x,
                used_block_vars[block_id],
            )

            block = block_lookup.loc[
                candidate.block_id
            ]

            if (
                str(
                    block.block_type
                ).upper()
                == "EMERGENCY"
            ):
                emergency_terms.append(x)

        priority_expr = sum(
            priority_terms
        )

        criticality_expr = sum(
            criticality_terms
        )

        scheduled_expr = sum(
            scheduled_terms
        )

        emergency_expr = sum(
            emergency_terms
        )

        used_blocks_expr = sum(
            used_block_vars.values()
        )

        completion_expr = sum(
            completion_terms
        )

        solver = cp_model.CpSolver()

        solver.parameters.num_search_workers = 1
        solver.parameters.random_seed = 42
        solver.parameters.max_time_in_seconds = (
            time_limit_seconds
        )

        objective_values = {}

        def solve_stage(
            name: str,
            expression,
            maximize: bool,
        ):
            if maximize:
                model.Maximize(
                    expression
                )
            else:
                model.Minimize(
                    expression
                )

            status = solver.Solve(
                model
            )

            if status not in (
                cp_model.OPTIMAL,
                cp_model.FEASIBLE,
            ):
                raise RuntimeError(
                    f"Replanning failed at stage "
                    f"{name}: "
                    f"{solver.StatusName(status)}"
                )

            value = int(
                round(
                    solver.ObjectiveValue()
                )
            )

            objective_values[name] = value

            # Freeze this objective before solving
            # the next lexicographic stage.
            model.Add(
                expression == value
            )

        solve_stage(
            "priority",
            priority_expr,
            True,
        )

        solve_stage(
            "criticality",
            criticality_expr,
            True,
        )

        solve_stage(
            "scheduled_jobs",
            scheduled_expr,
            True,
        )

        solve_stage(
            "emergency_blocks",
            emergency_expr,
            False,
        )

        solve_stage(
            "used_blocks",
            used_blocks_expr,
            False,
        )

        solve_stage(
            "completion_minutes",
            completion_expr,
            False,
        )

        return solver, objective_values

    # ------------------------------------------------------------------
    # Plan update helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _clear_assignment(
        plan: pd.DataFrame,
        job_id: str,
    ) -> None:
        """Clear scheduling fields for one job."""

        mask = (
            plan.job_id == job_id
        )

        fields = [
            "plan_status",
            "block_id",
            "block_date",
            "scheduled_start",
            "scheduled_end",
            "block_type",
            "block_restrictions",
            "block_isolation_required",
        ]

        existing_fields = [
            field
            for field in fields
            if field in plan.columns
        ]

        if not existing_fields:
            return

        values = []

        for field in existing_fields:

            if field == "plan_status":
                values.append(
                    "UNSCHEDULED"
                )
            else:
                values.append("")

        plan.loc[
            mask,
            existing_fields,
        ] = values

    @staticmethod
    def _apply_assignment(
        plan: pd.DataFrame,
        job_id: str,
        candidate: Candidate,
        start: pd.Timestamp,
        end: pd.Timestamp,
        block,
    ) -> None:
        """Apply one selected CP-SAT assignment."""

        mask = (
            plan.job_id == job_id
        )

        fields = {
            "plan_status": "SCHEDULED",
            "block_id": candidate.block_id,
            "block_date": block.block_date,
            "scheduled_start": start.strftime(
                "%Y-%m-%d %H:%M"
            ),
            "scheduled_end": end.strftime(
                "%Y-%m-%d %H:%M"
            ),
            "block_type": block.block_type,
            "block_restrictions": block.restrictions,
            "block_isolation_required": (
                block.isolation_required
            ),
        }

        for field, value in fields.items():

            if field in plan.columns:
                plan.loc[
                    mask,
                    field,
                ] = value

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def replan(
        self,
        current_plan: pd.DataFrame,
        event: DisruptionEvent,
        output_dir: Optional[str | Path] = None,
        time_limit_seconds: float = 20.0,
    ):
        """Generate a revised plan after a disruption."""

        if event.event_type != "BLOCK_UNAVAILABLE":
            raise NotImplementedError(
                "ReplanOptimizer V1 supports only "
                "BLOCK_UNAVAILABLE."
            )

        if not event.block_id:
            raise ValueError(
                "BLOCK_UNAVAILABLE requires block_id."
            )

        required_columns = {
            "job_id",
            "plan_status",
            "block_id",
            "scheduled_start",
            "scheduled_end",
            "section_id",
            "duration_min",
        }

        missing = (
            required_columns
            - set(current_plan.columns)
        )

        if missing:
            raise ValueError(
                "Current plan is missing columns: "
                f"{sorted(missing)}"
            )

        current_plan = current_plan.copy()

        # --------------------------------------------------------------
        # 1. Identify directly affected jobs.
        # --------------------------------------------------------------

        impact = (
            self.impact_analyzer.analyze(
                current_plan,
                event,
            )
        )

        partition = (
            self.freeze_manager.partition(
                current_plan,
                impact,
            )
        )

        frozen_job_ids = set(
            partition.frozen_job_ids
        )

        released_job_ids = set(
            partition.released_job_ids
        )

        # --------------------------------------------------------------
        # 2. Load normal Dataset V1 candidates.
        # --------------------------------------------------------------

        (
            jobs,
            blocks,
            trains,
            all_candidates,
            static_reasons,
        ) = self.generator.generate()

        # --------------------------------------------------------------
        # 3. Remove unavailable block.
        # --------------------------------------------------------------

        available_candidates = [
            candidate
            for candidate in all_candidates
            if str(candidate.block_id)
            != str(event.block_id)
        ]

        # --------------------------------------------------------------
        # 4. Freeze unaffected jobs.
        # --------------------------------------------------------------

        frozen_plan = current_plan[
            current_plan.job_id.isin(
                frozen_job_ids
            )
        ].copy()

        # --------------------------------------------------------------
        # 5. Subtract frozen maintenance from replacement windows.
        #
        # Example:
        #
        # B019:
        # 09:00 ---------------- 12:00
        #
        # Frozen:
        #      10:00 ---- 10:30
        #
        # Result:
        # 09:00 ---- 10:00
        # 10:30 ---------------- 12:00
        # --------------------------------------------------------------

        replanning_candidates = (
            self._build_replanning_candidates(
                available_candidates,
                jobs,
                frozen_plan,
            )
        )

        # Only released jobs participate in CP-SAT.
        replanning_candidates = [
            candidate
            for candidate in replanning_candidates
            if candidate.job_id
            in released_job_ids
        ]

        # --------------------------------------------------------------
        # 6. Candidate counts after frozen-job subtraction.
        # --------------------------------------------------------------

        candidate_counts = {}

        for candidate in replanning_candidates:

            candidate_counts[
                candidate.job_id
            ] = (
                candidate_counts.get(
                    candidate.job_id,
                    0,
                )
                + 1
            )

        # --------------------------------------------------------------
        # 7. Build model.
        # --------------------------------------------------------------

        state = self._build_model(
            jobs,
            replanning_candidates,
            released_job_ids,
        )

        # --------------------------------------------------------------
        # 8. Solve.
        # --------------------------------------------------------------

        if state["candidate_records"]:

            solver, objective_values = (
                self._solve_lexicographically(
                    state,
                    jobs,
                    blocks,
                    time_limit_seconds,
                )
            )

            solver_status = solver.StatusName(
                solver.ResponseProto().status
            )

        else:

            solver = None

            objective_values = {
                "priority": 0,
                "criticality": 0,
                "scheduled_jobs": 0,
                "emergency_blocks": 0,
                "used_blocks": 0,
                "completion_minutes": 0,
            }

            solver_status = "NO_CANDIDATES"

        # --------------------------------------------------------------
        # 9. Start with the previous plan.
        # --------------------------------------------------------------

        revised_plan = current_plan.copy()

        # Directly affected jobs are released first.
        for job_id in released_job_ids:
            self._clear_assignment(
                revised_plan,
                job_id,
            )

        # --------------------------------------------------------------
        # 10. Apply selected CP-SAT assignments.
        # --------------------------------------------------------------

        selected_job_ids = set()

        block_lookup = blocks.set_index(
            "block_id"
        )

        if solver is not None:

            for record in state[
                "candidate_records"
            ]:

                index = record[
                    "index"
                ]

                candidate = record[
                    "candidate"
                ]

                job = record["job"]

                if solver.Value(
                    state["selected"][index]
                ) != 1:
                    continue

                selected_job_ids.add(
                    candidate.job_id
                )

                start = (
                    state["origin"]
                    + pd.Timedelta(
                        minutes=solver.Value(
                            state["starts"][index]
                        )
                    )
                )

                end = start + pd.Timedelta(
                    minutes=int(
                        job.duration_min
                    )
                )

                block = block_lookup.loc[
                    candidate.block_id
                ]

                self._apply_assignment(
                    revised_plan,
                    candidate.job_id,
                    candidate,
                    start,
                    end,
                    block,
                )

        # --------------------------------------------------------------
        # 11. Any released job not selected becomes UNSCHEDULED.
        # --------------------------------------------------------------

        for job_id in released_job_ids:

            if job_id in selected_job_ids:
                continue

            self._clear_assignment(
                revised_plan,
                job_id,
            )

        # --------------------------------------------------------------
        # 12. Add replanning metadata if the columns already exist.
        # --------------------------------------------------------------

        if "optimizer_candidate_count" in revised_plan.columns:
            revised_plan[
                "optimizer_candidate_count"
            ] = revised_plan.job_id.map(
                lambda job_id:
                    candidate_counts.get(
                        job_id,
                        0,
                    )
            )

        if "optimizer_reason_code" in revised_plan.columns:

            def reason_code(job_id):
                if job_id in selected_job_ids:
                    return "RESCHEDULED"

                if job_id in released_job_ids:
                    return "NO_FEASIBLE_REPLACEMENT"

                return "UNCHANGED"

            revised_plan[
                "optimizer_reason_code"
            ] = revised_plan.job_id.map(
                reason_code
            )

        if "optimizer_reason_detail" in revised_plan.columns:

            def reason_detail(job_id):

                if job_id in selected_job_ids:
                    return (
                        f"Original block "
                        f"{event.block_id} became unavailable; "
                        "a new feasible maintenance window "
                        "was selected."
                    )

                if job_id in released_job_ids:
                    return (
                        f"Original block "
                        f"{event.block_id} became unavailable "
                        "and no feasible replacement window "
                        "remained after train and frozen-job "
                        "constraints."
                    )

                return "Existing assignment remained unchanged."

            revised_plan[
                "optimizer_reason_detail"
            ] = revised_plan.job_id.map(
                reason_detail
            )

        # --------------------------------------------------------------
        # 13. Compare previous and revised plans.
        # --------------------------------------------------------------

        changes = (
            self.change_analyzer.compare(
                current_plan,
                revised_plan,
            )
        )

        # Add event information.
        changes.insert(
            1,
            "event_id",
            event.event_id,
        )

        changes.insert(
            2,
            "event_type",
            event.event_type,
        )

        changes.insert(
            3,
            "event_block_id",
            event.block_id,
        )

        # Correct reason semantics.
        def change_reason(row):

            job_id = row.job_id

            if (
                job_id
                in released_job_ids
            ):

                if (
                    job_id
                    in selected_job_ids
                ):
                    return (
                        f"Block {event.block_id} "
                        "became unavailable; job "
                        "was rescheduled."
                    )

                return (
                    f"Block {event.block_id} "
                    "became unavailable; no feasible "
                    "replacement window was available."
                )

            return "No change required."

        changes[
            "change_reason"
        ] = changes.apply(
            change_reason,
            axis=1,
        )

        # --------------------------------------------------------------
        # 14. Correct change counts.
        # --------------------------------------------------------------

        previous_scheduled = current_plan[
            current_plan.plan_status
            .astype(str)
            .str.upper()
            == "SCHEDULED"
        ]

        revised_scheduled = revised_plan[
            revised_plan.plan_status
            .astype(str)
            .str.upper()
            == "SCHEDULED"
        ]

        previously_scheduled_ids = set(
            previous_scheduled.job_id
        )

        unchanged_previously_scheduled = int(
            (
                changes[
                    changes.job_id.isin(
                        previously_scheduled_ids
                    )
                ].change_type
                == "UNCHANGED"
            ).sum()
        )

        rescheduled_jobs = int(
            (
                changes.change_type
                == "RESCHEDULED"
            ).sum()
        )

        dropped_jobs = int(
            (
                changes.change_type
                == "DROPPED"
            ).sum()
        )

        newly_scheduled_jobs = int(
            (
                changes.change_type
                == "NEWLY_SCHEDULED"
            ).sum()
        )

        previous_count = len(
            previous_scheduled
        )

        schedule_stability = (
            unchanged_previously_scheduled
            / previous_count
            if previous_count
            else 1.0
        )

        # Defensive protection.
        schedule_stability = max(
            0.0,
            min(
                1.0,
                schedule_stability,
            ),
        )

        # --------------------------------------------------------------
        # 15. Summary.
        # --------------------------------------------------------------

        summary = {
            "event_id": event.event_id,
            "event_type": event.event_type,
            "event_block_id": event.block_id,
            "previous_scheduled_jobs": int(
                len(previous_scheduled)
            ),
            "revised_scheduled_jobs": int(
                len(revised_scheduled)
            ),
            "frozen_jobs": int(
                len(frozen_job_ids)
            ),
            "released_jobs": int(
                len(released_job_ids)
            ),
            "affected_jobs": int(
                len(released_job_ids)
            ),
            "unchanged_jobs": int(
                unchanged_previously_scheduled
            ),
            "rescheduled_jobs": int(
                rescheduled_jobs
            ),
            "dropped_jobs": int(
                dropped_jobs
            ),
            "newly_scheduled_jobs": int(
                newly_scheduled_jobs
            ),
            "schedule_stability": float(
                schedule_stability
            ),
            "candidate_counts": {
                str(job_id): int(count)
                for job_id, count
                in candidate_counts.items()
            },
            "solver_status": solver_status,
            "objective_values": objective_values,
        }

        # --------------------------------------------------------------
        # 16. Independent validation.
        #
        # This validates the revised plan against the original
        # Dataset V1 operational constraints.
        # --------------------------------------------------------------

        validator = OptimizedPlanValidator(
            self.jobs_path,
            self.assets_path,
            self.blocks_path,
            self.train_schedule_path,
            self.train_sections_path,
        )

        validator.validate(
            revised_plan
        )

        summary[
            "independent_validation"
        ] = "PASSED"

        # --------------------------------------------------------------
        # 17. Output.
        # --------------------------------------------------------------

        if output_dir is not None:

            output_path = Path(
                output_dir
            )

            output_path.mkdir(
                parents=True,
                exist_ok=True,
            )

            revised_plan.to_csv(
                output_path
                / "revised_maintenance_plan.csv",
                index=False,
            )

            changes.to_csv(
                output_path
                / "replan_changes.csv",
                index=False,
            )

            (
                output_path
                / "replan_summary.json"
            ).write_text(
                json.dumps(
                    summary,
                    indent=2,
                    default=str,
                ),
                encoding="utf-8",
            )

        return (
            revised_plan,
            changes,
            summary,
        )