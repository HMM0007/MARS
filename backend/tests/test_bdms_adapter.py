from pathlib import Path

import pytest

from app.adapters import bdms_adapter
from app.adapters.bdms_adapter import BDMSAdapter


@pytest.fixture()
def isolated_transactions(tmp_path, monkeypatch):
    transactions_path = tmp_path / "bdms_transactions.json"
    monkeypatch.setattr(bdms_adapter, "TRANSACTIONS_PATH", transactions_path)
    monkeypatch.setattr(bdms_adapter, "RAW_DIR", tmp_path)
    return transactions_path


def approved_plan():
    return {
        "division": "Pune Division (CR)",
        "planning_week": 1,
        "plan_version": "W1-V3",
        "approval_id": "APR-2026-001",
        "approval_status": "APPROVED",
        "scheduled_blocks": [
            {
                "block_id": "BLK-W1-001",
                "section_id": "PUNE-LNL",
                "track_id": "TRACK_1_UP",
                "start_time": "2026-09-07T03:00:00",
                "end_time": "2026-09-07T05:00:00",
                "job_ids": ["ENG-PLN-044", "SNT-PLN-044"],
                "departments": ["Engineering", "S&T"],
                "power_block_required": False,
            }
        ],
    }


def test_build_bdms_payload_is_translated_and_idempotent():
    payload = BDMSAdapter.build_bdms_payload(approved_plan())

    assert payload["source_system"] == "MARS"
    assert payload["request_type"] == "CREATE_OR_UPDATE_BLOCK_PLAN"
    assert payload["division"] == "Pune Division (CR)"
    assert payload["blocks"][0]["block_reference"] == "BLK-W1-001"
    assert payload["blocks"][0]["job_ids"] == ["ENG-PLN-044", "SNT-PLN-044"]

    same_payload = BDMSAdapter.build_bdms_payload(approved_plan())
    assert payload["idempotency_key"] == same_payload["idempotency_key"]


def test_push_requires_human_approval(isolated_transactions):
    plan = approved_plan()
    plan["approval_status"] = "PENDING"

    with pytest.raises(ValueError, match="approval_status='APPROVED'"):
        BDMSAdapter.push_approved_schedule(plan)

    assert not isolated_transactions.exists()


def test_push_records_transaction_and_is_idempotent(isolated_transactions):
    plan = approved_plan()

    first = BDMSAdapter.push_approved_schedule(plan)
    second = BDMSAdapter.push_approved_schedule(plan)

    assert first["success"] is True
    assert first["status"] == "ACCEPTED"
    assert first["duplicate"] is False
    assert first["transaction_id"].startswith("MARS-BDMS-")
    assert first["bdms_reference"].startswith("BDMS-SANDBOX-")

    assert second["success"] is True
    assert second["status"] == "ACCEPTED"
    assert second["duplicate"] is True
    assert second["transaction_id"] == first["transaction_id"]

    transaction = BDMSAdapter.get_transaction(first["transaction_id"])
    assert transaction is not None
    assert transaction["approval_id"] == "APR-2026-001"
    assert transaction["plan_version"] == "W1-V3"
    assert transaction["status"] == "ACCEPTED"


def test_push_rejects_empty_blocks(isolated_transactions):
    plan = approved_plan()
    plan["scheduled_blocks"] = []

    with pytest.raises(ValueError, match="non-empty scheduled_blocks"):
        BDMSAdapter.push_approved_schedule(plan)


def test_push_rejects_missing_approval_metadata(isolated_transactions):
    plan = approved_plan()
    del plan["approval_id"]

    with pytest.raises(ValueError, match="approval_id"):
        BDMSAdapter.push_approved_schedule(plan)
