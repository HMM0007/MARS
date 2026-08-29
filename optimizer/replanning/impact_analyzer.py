"""Identify maintenance jobs affected by operational disruptions."""

from dataclasses import dataclass

import pandas as pd

from optimizer.replanning.disruption_models import DisruptionEvent


@dataclass(frozen=True)
class ImpactAnalysis:
    affected_job_ids: tuple[str, ...]
    directly_affected_job_ids: tuple[str, ...]
    reasons: dict[str, str]


class ImpactAnalyzer:
    """Analyze how a disruption affects the current maintenance plan."""

    def analyze(
        self,
        plan: pd.DataFrame,
        event: DisruptionEvent,
    ) -> ImpactAnalysis:

        required = {
            "job_id",
            "plan_status",
        }

        missing = required - set(plan.columns)

        if missing:
            raise ValueError(
                f"Plan is missing columns: {sorted(missing)}"
            )

        scheduled = plan[
            plan["plan_status"]
            .astype(str)
            .str.upper()
            == "SCHEDULED"
        ]

        affected = []
        reasons = {}

        if event.event_type == "BLOCK_UNAVAILABLE":

            for row in scheduled.itertuples():

                if str(row.block_id) != str(event.block_id):
                    continue

                affected.append(row.job_id)

                reasons[row.job_id] = (
                    f"Current assignment uses block "
                    f"{event.block_id}, which became unavailable."
                )

        elif event.event_type == "BLOCK_TIME_CHANGE":

            for row in scheduled.itertuples():

                if str(row.block_id) != str(event.block_id):
                    continue

                affected.append(row.job_id)

                reasons[row.job_id] = (
                    f"Current assignment uses block "
                    f"{event.block_id}, whose operating window changed."
                )

        elif event.event_type == "TRAIN_DELAY":

            # Intentionally deferred until the block-unavailability
            # replanner is validated.
            pass

        elif event.event_type == "NEW_MAINTENANCE_JOB":

            # A new job has no existing assignment to invalidate.
            pass

        return ImpactAnalysis(
            affected_job_ids=tuple(
                sorted(set(affected))
            ),
            directly_affected_job_ids=tuple(
                sorted(set(affected))
            ),
            reasons=reasons,
        )