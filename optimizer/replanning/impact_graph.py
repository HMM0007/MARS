"""Build a local dependency graph for cascading railway replanning."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

import pandas as pd


@dataclass
class ImpactNode:
    """One job participating in disruption analysis."""

    job_id: str
    impact_type: str
    depth: int
    reason: str


@dataclass
class ImpactGraph:
    """Directed local impact graph."""

    nodes: dict[str, ImpactNode] = field(default_factory=dict)
    edges: dict[str, set[str]] = field(default_factory=dict)

    def add_node(
        self,
        job_id: str,
        impact_type: str,
        depth: int,
        reason: str,
    ) -> None:
        """Add or upgrade a job's impact classification."""

        existing = self.nodes.get(job_id)

        if existing is None:
            self.nodes[job_id] = ImpactNode(
                job_id=job_id,
                impact_type=impact_type,
                depth=depth,
                reason=reason,
            )
            self.edges.setdefault(
                job_id,
                set(),
            )
            return

        # Prefer the smallest depth.
        if depth < existing.depth:
            existing.depth = depth

        # DIRECT is stronger than INDIRECT.
        if (
            impact_type == "DIRECT"
            and existing.impact_type != "DIRECT"
        ):
            existing.impact_type = "DIRECT"
            existing.reason = reason

    def add_edge(
        self,
        source_job_id: str,
        target_job_id: str,
    ) -> None:
        """Record that source caused target to become relevant."""

        if source_job_id == target_job_id:
            return

        self.edges.setdefault(
            source_job_id,
            set(),
        ).add(target_job_id)

    def job_ids(
        self,
        impact_type: str | None = None,
    ) -> set[str]:
        """Return job IDs, optionally filtered by impact type."""

        if impact_type is None:
            return set(self.nodes)

        return {
            job_id
            for job_id, node in self.nodes.items()
            if node.impact_type == impact_type
        }

    def to_dataframe(self) -> pd.DataFrame:
        """Return a dashboard-friendly representation."""

        records = []

        for job_id, node in sorted(
            self.nodes.items(),
            key=lambda item: (
                item[1].depth,
                item[0],
            ),
        ):
            records.append(
                {
                    "job_id": job_id,
                    "impact_type": node.impact_type,
                    "cascade_depth": node.depth,
                    "impact_reason": node.reason,
                }
            )

        return pd.DataFrame(records)


