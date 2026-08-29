"""Compare maintenance plans before and after replanning."""

import pandas as pd


class ChangeAnalyzer:
    """Generate job-level explanations for plan changes."""

    def compare(
        self,
        previous_plan: pd.DataFrame,
        revised_plan: pd.DataFrame,
    ) -> pd.DataFrame:

        previous = previous_plan.set_index(
            "job_id"
        )

        revised = revised_plan.set_index(
            "job_id"
        )

        job_ids = sorted(
            set(previous.index)
            | set(revised.index)
        )

        records = []

        for job_id in job_ids:

            old = (
                previous.loc[job_id]
                if job_id in previous.index
                else None
            )

            new = (
                revised.loc[job_id]
                if job_id in revised.index
                else None
            )

            old_status = (
                str(old.plan_status).upper()
                if old is not None
                else "NEW"
            )

            new_status = (
                str(new.plan_status).upper()
                if new is not None
                else "REMOVED"
            )

            old_block = (
                old.block_id
                if old is not None
                and pd.notna(old.block_id)
                and str(old.block_id) != ""
                else None
            )

            new_block = (
                new.block_id
                if new is not None
                and pd.notna(new.block_id)
                and str(new.block_id) != ""
                else None
            )

            old_start = (
                old.scheduled_start
                if old is not None
                and pd.notna(old.scheduled_start)
                and str(old.scheduled_start) != ""
                else None
            )

            new_start = (
                new.scheduled_start
                if new is not None
                and pd.notna(new.scheduled_start)
                and str(new.scheduled_start) != ""
                else None
            )

            # ------------------------------------------------------
            # Change classification
            # ------------------------------------------------------

            if (
                old_status == "SCHEDULED"
                and new_status == "SCHEDULED"
            ):

                if (
                    old_block == new_block
                    and old_start == new_start
                ):
                    change_type = "UNCHANGED"
                else:
                    change_type = "RESCHEDULED"

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

            else:

                # Already-unscheduled → still-unscheduled.
                # This is not an operational change.
                change_type = "UNCHANGED"

            records.append(
                {
                    "job_id": job_id,
                    "previous_status": old_status,
                    "new_status": new_status,
                    "previous_block": old_block,
                    "new_block": new_block,
                    "previous_start": old_start,
                    "new_start": new_start,
                    "change_type": change_type,
                }
            )

        return pd.DataFrame(
            records
        )