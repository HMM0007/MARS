import pandas as pd

from optimizer.replanning.impact_graph import (
    ImpactGraphBuilder,
)


def test_cascade_depth_zero_only_direct_jobs():
    plan = pd.DataFrame(
        [
            {
                "job_id": "J001",
                "plan_status": "SCHEDULED",
                "block_id": "B020",
                "section_id": "S10",
                "scheduled_start": "2026-08-30 06:00",
                "scheduled_end": "2026-08-30 07:30",
            },
            {
                "job_id": "J002",
                "plan_status": "SCHEDULED",
                "block_id": "B019",
                "section_id": "S10",
                "scheduled_start": "2026-08-30 09:00",
                "scheduled_end": "2026-08-30 09:30",
            },
        ]
    )

    class Event:
        event_id = "EVT-001"
        event_type = "BLOCK_UNAVAILABLE"
        block_id = "B020"

    graph = ImpactGraphBuilder(
        max_depth=0
    ).build(
        plan,
        Event(),
        [],
    )

    assert graph.job_ids("DIRECT") == {
        "J001"
    }

    assert graph.job_ids("INDIRECT") == set()

def test_cascade_depth_one_finds_indirect_job():
    plan = pd.DataFrame(
        [
            {
                "job_id": "J001",
                "plan_status": "SCHEDULED",
                "block_id": "B020",
                "section_id": "S10",
                "scheduled_start": "2026-08-30 06:00",
                "scheduled_end": "2026-08-30 07:30",
            },
            {
                "job_id": "J002",
                "plan_status": "SCHEDULED",
                "block_id": "B019",
                "section_id": "S10",
                "scheduled_start": "2026-08-30 09:00",
                "scheduled_end": "2026-08-30 09:30",
            },
        ]
    )

    class Event:
        event_id = "EVT-001"
        event_type = "BLOCK_UNAVAILABLE"
        block_id = "B020"

    from optimizer.cp_sat.candidate_generator import Candidate

    candidates = [
        Candidate(
            job_id="J001",
            block_id="B019",
            section_id="S10",
            start=pd.Timestamp(
                "2026-08-30 09:00"
            ),
            end=pd.Timestamp(
                "2026-08-30 11:00"
            ),
        )
    ]

    graph = ImpactGraphBuilder(
        max_depth=1
    ).build(
        plan,
        Event(),
        candidates,
    )

    assert graph.job_ids("DIRECT") == {
        "J001"
    }

    assert graph.job_ids("INDIRECT") == {
        "J002"
    }

    assert graph.nodes["J002"].depth == 1