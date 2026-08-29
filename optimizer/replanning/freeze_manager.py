"""Freeze and release existing maintenance assignments during replanning."""

from dataclasses import dataclass

import pandas as pd

from optimizer.replanning.disruption_models import DisruptionEvent
from optimizer.replanning.impact_analyzer import ImpactAnalysis


@dataclass(frozen=True)
class PlanPartition:
    frozen_job_ids: tuple[str, ...]
    released_job_ids: tuple[str, ...]


class FreezeManager:
    """Determines which existing assignments remain locked."""

    def partition(
        self,
        plan: pd.DataFrame,
        impact: ImpactAnalysis,
    ) -> PlanPartition:

        scheduled = plan[
            plan["plan_status"].astype(str).str.upper() == "SCHEDULED"
        ]

        affected = set(impact.affected_job_ids)

        frozen = []
        released = []

        for row in scheduled.itertuples():
            if row.job_id in affected:
                released.append(row.job_id)
            else:
                frozen.append(row.job_id)

        return PlanPartition(
            frozen_job_ids=tuple(sorted(frozen)),
            released_job_ids=tuple(sorted(released)),
        )