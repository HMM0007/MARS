from pathlib import Path

import pandas as pd

from optimizer.replanning.disruption_models import DisruptionEvent
from optimizer.replanning.replan_optimizer import ReplanOptimizer


def main():
    base = Path(__file__).resolve().parents[1]

    sample = base / "data" / "sample"
    output = base / "data" / "output" / "replanning"

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
        event_id="EVT-B020-001",
        event_type="BLOCK_UNAVAILABLE",
        block_id="B020",
        severity="HIGH",
        description="Block B020 became unavailable.",
    )

    optimizer = ReplanOptimizer(
        sample / "priority_results.csv",
        sample / "maintenance_jobs.csv",
        sample / "assets.csv",
        sample / "block_availability.csv",
        sample / "train_schedule.csv",
        sample / "train_sections.csv",
    )

    revised_plan, changes, summary = optimizer.replan(
        current_plan=current_plan,
        event=event,
        output_dir=output,
    )

    print("=" * 70)
    print("MARS DYNAMIC REPLANNING")
    print("=" * 70)

    print()
    print("Event:")
    print(f"  {event.event_type}")
    print(f"  Block: {event.block_id}")
    print()

    print("Summary:")
    print(f"  Frozen jobs       : {summary['frozen_jobs']}")
    print(f"  Released jobs     : {summary['released_jobs']}")
    print(f"  Rescheduled jobs  : {summary['rescheduled_jobs']}")
    print(f"  Dropped jobs      : {summary['dropped_jobs']}")
    print(f"  Unchanged jobs    : {summary['unchanged_jobs']}")
    print(f"  Schedule stability: {summary['schedule_stability']:.2%}")
    print(f"  Solver status     : {summary['solver_status']}")

    print()
    print("Changes:")
    print(
        changes[
            [
                "job_id",
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
    print("REPLANNING COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    main()