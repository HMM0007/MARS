import pytest
from app.core.router import get_all_scored_jobs, get_approved_weekly_plan_history
from app.core.plan_state_store import get_approved_plan, approve_plan, list_approved_plan_history


def test_approved_plan_history_and_job_sync():
    # Verify history returns entries
    history = list_approved_plan_history()
    assert isinstance(history, list)
    assert len(history) >= 1
    assert "revision" in history[0]
    assert "block_count" in history[0]

    # Verify get_all_scored_jobs synchronizes with approved plan
    jobs = get_all_scored_jobs()
    assert len(jobs) > 0

    approved = get_approved_plan()
    if approved and approved.get("plan"):
        blocks = approved["plan"].get("scheduled_blocks") or approved["plan"].get("blocks") or []
        scheduled_ids = {jid for b in blocks if isinstance(b, dict) for jid in b.get("job_ids", [])}
        for job in jobs:
            if job.job_id in scheduled_ids:
                assert job.status == "SCHEDULED"
