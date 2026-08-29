"""CP-SAT based cascading railway replanner.

The cascading replanner extends direct disruption replanning by allowing
a bounded group of indirectly affected scheduled jobs to move together.

Unrelated scheduled jobs remain frozen.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from ortools.sat.python import cp_model

from optimizer.replanning.cascade_manager import (
    CascadeGroup,
    CascadeManager,
)
from optimizer.replanning.impact_graph import ImpactGraph
from optimizer.replanning.disruption_models import DisruptionEvent


@dataclass(frozen=True)
class CascadeResult:
    """Result of a cascading replanning run."""

    plan: pd.DataFrame
    impact_graph: ImpactGraph
    cascade_group: CascadeGroup
    solver_status: str
    objective_values: dict
    changes: pd.DataFrame


class CascadeReplanner:
    """Perform bounded cascading CP-SAT replanning."""

    def __init__(
        self,
        candidate_generator,
        validator,
        max_cascade_depth: int = 1,
        random_seed: int = 42,
        max_time_seconds: float = 30.0,
    ):
        if max_cascade_depth < 0:
            raise ValueError(
                "max_cascade_depth must be >= 0"
            )

        self.generator = candidate_generator
        self.validator = validator
        self.cascade_manager = CascadeManager(
            max_depth=max_cascade_depth
        )
        self.random_seed = random_seed
        self.max_time_seconds = max_time_seconds

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def replan(
        self,
        current_plan: pd.DataFrame,
        event: DisruptionEvent,
    ) -> CascadeResult:
        """Run bounded cascading replanning."""

        (
            jobs,
            blocks,
            trains,
            raw_candidates,
            static_reasons,
        ) = self.generator.generate()

        graph, group = self.cascade_manager.build_group(
            current_plan=current_plan,
            event=event,
            candidates=raw_candidates,
        )

        if not group.job_ids:
            changes = self._build_changes(
                current_plan=current_plan,
                revised_plan=current_plan.copy(),
                event=event,
                graph=graph,
            )

            return CascadeResult(
                plan=current_plan.copy(),
                impact_graph=graph,
                cascade_group=group,
                solver_status="NO_AFFECTED_JOBS",
                objective_values={
                    "priority": 0,
                    "criticality": 0,
                    "scheduled_jobs": 0,
                    "emergency_blocks": 0,
                    "used_blocks": 0,
                    "completion_minutes": 0,
                },
                changes=changes,
            )

        # --------------------------------------------------------------
        # Jobs entering the cascade are removed from their old
        # assignments. Everything else remains frozen.
        # --------------------------------------------------------------

        frozen_plan = current_plan[
            ~current_plan.job_id.astype(str).isin(
                group.job_ids
            )
        ].copy()

        cascade_jobs = jobs[
            jobs.job_id.astype(str).isin(
                group.job_ids
            )
        ].copy()

        cascade_candidates = [
            candidate
            for candidate in raw_candidates
            if candidate.job_id in group.job_ids
        ]

        # Remove candidates belonging to the disrupted block.
        event_block = str(
            getattr(event, "block_id", "")
        )

        if event.event_type == "BLOCK_UNAVAILABLE":
            cascade_candidates = [
                candidate
                for candidate in cascade_candidates
                if str(candidate.block_id)
                != event_block
            ]

        # --------------------------------------------------------------
        # Subtract frozen maintenance reservations.
        # --------------------------------------------------------------

        usable_candidates = (
            self._remove_frozen_conflicts(
                cascade_candidates,
                frozen_plan,
            )
        )

        if not usable_candidates:
            revised_plan = self._drop_cascade_jobs(
                current_plan=current_plan,
                group=group,
                event=event,
            )

            self.validator.validate(
                revised_plan
            )

            changes = self._build_changes(
                current_plan=current_plan,
                revised_plan=revised_plan,
                event=event,
                graph=graph,
            )

            return CascadeResult(
                plan=revised_plan,
                impact_graph=graph,
                cascade_group=group,
                solver_status="NO_CANDIDATES",
                objective_values={
                    "priority": 0,
                    "criticality": 0,
                    "scheduled_jobs": 0,
                    "emergency_blocks": 0,
                    "used_blocks": 0,
                    "completion_minutes": 0,
                },
                changes=changes,
            )

        optimized = self._solve(
            cascade_jobs=cascade_jobs,
            candidates=usable_candidates,
            frozen_plan=frozen_plan,
            blocks=blocks,
        )

        revised_plan = self._merge_plan(
            current_plan=current_plan,
            frozen_plan=frozen_plan,
            optimized=optimized,
            group=group,
            event=event,
        )

        self.validator.validate(
            revised_plan
        )

        changes = self._build_changes(
            current_plan=current_plan,
            revised_plan=revised_plan,
            event=event,
            graph=graph,
        )

        return CascadeResult(
            plan=revised_plan,
            impact_graph=graph,
            cascade_group=group,
            solver_status=optimized["status"],
            objective_values=optimized[
                "objective_values"
            ],
            changes=changes,
        )

    # ------------------------------------------------------------------
    # Frozen conflict handling
    # ------------------------------------------------------------------

    @staticmethod
    def _remove_frozen_conflicts(
        candidates,
        frozen_plan: pd.DataFrame,
    ):
        """Remove candidate windows that overlap frozen maintenance."""

        if frozen_plan.empty:
            return list(candidates)

        result = []

        frozen_intervals = []

        for row in frozen_plan.itertuples():

            if (
                pd.isna(row.scheduled_start)
                or pd.isna(row.scheduled_end)
            ):
                continue

            frozen_intervals.append(
                (
                    str(row.section_id),
                    str(row.block_id),
                    pd.Timestamp(
                        row.scheduled_start
                    ),
                    pd.Timestamp(
                        row.scheduled_end
                    ),
                )
            )

        for candidate in candidates:

            candidate_start = pd.Timestamp(
                candidate.start
            )

            candidate_end = pd.Timestamp(
                candidate.end
            )

            valid = True

            for (
                section_id,
                block_id,
                frozen_start,
                frozen_end,
            ) in frozen_intervals:

                if (
                    str(candidate.section_id)
                    != section_id
                ):
                    continue

                # Candidate can share neither the section nor the block
                # with overlapping frozen maintenance.
                if not (
                    candidate_start < frozen_end
                    and frozen_start < candidate_end
                ):
                    continue

                if (
                    str(candidate.block_id)
                    == block_id
                ):
                    valid = False
                    break

                # Same-section overlap is also forbidden.
                valid = False
                break

            if valid:
                result.append(
                    candidate
                )

        return result

    # ------------------------------------------------------------------
    # CP-SAT
    # ------------------------------------------------------------------

    def _solve(
        self,
        cascade_jobs: pd.DataFrame,
        candidates,
        frozen_plan: pd.DataFrame,
        blocks: pd.DataFrame,
    ) -> dict:
        """Solve the cascade group globally with optional job assignments.

        Every cascade job is optional.  Frozen jobs are excluded from this
        model and remain fixed in the caller.  Candidate windows are already
        train-free and compatible with the static block constraints.
        """

        model = cp_model.CpModel()

        if not candidates:
            return {
                "status": "NO_CANDIDATES",
                "assignments": {},
                "objective_values": {
                    "priority": 0,
                    "criticality": 0,
                    "scheduled_jobs": 0,
                    "emergency_blocks": 0,
                    "used_blocks": 0,
                    "completion_minutes": 0,
                },
            }

        # --------------------------------------------------------------
        # Candidate variables
        # --------------------------------------------------------------

        candidate_vars = {}
        job_candidates = {}

        # Candidate start/end describe a safe placement WINDOW.
        # The actual maintenance duration comes from the job.
        job_duration_map = {
            str(row.job_id): int(row.duration_min)
            for row in cascade_jobs.itertuples()
        }

        for index, candidate in enumerate(candidates):
            start_value = int(
                pd.Timestamp(candidate.start).value
                // 60_000_000_000
            )
            end_value = int(
                pd.Timestamp(candidate.end).value
                // 60_000_000_000
            )

            # Candidate start/end are the safe placement window.
            # They are NOT the maintenance job duration.
            duration = job_duration_map.get(
                str(candidate.job_id)
            )

            if duration is None or duration <= 0:
                continue

            if end_value - start_value < duration:
                continue

            x = model.NewBoolVar(f"x_{index}")

            start = model.NewIntVar(
                start_value,
                end_value - duration,
                f"s_{index}",
            )
            end = model.NewIntVar(
                start_value + duration,
                end_value,
                f"e_{index}",
            )

            model.Add(
                end == start + duration
            ).OnlyEnforceIf(x)

            interval = model.NewOptionalIntervalVar(
                start,
                duration,
                end,
                x,
                f"interval_{index}",
            )

            candidate_vars[index] = {
                "x": x,
                "start": start,
                "end": end,
                "interval": interval,
                "candidate": candidate,
                "duration": duration,
            }

            job_candidates.setdefault(
                str(candidate.job_id), []
            ).append(index)

        if not candidate_vars:
            return {
                "status": "NO_CANDIDATES",
                "assignments": {},
                "objective_values": {
                    "priority": 0,
                    "criticality": 0,
                    "scheduled_jobs": 0,
                    "emergency_blocks": 0,
                    "used_blocks": 0,
                    "completion_minutes": 0,
                },
            }

        # --------------------------------------------------------------
        # At most one candidate per cascade job
        # --------------------------------------------------------------

        job_selected = {}

        for job_id, indexes in job_candidates.items():
            selected = model.NewBoolVar(f"selected_{job_id}")
            model.Add(
                selected
                == sum(
                    candidate_vars[i]["x"]
                    for i in indexes
                )
            )
            job_selected[job_id] = selected

        # --------------------------------------------------------------
        # Same-section and same-block non-overlap
        # --------------------------------------------------------------

        for section_id in sorted(
            {
                str(
                    candidate_vars[i]["candidate"].section_id
                )
                for i in candidate_vars
            }
        ):
            intervals = [
                candidate_vars[i]["interval"]
                for i in candidate_vars
                if str(
                    candidate_vars[i]["candidate"].section_id
                ) == section_id
            ]
            if intervals:
                model.AddNoOverlap(intervals)

        for block_id in sorted(
            {
                str(
                    candidate_vars[i]["candidate"].block_id
                )
                for i in candidate_vars
            }
        ):
            intervals = [
                candidate_vars[i]["interval"]
                for i in candidate_vars
                if str(
                    candidate_vars[i]["candidate"].block_id
                ) == block_id
            ]
            if intervals:
                model.AddNoOverlap(intervals)

        # --------------------------------------------------------------
        # Objective coefficients
        # --------------------------------------------------------------

        priority_map = {
            str(row.job_id): int(
                round(float(row.priority_score) * 100)
            )
            for row in cascade_jobs.itertuples()
        }

        criticality_map = {
            str(row.job_id): int(
                round(float(row.asset_criticality_score) * 100)
            )
            for row in cascade_jobs.itertuples()
        }

        # --------------------------------------------------------------
        # Emergency-block indicators
        # --------------------------------------------------------------

        emergency_map = {}

        for index, info in candidate_vars.items():
            candidate = info["candidate"]
            block_rows = blocks[
                blocks.block_id.astype(str)
                == str(candidate.block_id)
            ]

            emergency_map[index] = 0
            if not block_rows.empty:
                emergency_map[index] = int(
                    str(
                        block_rows.iloc[0]["block_type"]
                    ).strip().upper()
                    == "EMERGENCY"
                )

        # --------------------------------------------------------------
        # Used-block indicators
        # --------------------------------------------------------------

        used_blocks = {}

        for block_id in sorted(
            {
                str(
                    candidate_vars[i]["candidate"].block_id
                )
                for i in candidate_vars
            }
        ):
            used = model.NewBoolVar(
                f"used_{block_id}"
            )

            block_x = [
                candidate_vars[i]["x"]
                for i in candidate_vars
                if str(
                    candidate_vars[i]["candidate"].block_id
                ) == block_id
            ]

            for x in block_x:
                model.Add(x <= used)

            model.Add(
                used <= sum(block_x)
            )

            used_blocks[block_id] = used

        # --------------------------------------------------------------
        # Solver
        # --------------------------------------------------------------

        solver = cp_model.CpSolver()
        solver.parameters.num_search_workers = 1
        solver.parameters.random_seed = self.random_seed
        solver.parameters.max_time_in_seconds = (
            self.max_time_seconds
        )

        def optimize(expression, maximize):
            if maximize:
                model.Maximize(expression)
            else:
                model.Minimize(expression)

            status = solver.Solve(model)

            if status not in (
                cp_model.OPTIMAL,
                cp_model.FEASIBLE,
            ):
                return None, status

            return int(round(solver.ObjectiveValue())), status

        def fix(expression, value):
            model.Add(expression == int(value))

        # --------------------------------------------------------------
        # Stage 1 — maximize total priority value
        # --------------------------------------------------------------

        priority_expr = sum(
            priority_map.get(job_id, 0)
            * job_selected[job_id]
            for job_id in job_candidates
        )

        priority_value, status = optimize(
            priority_expr,
            maximize=True,
        )

        if priority_value is None:
            return {
                "status": solver.StatusName(status),
                "assignments": {},
                "objective_values": {},
            }

        fix(priority_expr, priority_value)

        # --------------------------------------------------------------
        # Stage 2 — maximize criticality
        # --------------------------------------------------------------

        criticality_expr = sum(
            criticality_map.get(job_id, 0)
            * job_selected[job_id]
            for job_id in job_candidates
        )

        criticality_value, status = optimize(
            criticality_expr,
            maximize=True,
        )

        if criticality_value is None:
            return {
                "status": solver.StatusName(status),
                "assignments": {},
                "objective_values": {},
            }

        fix(criticality_expr, criticality_value)

        # --------------------------------------------------------------
        # Stage 3 — maximize number of scheduled jobs
        # --------------------------------------------------------------

        scheduled_expr = sum(
            job_selected.values()
        )

        scheduled_value, status = optimize(
            scheduled_expr,
            maximize=True,
        )

        if scheduled_value is None:
            return {
                "status": solver.StatusName(status),
                "assignments": {},
                "objective_values": {},
            }

        fix(scheduled_expr, scheduled_value)

        # --------------------------------------------------------------
        # Stage 4 — minimize Emergency-block assignments
        # --------------------------------------------------------------

        emergency_expr = sum(
            emergency_map[i]
            * candidate_vars[i]["x"]
            for i in candidate_vars
        )

        emergency_value, status = optimize(
            emergency_expr,
            maximize=False,
        )

        if emergency_value is None:
            return {
                "status": solver.StatusName(status),
                "assignments": {},
                "objective_values": {},
            }

        fix(emergency_expr, emergency_value)

        # --------------------------------------------------------------
        # Stage 5 — minimize number of used blocks
        # --------------------------------------------------------------

        used_blocks_expr = sum(
            used_blocks.values()
        )

        used_blocks_value, status = optimize(
            used_blocks_expr,
            maximize=False,
        )

        if used_blocks_value is None:
            return {
                "status": solver.StatusName(status),
                "assignments": {},
                "objective_values": {},
            }

        fix(
            used_blocks_expr,
            used_blocks_value,
        )

        # --------------------------------------------------------------
        # Stage 6 — minimize completion time of SELECTED jobs only
        #
        # selected_end = end - horizon_start when x == 1
        # selected_end = 0 otherwise.
        #
        # This avoids the invalid CP-SAT expression:
        #     end * x
        # --------------------------------------------------------------

        horizon_start = min(
            int(
                pd.Timestamp(
                    info["candidate"].start
                ).value
                // 60_000_000_000
            )
            for info in candidate_vars.values()
        )

        completion_terms = []

        for index, info in candidate_vars.items():
            selected_end = model.NewIntVar(
                0,
                max(
                    0,
                    int(
                        pd.Timestamp(
                            info["candidate"].end
                        ).value
                        // 60_000_000_000
                    )
                    - horizon_start,
                ),
                f"selected_end_{index}",
            )

            end_offset = (
                info["end"]
                - horizon_start
            )

            model.Add(
                selected_end == end_offset
            ).OnlyEnforceIf(
                info["x"]
            )

            model.Add(
                selected_end == 0
            ).OnlyEnforceIf(
                info["x"].Not()
            )

            completion_terms.append(
                selected_end
            )

        completion_expr = sum(
            completion_terms
        )

        completion_value, status = optimize(
            completion_expr,
            maximize=False,
        )

        if completion_value is None:
            return {
                "status": solver.StatusName(status),
                "assignments": {},
                "objective_values": {},
            }

        fix(
            completion_expr,
            completion_value,
        )

        # --------------------------------------------------------------
        # Final solve after all lexicographic constraints are fixed.
        # --------------------------------------------------------------

        final_status = solver.Solve(model)

        if final_status not in (
            cp_model.OPTIMAL,
            cp_model.FEASIBLE,
        ):
            return {
                "status": solver.StatusName(final_status),
                "assignments": {},
                "objective_values": {},
            }

        # --------------------------------------------------------------
        # Extract selected assignments.
        # --------------------------------------------------------------

        assignments = {}

        for job_id, indexes in job_candidates.items():
            for index in indexes:
                info = candidate_vars[index]

                if solver.Value(info["x"]) != 1:
                    continue

                candidate = info["candidate"]

                start_value = int(
                    solver.Value(info["start"])
                )

                candidate_start_value = int(
                    pd.Timestamp(
                        candidate.start
                    ).value
                    // 60_000_000_000
                )

                actual_start = (
                    pd.Timestamp(candidate.start)
                    + pd.Timedelta(
                        minutes=(
                            start_value
                            - candidate_start_value
                        )
                    )
                )

                assignments[str(job_id)] = {
                    "candidate": candidate,
                    "start": actual_start,
                    "duration": info["duration"],
                    "end": (
                        actual_start
                        + pd.Timedelta(
                            minutes=info["duration"]
                        )
                    ),
                }

                break

        return {
            "status": solver.StatusName(
                final_status
            ),
            "assignments": assignments,
            "objective_values": {
                "priority": priority_value,
                "criticality": criticality_value,
                "scheduled_jobs": scheduled_value,
                "emergency_blocks": emergency_value,
                "used_blocks": used_blocks_value,
                "completion_minutes": completion_value,
            },
        }

    # ------------------------------------------------------------------
    # Plan construction
    # ------------------------------------------------------------------

    @staticmethod
    def _drop_cascade_jobs(
        current_plan,
        group,
        event,
    ):
        """Mark cascade jobs unscheduled."""

        revised = current_plan.copy()

        mask = revised.job_id.astype(
            str
        ).isin(group.job_ids)

        revised.loc[
            mask,
            "plan_status"
        ] = "UNSCHEDULED"

        revised.loc[
            mask,
            "block_id"
        ] = ""

        revised.loc[
            mask,
            "scheduled_start"
        ] = ""

        revised.loc[
            mask,
            "scheduled_end"
        ] = ""

        return revised

    def _merge_plan(
        self,
        current_plan,
        frozen_plan,
        optimized,
        group,
        event,
    ):
        """Merge frozen and optimized cascade assignments."""

        revised = current_plan.copy()

        assignments = optimized[
            "assignments"
        ]

        for job_id in group.job_ids:

            mask = (
                revised.job_id.astype(str)
                == str(job_id)
            )

            if job_id not in assignments:

                revised.loc[
                    mask,
                    "plan_status"
                ] = "UNSCHEDULED"

                revised.loc[
                    mask,
                    "block_id"
                ] = ""

                revised.loc[
                    mask,
                    "scheduled_start"
                ] = ""

                revised.loc[
                    mask,
                    "scheduled_end"
                ] = ""

                continue

            assignment = assignments[
                job_id
            ]

            candidate = assignment[
                "candidate"
            ]

            start = pd.Timestamp(
                assignment["start"]
            )

            # Always use the actual maintenance job duration
            # returned by the solver.
            duration = int(
                assignment["duration"]
            )

            end = (
                start
                + pd.Timedelta(
                    minutes=duration
                )
            )

            revised.loc[
                mask,
                "plan_status"
            ] = "SCHEDULED"

            revised.loc[
                mask,
                "block_id"
            ] = candidate.block_id

            revised.loc[
                mask,
                "scheduled_start"
            ] = start

            revised.loc[
                mask,
                "scheduled_end"
            ] = end

        return revised

    # ------------------------------------------------------------------
    # Change reporting
    # ------------------------------------------------------------------

    @staticmethod
    def _build_changes(
        current_plan,
        revised_plan,
        event,
        graph,
    ):
        """Build job-level cascading change report."""

        current = current_plan.set_index(
            "job_id",
            drop=False,
        )

        revised = revised_plan.set_index(
            "job_id",
            drop=False,
        )

        rows = []

        for job_id in sorted(
            current.index.astype(str)
        ):

            old = current.loc[
                job_id
            ]

            new = revised.loc[
                job_id
            ]

            old_status = str(
                old.plan_status
            )

            new_status = str(
                new.plan_status
            )

            old_block = (
                ""
                if pd.isna(
                    old.block_id
                )
                else str(
                    old.block_id
                )
            )

            new_block = (
                ""
                if pd.isna(
                    new.block_id
                )
                else str(
                    new.block_id
                )
            )

            old_start = (
                ""
                if pd.isna(
                    old.scheduled_start
                )
                else str(
                    old.scheduled_start
                )
            )

            new_start = (
                ""
                if pd.isna(
                    new.scheduled_start
                )
                else str(
                    new.scheduled_start
                )
            )

            node = graph.nodes.get(
                job_id
            )

            impact_type = (
                node.impact_type
                if node
                else "UNAFFECTED"
            )

            if (
                old_status == new_status
                and old_block == new_block
                and old_start == new_start
            ):
                change_type = "UNCHANGED"

            elif (
                old_status == "SCHEDULED"
                and new_status != "SCHEDULED"
            ):
                change_type = "DROPPED"

            elif (
                old_status != "SCHEDULED"
                and new_status == "SCHEDULED"
            ):
                change_type = "NEWLY_SCHEDULED"

            elif old_block != new_block:
                change_type = "RESCHEDULED"

            elif old_start != new_start:
                change_type = "MOVED"

            else:
                change_type = "CHANGED"

            if change_type == "UNCHANGED":
                reason = "No change required."

            elif impact_type == "DIRECT":
                reason = (
                    "Directly affected by disruption."
                )

            elif impact_type == "INDIRECT":
                reason = (
                    "Moved or reconsidered as part "
                    "of cascading recovery."
                )

            else:
                reason = (
                    "Changed during cascading replanning."
                )

            rows.append(
                {
                    "job_id": job_id,
                    "event_id": event.event_id,
                    "event_type": event.event_type,
                    "event_block_id": event.block_id,
                    "impact_type": impact_type,
                    "previous_status": old_status,
                    "new_status": new_status,
                    "previous_block": old_block,
                    "new_block": new_block,
                    "previous_start": old_start,
                    "new_start": new_start,
                    "change_type": change_type,
                    "change_reason": reason,
                }
            )

        return pd.DataFrame(
            rows
        )