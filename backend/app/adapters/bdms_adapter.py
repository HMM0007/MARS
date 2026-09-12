"""Controlled outbound adapter for planner-approved MARS block plans.

The SIH prototype does not claim a live Indian Railways BDMS interface
contract.  Instead, this adapter implements the integration boundary and a
local deterministic transport journal that behaves like an external BDMS
endpoint.  Replacing the transport implementation later does not require
changing planning or solver code.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
TRANSACTIONS_PATH = RAW_DIR / "bdms_transactions.json"

APPROVED = "APPROVED"
ACCEPTED = "ACCEPTED"
REJECTED = "REJECTED"
PENDING = "PENDING"


class BDMSAdapter:
    """Translate and transmit a human-approved MARS plan to BDMS.

    Responsibilities are deliberately limited to:
    - validating the approval gate and minimum plan structure;
    - translating MARS blocks into a stable outbound contract;
    - generating an idempotency key and MARS transaction ID;
    - recording request/response state for traceability;
    - simulating the BDMS transport locally for the SIH prototype.

    The adapter does not schedule jobs, modify CP-SAT decisions, or approve
    plans. A real BDMS REST client can replace ``_transport_create`` later.
    """

    MODEL_VERSION = "bdms-outbound-adapter-v1"
    SOURCE_SYSTEM = "MARS_2.0"

    @classmethod
    def _load_transactions(cls) -> List[Dict[str, Any]]:
        if not TRANSACTIONS_PATH.exists():
            return []
        try:
            with TRANSACTIONS_PATH.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            return data if isinstance(data, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    @classmethod
    def _save_transactions(cls, transactions: List[Dict[str, Any]]) -> None:
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        temp_path = TRANSACTIONS_PATH.with_suffix(".tmp")
        with temp_path.open("w", encoding="utf-8") as handle:
            json.dump(transactions, handle, indent=2)
        temp_path.replace(TRANSACTIONS_PATH)

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @classmethod
    def _require_approved(cls, payload: Dict[str, Any]) -> None:
        approval_status = str(payload.get("approval_status", "")).upper()
        if approval_status != APPROVED:
            raise ValueError("BDMS push requires approval_status='APPROVED'")

        if not payload.get("approval_id"):
            raise ValueError("BDMS push requires approval_id")

        if not payload.get("plan_version"):
            raise ValueError("BDMS push requires plan_version")

    @staticmethod
    def _blocks(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        blocks = payload.get("scheduled_blocks")
        if not isinstance(blocks, list) or not blocks:
            raise ValueError("BDMS push requires a non-empty scheduled_blocks list")

        normalized: List[Dict[str, Any]] = []
        for index, block in enumerate(blocks, start=1):
            if not isinstance(block, dict):
                raise ValueError(f"scheduled_blocks[{index - 1}] must be an object")
            required = ("block_id", "section_id", "track_id", "start_time", "end_time", "job_ids")
            missing = [field for field in required if field not in block]
            if missing:
                raise ValueError(
                    f"Block {block.get('block_id', index)} is missing required fields: {', '.join(missing)}"
                )
            if not isinstance(block["job_ids"], list) or not block["job_ids"]:
                raise ValueError(f"Block {block.get('block_id', index)} must contain at least one job_id")
            normalized.append(dict(block))
        return normalized

    @classmethod
    def _idempotency_key(cls, payload: Dict[str, Any], blocks: List[Dict[str, Any]]) -> str:
        canonical = {
            "division": payload.get("division", "Pune Division (CR)"),
            "plan_version": str(payload["plan_version"]),
            "approval_id": str(payload["approval_id"]),
            "blocks": blocks,
        }
        encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @classmethod
    def build_bdms_payload(cls, approved_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Convert the MARS plan into the adapter's outbound BDMS contract."""
        cls._require_approved(approved_plan)
        blocks = cls._blocks(approved_plan)

        return {
            "source_system": cls.SOURCE_SYSTEM,
            "adapter_version": cls.MODEL_VERSION,
            "division": approved_plan.get("division", "Pune Division (CR)"),
            "planning_week": approved_plan.get("planning_week", 1),
            "plan_version": str(approved_plan["plan_version"]),
            "approval_id": str(approved_plan["approval_id"]),
            "idempotency_key": cls._idempotency_key(approved_plan, blocks),
            "request_type": "CREATE_OR_UPDATE_BLOCK_PLAN",
            "blocks": [
                {
                    "block_reference": str(block["block_id"]),
                    "section": str(block["section_id"]),
                    "track": str(block["track_id"]),
                    "from_time": str(block["start_time"]),
                    "to_time": str(block["end_time"]),
                    "job_ids": [str(job_id) for job_id in block["job_ids"]],
                    "departments": block.get("departments", []),
                    "machine_required": block.get("machine_required"),
                    "power_block_required": bool(block.get("power_block_required", False)),
                }
                for block in blocks
            ],
        }

    @classmethod
    def _transport_create(cls, bdms_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Local BDMS transport used by the SIH prototype.

        This is intentionally isolated so a real authenticated HTTP client can
        be substituted without changing the MARS approval or transformation
        layers.
        """
        block_count = len(bdms_payload["blocks"])
        return {
            "status": ACCEPTED,
            "message": "BDMS sandbox accepted the approved block plan.",
            "accepted_block_count": block_count,
            "transport": "LOCAL_BDMS_SANDBOX",
        }

    @classmethod
    def push_approved_schedule(cls, approved_schedule: Dict[str, Any]) -> Dict[str, Any]:
        """Transmit an approved plan exactly once per idempotency key."""
        if not isinstance(approved_schedule, dict) or not approved_schedule:
            raise ValueError("Payload cannot be empty")

        bdms_payload = cls.build_bdms_payload(approved_schedule)
        transactions = cls._load_transactions()
        key = bdms_payload["idempotency_key"]

        existing = next(
            (item for item in transactions if item.get("idempotency_key") == key),
            None,
        )
        if existing:
            return {
                "success": existing.get("status") == ACCEPTED,
                "status": existing.get("status", REJECTED),
                "message": "Duplicate submission detected; returning the original BDMS transaction.",
                "transaction_id": existing["transaction_id"],
                "bdms_reference": existing.get("bdms_reference"),
                "idempotency_key": key,
                "duplicate": True,
                "timestamp": existing.get("created_at"),
            }

        now = cls._utc_now()
        transaction_id = f"MARS-BDMS-{key[:16].upper()}"
        transport_response = cls._transport_create(bdms_payload)
        status = transport_response.get("status", REJECTED)
        bdms_reference = f"BDMS-SANDBOX-{key[:12].upper()}" if status == ACCEPTED else None

        record = {
            "transaction_id": transaction_id,
            "idempotency_key": key,
            "created_at": now,
            "source_system": cls.SOURCE_SYSTEM,
            "approval_id": bdms_payload["approval_id"],
            "plan_version": bdms_payload["plan_version"],
            "planning_week": bdms_payload["planning_week"],
            "status": status,
            "bdms_reference": bdms_reference,
            "request": bdms_payload,
            "response": transport_response,
        }
        transactions.append(record)
        cls._save_transactions(transactions)

        return {
            "success": status == ACCEPTED,
            "status": status,
            "message": transport_response.get("message", "BDMS response received."),
            "transaction_id": transaction_id,
            "bdms_reference": bdms_reference,
            "idempotency_key": key,
            "duplicate": False,
            "timestamp": now,
        }

    @classmethod
    def get_transaction(cls, transaction_id: str) -> Dict[str, Any] | None:
        """Return a recorded BDMS transaction for status tracking."""
        for item in cls._load_transactions():
            if item.get("transaction_id") == transaction_id:
                return item
        return None
