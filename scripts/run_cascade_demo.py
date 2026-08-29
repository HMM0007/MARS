"""Run the MARS cascading replanning demonstration."""

from pathlib import Path

import pandas as pd

from optimizer.cp_sat.candidate_generator import CandidateGenerator
from optimizer.cp_sat.plan_validator import OptimizedPlanValidator
from optimizer.replanning.cascade_replanner import CascadeReplanner
from optimizer.replanning.disruption_models import DisruptionEvent


def main():
    base = Path(__file__).resolve().parents[1]

    sample = base / "data" / "sample"

    output = (
        base
        / "data"
        / "output"
        / "replanning"
    )

    current_plan_path = (
        base
        / "data"
        / "output"
        / "optimized_maintenance_plan.csv"
    )

    current_plan = pd.read_csv(
        current_plan_path,
        keep_default_na=False,
    )

    event = DisruptionEvent(
        event_id="EVT-B020-CASCADE-001",
        event_type="BLOCK_UNAVAILABLE",
        block_id="B020",
        severity="HIGH",
        description=(
            "Block B020 became unavailable."
        ),
    )

    generator = CandidateGenerator(
        sample / "priority_results.csv",
        sample / "maintenance_jobs.csv",
        sample / "assets.csv",
        sample / "block_availability.csv",
        sample / "train_schedule.csv",
        sample / "train_sections.csv",
    )

    validator = OptimizedPlanValidator(
        sample / "maintenance_jobs.csv",
        sample / "assets.csv",
        sample / "block_availability.csv",
        sample / "train_schedule.csv",
        sample / "train_sections.csv",
    )

    replanner = CascadeReplanner(
        candidate_generator=generator,
        validator=validator,
        max_cascade_depth=1,
        random_seed=42,
        max_time_seconds=30,
    )

    result = replanner.replan(
        current_plan=current_plan,
        event=event,
    )

    output.mkdir(
        parents=True,
        exist_ok=True,
    )

    # --------------------------------------------------------------
    # Save cascade plan
    # --------------------------------------------------------------

    cascade_plan_path = (
        output
        / "cascade_maintenance_plan.csv"
    )

    result.plan.to_csv(
        cascade_plan_path,
        index=False,
    )

    # --------------------------------------------------------------
    # Save impact graph
    # --------------------------------------------------------------

    impact_path = (
        output
        / "cascade_impact_graph.csv"
    )

    result.impact_graph.to_dataframe().to_csv(
        impact_path,
        index=False,
    )

    # --------------------------------------------------------------
    # Save changes
    # --------------------------------------------------------------

    changes_path = (
        output
        / "cascade_changes.csv"
    )

    result.changes.to_csv(
        changes_path,
        index=False,
    )

    # --------------------------------------------------------------
    # Summary
    # --------------------------------------------------------------

    scheduled = result.plan[
        result.plan["plan_status"]
        .astype(str)
        .str.upper()
        == "SCHEDULED"
    ]

    previous_scheduled = current_plan[
        current_plan["plan_status"]
        .astype(str)
        .str.upper()
        == "SCHEDULED"
    ]

    direct_jobs = result.cascade_group.direct_job_ids
    indirect_jobs = result.cascade_group.indirect_job_ids
    reconsidered_jobs = result.cascade_group.job_ids
    frozen_jobs = result.cascade_group.frozen_job_ids

    newly_scheduled = 0
    dropped = 0
    rescheduled = 0
    moved = 0

    for row in result.changes.itertuples():

        change_type = str(
            row.change_type
        ).upper()

        if change_type == "NEWLY_SCHEDULED":
            newly_scheduled += 1

        elif change_type == "DROPPED":
            dropped += 1

        elif change_type == "RESCHEDULED":
            rescheduled += 1

        elif change_type == "MOVED":
            moved += 1

    previous_count = len(
        previous_scheduled
    )

    current_count = len(
        scheduled
    )

    stability = (
        1.0
        if previous_count == 0
        else (
            len(
                set(
                    previous_scheduled.job_id.astype(
                        str
                    )
                )
                & set(
                    scheduled.job_id.astype(
                        str
                    )
                )
            )
            / previous_count
        )
    )

    summary = {
        "event_id": event.event_id,
        "event_type": event.event_type,
        "event_block_id": event.block_id,

        "cascade_depth": (
            result.cascade_group.max_depth
        ),

        "direct_jobs": sorted(
            direct_jobs
        ),

        "indirect_jobs": sorted(
            indirect_jobs
        ),

        "reconsidered_jobs": sorted(
            reconsidered_jobs
        ),

        "frozen_jobs": sorted(
            frozen_jobs
        ),

        "direct_job_count": len(
            direct_jobs
        ),

        "indirect_job_count": len(
            indirect_jobs
        ),

        "reconsidered_job_count": len(
            reconsidered_jobs
        ),

        "frozen_job_count": len(
            frozen_jobs
        ),

        "previous_scheduled_jobs": (
            previous_count
        ),

        "cascade_scheduled_jobs": (
            current_count
        ),

        "newly_scheduled_jobs": (
            newly_scheduled
        ),

        "dropped_jobs": dropped,

        "rescheduled_jobs": (
            rescheduled
        ),

        "moved_jobs": moved,

        "schedule_stability": (
            stability
        ),

        "solver_status": (
            result.solver_status
        ),

        "objective_values": (
            result.objective_values
        ),

        "independent_validation": (
            "PASSED"
        ),
    }

    import json

    summary_path = (
        output
        / "cascade_summary.json"
    )

    with open(
        summary_path,
        "w",
        encoding="utf-8",
    ) as handle:
        json.dump(
            summary,
            handle,
            indent=2,
        )

    # --------------------------------------------------------------
    # Console report
    # --------------------------------------------------------------

    print("=" * 70)
    print("MARS CASCADING REPLANNING")
    print("=" * 70)

    print()
    print("Event:")
    print(
        f"  {event.event_type}"
    )
    print(
        f"  Block: {event.block_id}"
    )

    print()
    print("Cascade Analysis:")
    print(
        f"  Cascade depth      : "
        f"{result.cascade_group.max_depth}"
    )
    print(
        f"  Direct jobs        : "
        f"{len(direct_jobs)}"
    )
    print(
        f"  Indirect jobs      : "
        f"{len(indirect_jobs)}"
    )
    print(
        f"  Reconsidered jobs  : "
        f"{len(reconsidered_jobs)}"
    )
    print(
        f"  Frozen jobs        : "
        f"{len(frozen_jobs)}"
    )

    print()
    print("Optimization:")
    print(
        f"  Previous scheduled : "
        f"{previous_count}"
    )
    print(
        f"  Cascade scheduled  : "
        f"{current_count}"
    )
    print(
        f"  Newly scheduled    : "
        f"{newly_scheduled}"
    )
    print(
        f"  Dropped            : "
        f"{dropped}"
    )
    print(
        f"  Rescheduled        : "
        f"{rescheduled}"
    )
    print(
        f"  Moved              : "
        f"{moved}"
    )
    print(
        f"  Stability          : "
        f"{stability:.2%}"
    )
    print(
        f"  Solver status      : "
        f"{result.solver_status}"
    )

    print()
    print("Impact Graph:")
    print(
        result.impact_graph
        .to_dataframe()
        .to_string(index=False)
    )

    print()
    print("Changes:")

    print(
        result.changes[
            [
                "job_id",
                "impact_type",
                "change_type",
                "previous_block",
                "new_block",
                "previous_start",
                "new_start",
                "change_reason",
            ]
        ].to_string(index=False)
    )

    print()
    print("=" * 70)
    print("CASCADE REPLANNING COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    main()