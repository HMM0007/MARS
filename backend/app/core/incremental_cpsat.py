"""Incremental CP-SAT repair engine for MARS 2.0.

The incremental engine reuses the hardened weekly CP-SAT model instead of
creating a second, divergent constraint implementation. Existing approved
blocks outside the affected neighbourhood are hard-frozen; the new/affected
jobs remain free for CP-SAT to repair. The previous plan is also supplied as a
repair hint for the mutable neighbourhood.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Set

from app.core.weekly_solver import WeeklyCPSATSolver
from app.models.job import MaintenanceJob
from app.models.train import TrainMovement


class IncrementalCPSATSolver(WeeklyCPSATSolver):
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

    @classmethod
    def _job_ids_from_block(cls, block: Dict[str, Any]) -> List[str]:
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
        blocks = self._scheduled_blocks()

        # A local repair neighbourhood is deliberately conservative: same
        # physical track, section, or asset can interact with the new job.
        new_job = jobs_by_id[self.new_job_id]
        for job in self.jobs:
            if job.job_id == self.new_job_id:
                continue
            if (
                job.track_id == new_job.track_id
                or job.section_id == new_job.section_id
                or job.asset_id == new_job.asset_id
            ):
                self.affected_job_ids.add(job.job_id)

        # Existing dependencies can force a wider but still deterministic
        # neighbourhood. Repeat until the dependency graph reaches a fixed point.
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

        for block in blocks:
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

        # Only already scheduled jobs outside the repair neighbourhood are
        # frozen. Deferred jobs remain available to CP-SAT if the new job creates
        # capacity trade-offs that make their return beneficial.
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
        """Hint the previous plan while leaving the repair neighbourhood mutable."""
        self._add_repair_constraints(job_vars, scheduled)

        for job_id, start_step in self.fixed_assignments.items():
            if job_id in job_vars:
                self.model.AddHint(scheduled[job_id], 1)
                self.model.AddHint(job_vars[job_id]["start"], start_step)

        # Give mutable jobs a neutral hint only for the new job. The base
        # greedy routine remains the source of the normal full-plan warm start;
        # fixed jobs are already hard constrained above and therefore cannot be
        # accidentally moved by a heuristic hint.
        if self.new_job_id in job_vars:
            self.model.AddHint(scheduled[self.new_job_id], 1)

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
