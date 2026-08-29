"""Manage bounded cascading replanning groups."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from optimizer.replanning.impact_graph import (
    ImpactGraph,
    ImpactGraphBuilder,
)


@dataclass(frozen=True)
class CascadeGroup:
    """Jobs that may be jointly reconsidered."""

    job_ids: frozenset[str]
    direct_job_ids: frozenset[str]
    indirect_job_ids: frozenset[str]
    frozen_job_ids: frozenset[str]
    max_depth: int


class CascadeManager:
    """Construct bounded replanning groups."""

    def __init__(
        self,
        max_depth: int = 1,
    ):
        self.max_depth = max_depth

        self.graph_builder = (
            ImpactGraphBuilder(
                max_depth=max_depth
            )
        )

    def build_group(
        self,
        current_plan: pd.DataFrame,
        event,
        candidates,
    ) -> tuple[
        ImpactGraph,
        CascadeGroup,
    ]:
        """Build the impact graph and corresponding group."""

        graph = self.graph_builder.build(
            current_plan=current_plan,
            event=event,
            candidates=candidates,
        )

        direct = frozenset(
            graph.job_ids(
                "DIRECT"
            )
        )

        indirect = frozenset(
            graph.job_ids(
                "INDIRECT"
            )
        )

        reconsider = frozenset(
            set(direct)
            | set(indirect)
        )

        scheduled_ids = frozenset(
            current_plan.loc[
                current_plan.plan_status
                .astype(str)
                .str.upper()
                == "SCHEDULED",
                "job_id",
            ].astype(str)
        )

        frozen = frozenset(
            scheduled_ids
            - reconsider
        )

        group = CascadeGroup(
            job_ids=reconsider,
            direct_job_ids=direct,
            indirect_job_ids=indirect,
            frozen_job_ids=frozen,
            max_depth=self.max_depth,
        )

        return graph, group

    @staticmethod
    def summary(
        graph: ImpactGraph,
        group: CascadeGroup,
    ) -> dict:
        """Create a concise summary for logs/dashboard."""

        return {
            "cascade_depth": group.max_depth,
            "direct_jobs": sorted(
                group.direct_job_ids
            ),
            "indirect_jobs": sorted(
                group.indirect_job_ids
            ),
            "reconsidered_jobs": sorted(
                group.job_ids
            ),
            "frozen_jobs": sorted(
                group.frozen_job_ids
            ),
            "direct_job_count": len(
                group.direct_job_ids
            ),
            "indirect_job_count": len(
                group.indirect_job_ids
            ),
            "reconsidered_job_count": len(
                group.job_ids
            ),
            "frozen_job_count": len(
                group.frozen_job_ids
            ),
        }