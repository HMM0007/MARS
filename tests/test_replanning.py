import pandas as pd

from optimizer.replanning.disruption_models import DisruptionEvent
from optimizer.replanning.impact_analyzer import ImpactAnalyzer
from optimizer.replanning.freeze_manager import FreezeManager
from optimizer.replanning.change_analyzer import ChangeAnalyzer
from optimizer.replanning.cascade_manager import CascadeManager
from optimizer.replanning.impact_graph import ImpactGraphBuilder
from optimizer.replanning.disruption_models import (
    DisruptionEvent,
)
from optimizer.cp_sat.candidate_generator import (
    Candidate,
)


def test_block_unavailability_identifies_affected_jobs():
    plan = pd.DataFrame(
        [
            {
                "job_id": "J036",
                "plan_status": "SCHEDULED",
                "block_id": "B020",
            },
            {
                "job_id": "J014",
                "plan_status": "SCHEDULED",
                "block_id": "B014",
            },
            {
                "job_id": "J018",
                "plan_status": "UNSCHEDULED",
                "block_id": "",
            },
        ]
    )

    event = DisruptionEvent(
        event_id="EVT001",
        event_type="BLOCK_UNAVAILABLE",
        block_id="B020",
    )

    impact = ImpactAnalyzer().analyze(
        plan,
        event,
    )

    assert impact.affected_job_ids == ("J036",)
    assert impact.directly_affected_job_ids == ("J036",)


def test_freeze_manager_separates_affected_jobs():
    plan = pd.DataFrame(
        [
            {
                "job_id": "J036",
                "plan_status": "SCHEDULED",
                "block_id": "B020",
            },
            {
                "job_id": "J014",
                "plan_status": "SCHEDULED",
                "block_id": "B014",
            },
        ]
    )

    impact = type(
        "Impact",
        (),
        {
            "affected_job_ids": ("J036",),
            "directly_affected_job_ids": ("J036",),
            "reasons": {},
        },
    )()

    partition = FreezeManager().partition(
        plan,
        impact,
    )

    assert partition.released_job_ids == ("J036",)
    assert partition.frozen_job_ids == ("J014",)


def test_change_analyzer_detects_reschedule():
    previous = pd.DataFrame(
        [
            {
                "job_id": "J036",
                "plan_status": "SCHEDULED",
                "block_id": "B020",
                "scheduled_start": "2026-08-30 06:30",
            }
        ]
    )

    revised = pd.DataFrame(
        [
            {
                "job_id": "J036",
                "plan_status": "SCHEDULED",
                "block_id": "B019",
                "scheduled_start": "2026-08-30 09:30",
            }
        ]
    )

    result = ChangeAnalyzer().compare(
        previous,
        revised,
    )

    assert result.iloc[0].change_type == "RESCHEDULED"

def test_change_analyzer_does_not_treat_unscheduled_jobs_as_schedule_changes():
    previous = pd.DataFrame(
        [
            {
                "job_id": "J001",
                "plan_status": "UNSCHEDULED",
                "block_id": "",
                "scheduled_start": "",
            },
            {
                "job_id": "J002",
                "plan_status": "SCHEDULED",
                "block_id": "B014",
                "scheduled_start": "2026-08-30 06:00",
            },
        ]
    )

    revised = pd.DataFrame(
        [
            {
                "job_id": "J001",
                "plan_status": "UNSCHEDULED",
                "block_id": "",
                "scheduled_start": "",
            },
            {
                "job_id": "J002",
                "plan_status": "SCHEDULED",
                "block_id": "B014",
                "scheduled_start": "2026-08-30 06:00",
            },
        ]
    )

    result = ChangeAnalyzer().compare(
        previous,
        revised,
    )

    assert (
        result.loc[
            result.job_id == "J001",
            "change_type",
        ].iloc[0]
        == "UNCHANGED"
    )

    assert (
        result.loc[
            result.job_id == "J002",
            "change_type",
        ].iloc[0]
        == "UNCHANGED"
    )

def test_impact_graph_identifies_direct_jobs():
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

    event = DisruptionEvent(
        event_id="EVT-001",
        event_type="BLOCK_UNAVAILABLE",
        block_id="B020",
        severity="HIGH",
        description="B020 unavailable",
    )

    graph = ImpactGraphBuilder(
        max_depth=1
    ).build(
        plan,
        event,
        [],
    )

    assert graph.job_ids(
        "DIRECT"
    ) == {"J001"}

    assert graph.nodes[
        "J001"
    ].depth == 0

def test_impact_graph_identifies_indirect_competitor():
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

    event = DisruptionEvent(
        event_id="EVT-001",
        event_type="BLOCK_UNAVAILABLE",
        block_id="B020",
        severity="HIGH",
        description="B020 unavailable",
    )

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
        event,
        candidates,
    )

    assert graph.job_ids(
        "DIRECT"
    ) == {"J001"}

    assert graph.job_ids(
        "INDIRECT"
    ) == {"J002"}

    assert graph.nodes[
        "J002"
    ].depth == 1

def test_cascade_manager_separates_reconsidered_and_frozen_jobs():
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
            {
                "job_id": "J003",
                "plan_status": "SCHEDULED",
                "block_id": "B014",
                "section_id": "S07",
                "scheduled_start": "2026-08-30 06:00",
                "scheduled_end": "2026-08-30 06:30",
            },
        ]
    )

    event = DisruptionEvent(
        event_id="EVT-001",
        event_type="BLOCK_UNAVAILABLE",
        block_id="B020",
        severity="HIGH",
        description="B020 unavailable",
    )

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

    graph, group = CascadeManager(
        max_depth=1
    ).build_group(
        plan,
        event,
        candidates,
    )

    assert group.direct_job_ids == {
        "J001"
    }

    assert group.indirect_job_ids == {
        "J002"
    }

    assert group.job_ids == {
        "J001",
        "J002",
    }

    assert "J003" in (
        group.frozen_job_ids
    )