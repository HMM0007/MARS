"""Incremental CP-SAT repair engine for MARS 2.0.

The incremental engine reuses the hardened weekly CP-SAT model instead of
creating a second, divergent constraint implementation. Existing approved
blocks outside the affected neighbourhood are hard-frozen; the new/affected
jobs remain free for CP-SAT to repair. The previous plan is also used as a
repair warm-start.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Set, Tuple

from app.core.hardened_weekly_solver import HardenedWeeklyCPSATSolver
from app.models.job import MaintenanceJob
from app.models.train import TrainMovement


class IncrementalCPSATSolver(HardenedWeeklyCPSATSolver):
    """Repair an existing weekly plan after a new or changed maintenance job."""

    MODEL_VERSION = "incremental-cpsat-v1"

    def __init__(
        self,
        jobs: List[MaintenanceJob],
        trains: List[TrainMovement],
        start_monday: datetime,
        existing_plan: Dict[str, Any],
        new_job_id: str,
    ) -> None:
        super().__init__(jobs, trains, start_monday)
        self.existing_plan = existing_plan or {}
        self.new_job_id = new_job_id
        self.fixed_assignments: Dict[str, int] = {}
        self.affected_job_ids: Set[str] = {new_job_id}
        self._prepare_repair_neighbourhood()

    @staticmethod
    def _parse_time(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value.replace(tzinfo=None)
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)

    @staticmethod
    def _job_ids_from_block(block: Dict[str, Any]) -> List[str]:
        return [str(job_id) for job_id in block.get("job_ids", [])]

    def _scheduled_blocks(self) -> List[Dict[str, Any]]:
        blocks = self.existing_plan.get("scheduled_blocks", [])
        if not isinstance(blocks, list):
            raise ValueError("existing_plan.scheduled_blocks must be a list")
        return [block for block in blocks if isinstance(block, dict)]

    def _prepare_repair_neighbourhood(self) -> None:
        jobs_by_id = {job.job_id: job for job in self.jobs}
        if self.new_job_id not in jobs_by_id:
            raise ValueError(f"New job '{self.new_job_id}' is missing from the repair job pool")

        scheduled_ids: Set[str] = set()
        new_job = jobs_by_id[self.new_job_id]

        # Local repair neighbourhood: jobs that can physically or logically
        # interact with the new job remain mutable. Everything else is frozen.
        for job in self.jobs:
            if job.job_id == self.new_job_id:
                continue
            if (
                job.track_id == new_job.track_id
                or job.section_id == new_job.section_id
                or job.asset_id == new_job.asset_id
            ):
                self.affected_job_ids.add(job.job_id)

        # Expand through dependencies until the graph reaches a fixed point.
        changed = True
        while changed:
            changed = False
            for job in self.jobs:
                dep_id = job.dependency_job_id
                if job.job_id in self.affected_job_ids and dep_id in jobs_by_id and dep_id not in self.affected_job_ids:
                    self.affected_job_ids.add(dep_id)
                    changed = True
                if dep_id in self.affected_job_ids and job.job_id not in self.affected_job_ids:
                    self.affected_job_ids.add(job.job_id)
                    changed = True

        for block in self._scheduled_blocks():
            job_ids = self._job_ids_from_block(block)
            scheduled_ids.update(job_ids)
            if not job_ids or any(job_id in self.affected_job_ids for job_id in job_ids):
                continue

            start_time = block.get("start_time")
            if not start_time:
                raise ValueError(f"Scheduled block {block.get('block_id', '<unknown>')} has no start_time")
            start_step = self._datetime_to_step(self._parse_time(start_time))
            for job_id in job_ids:
                if job_id in jobs_by_id:
                    self.fixed_assignments[job_id] = start_step

        self.fixed_assignments = {
            job_id: step
            for job_id, step in self.fixed_assignments.items()
            if job_id in scheduled_ids and job_id not in self.affected_job_ids
        }

    def _add_repair_constraints(
        self,
        job_vars: Dict[str, Dict[str, Any]],
        scheduled: Dict[str, Any],
    ) -> None:
        """Hard-freeze approved jobs outside the incremental neighbourhood."""
        for job_id, start_step in self.fixed_assignments.items():
            if job_id not in job_vars:
                continue
            self.model.Add(scheduled[job_id] == 1)
            self.model.Add(job_vars[job_id]["start"] == start_step)

    def _add_greedy_hints(
        self,
        job_vars: Dict[str, Dict[str, Any]],
        scheduled: Dict[str, Any],
    ) -> None:
        """Warm-start fixed jobs exactly and mutable jobs around fixed occupancy."""
        self._add_repair_constraints(job_vars, scheduled)

        occupied: Dict[str, List[Tuple[int, int]]] = defaultdict(list)
        train_windows: Dict[str, List[Tuple[int, int]]] = defaultdict(list)
        jobs_by_id = {job.job_id: job for job in self.jobs}

        for train in self.trains:
            ts = self._datetime_to_step(train.entry_time)
            te = self._datetime_to_step(train.exit_time)
            if te > ts:
                train_windows[train.track_id].append(
                    (max(0, ts - 1), min(7 * 96, te + 1))
                )

        # Seed hint occupancy with frozen approved blocks.
        for job_id, start in self.fixed_assignments.items():
            job = jobs_by_id.get(job_id)
            if not job:
                continue
            duration = job_vars[job_id]["duration_steps"]
            occupied[job.track_id].append((start, start + duration))
            self.model.AddHint(scheduled[job_id], 1)
            self.model.AddHint(job_vars[job_id]["start"], start)

        # Build a first-fit hint only for mutable jobs. It is a hint, not a
        # constraint; CP-SAT remains free to repair it when required.
        for job in sorted(
            (j for j in self.jobs if j.job_id not in self.fixed_assignments),
            key=lambda j: (-(j.ai_priority_score or 0), j.due_date, j.job_id),
        ):
            v = job_vars[job.job_id]
            duration = v["duration_steps"]
            placed = False
            for start in range(0, 7 * 96 - duration + 1):
                end = start + duration
                if getattr(job, "preferred_window", "ANY") == "NIGHT" and not self._night_start(start):
                    continue
                if any(not (end <= a or start >= b) for a, b in occupied[job.track_id]):
                    continue
                if any(not (end <= a or start >= b) for a, b in train_windows[job.track_id]):
                    continue
                occupied[job.track_id].append((start, end))
                self.model.AddHint(scheduled[job.job_id], 1)
                self.model.AddHint(v["start"], start)
                placed = True
                break
            if not placed:
                self.model.AddHint(scheduled[job.job_id], 0)

    def solve(self) -> Dict[str, Any]:
        result = super().solve()
        scheduled_ids = {
            job_id
            for block in result.get("scheduled_blocks", [])
            for job_id in block.get("job_ids", [])
        }
        moved_job_ids: List[str] = []
        for job_id in self.affected_job_ids:
            old_step = None
            for block in self._scheduled_blocks():
                if job_id in self._job_ids_from_block(block) and block.get("start_time"):
                    old_step = self._datetime_to_step(self._parse_time(block["start_time"]))
                    break
            new_step = None
            for block in result.get("scheduled_blocks", []):
                if job_id in block.get("job_ids", []) and block.get("start_time"):
                    new_step = self._datetime_to_step(self._parse_time(block["start_time"]))
                    break
            if old_step != new_step:
                moved_job_ids.append(job_id)

        result["incremental"] = {
            "model_version": self.MODEL_VERSION,
            "new_job_id": self.new_job_id,
            "affected_job_count": len(self.affected_job_ids),
            "frozen_job_count": len(self.fixed_assignments),
            "frozen_job_ids": sorted(self.fixed_assignments),
            "moved_or_new_job_ids": sorted(moved_job_ids),
            "scheduled_new_job": self.new_job_id in scheduled_ids,
            "repair_mode": "LOCAL_NEIGHBORHOOD_WITH_FROZEN_APPROVED_BLOCKS",
        }
        return result