class ImpactGraphBuilder:
    """Build a bounded impact graph from a disruption."""

    def __init__(
        self,
        max_depth: int = 1,
    ):
        if max_depth < 0:
            raise ValueError(
                "max_depth must be >= 0"
            )

        self.max_depth = max_depth

    @staticmethod
    def _scheduled_jobs(
        plan: pd.DataFrame,
    ) -> pd.DataFrame:
        """Return scheduled rows only."""

        if plan.empty:
            return plan.copy()

        return plan[
            plan["plan_status"]
            .astype(str)
            .str.upper()
            == "SCHEDULED"
        ].copy()

    @staticmethod
    def _overlaps(
        start_a: pd.Timestamp,
        end_a: pd.Timestamp,
        start_b: pd.Timestamp,
        end_b: pd.Timestamp,
    ) -> bool:
        """Half-open interval overlap."""

        return (
            start_a < end_b
            and start_b < end_a
        )

    @classmethod
    def _row_interval(
        cls,
        row,
    ) -> tuple[pd.Timestamp, pd.Timestamp] | None:
        """Extract a valid schedule interval."""

        if (
            pd.isna(row.scheduled_start)
            or pd.isna(row.scheduled_end)
        ):
            return None

        start = pd.Timestamp(
            row.scheduled_start
        )
        end = pd.Timestamp(
            row.scheduled_end
        )

        if end <= start:
            return None

        return start, end

    @classmethod
    def _direct_jobs_for_event(
        cls,
        plan: pd.DataFrame,
        event,
    ) -> set[str]:
        """Find jobs directly affected by the disruption."""

        scheduled = cls._scheduled_jobs(
            plan
        )

        if scheduled.empty:
            return set()

        event_block = getattr(
            event,
            "block_id",
            None,
        )

        if event.event_type == "BLOCK_UNAVAILABLE":

            if not event_block:
                return set()

            return set(
                scheduled.loc[
                    scheduled.block_id.astype(str)
                    == str(event_block),
                    "job_id",
                ].astype(str)
            )

        return set()

    @classmethod
    def _find_competing_jobs(
        cls,
        affected_job_id: str,
        affected_candidates: pd.DataFrame,
        scheduled_plan: pd.DataFrame,
    ) -> list[str]:
        """Find scheduled jobs occupying candidate windows.

        A scheduled job becomes an indirect candidate when it occupies
        the same section and overlaps a feasible alternative window
        of the directly affected job.
        """

        if affected_candidates.empty:
            return []

        scheduled = cls._scheduled_jobs(
            scheduled_plan
        )

        if scheduled.empty:
            return []

        competitors = set()

        candidate_rows = affected_candidates[
            affected_candidates.job_id.astype(str)
            == str(affected_job_id)
        ]

        for candidate in candidate_rows.itertuples():

            candidate_start = pd.Timestamp(
                candidate.start
            )

            candidate_end = pd.Timestamp(
                candidate.end
            )

            for job in scheduled.itertuples():

                if str(job.job_id) == str(
                    affected_job_id
                ):
                    continue

                if str(job.section_id) != str(
                    candidate.section_id
                ):
                    continue

                interval = cls._row_interval(
                    job
                )

                if interval is None:
                    continue

                job_start, job_end = interval

                if cls._overlaps(
                    candidate_start,
                    candidate_end,
                    job_start,
                    job_end,
                ):
                    competitors.add(
                        str(job.job_id)
                    )

        return sorted(
            competitors
        )

    def build(
        self,
        current_plan: pd.DataFrame,
        event,
        candidates: Iterable,
    ) -> ImpactGraph:
        """Build a bounded impact graph.

        `candidates` should normally be the raw feasible candidates
        produced by CandidateGenerator before frozen-job subtraction.

        Depth semantics:

            0 = directly affected jobs

            1 = scheduled jobs occupying alternative windows
                required by direct jobs

        No node beyond max_depth is added.
        """

        graph = ImpactGraph()

        candidate_records = list(
            candidates
        )

        direct_jobs = (
            self._direct_jobs_for_event(
                current_plan,
                event,
            )
        )

        # --------------------------------------------------------------
        # Depth 0: direct impact
        # --------------------------------------------------------------

        for job_id in sorted(
            direct_jobs
        ):
            graph.add_node(
                job_id=job_id,
                impact_type="DIRECT",
                depth=0,
                reason=(
                    f"Assigned block "
                    f"{event.block_id} became unavailable."
                ),
            )

        if self.max_depth == 0:
            return graph

        # --------------------------------------------------------------
        # Depth 1+: indirect impact
        # --------------------------------------------------------------

        affected_ids = set(
            direct_jobs
        )

        for depth in range(
            1,
            self.max_depth + 1,
        ):

            current_level = sorted(
                affected_ids
            )

            new_jobs = set()

            candidate_frame = pd.DataFrame(
                [
                    {
                        "job_id": candidate.job_id,
                        "block_id": candidate.block_id,
                        "section_id": candidate.section_id,
                        "start": candidate.start,
                        "end": candidate.end,
                    }
                    for candidate in candidate_records
                    if candidate.job_id in affected_ids
                ]
            )

            if candidate_frame.empty:
                break

            competitors = self._find_competing_jobs_for_level(
                current_level,
                candidate_frame,
                current_plan,
            )

            for source_job_id, target_jobs in competitors.items():

                for target_job_id in target_jobs:

                    if target_job_id in graph.nodes:
                        continue

                    graph.add_node(
                        job_id=target_job_id,
                        impact_type="INDIRECT",
                        depth=depth,
                        reason=(
                            f"Scheduled job {target_job_id} "
                            "occupies a candidate window "
                            f"needed by affected job "
                            f"{source_job_id}."
                        ),
                    )

                    graph.add_edge(
                        source_job_id,
                        target_job_id,
                    )

                    new_jobs.add(
                        target_job_id
                    )

            if not new_jobs:
                break

            affected_ids.update(
                new_jobs
            )

        return graph

    def _find_competing_jobs_for_level(
        self,
        source_job_ids: list[str],
        candidate_frame: pd.DataFrame,
        current_plan: pd.DataFrame,
    ) -> dict[str, list[str]]:
        """Return source job -> competing scheduled jobs."""

        result = {}

        for source_job_id in source_job_ids:

            source_candidates = candidate_frame[
                candidate_frame.job_id.astype(str)
                == str(source_job_id)
            ]

            competitors = self._find_competing_jobs(
                source_job_id,
                source_candidates,
                current_plan,
            )

            if competitors:
                result[source_job_id] = competitors

        return result