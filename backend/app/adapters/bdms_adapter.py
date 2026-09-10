import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
SANCTIONS_PATH = RAW_DIR / "bdms_sanctions.json"


class BDMSAdapter:
    """
    Adapter simulating outbound REST API pushes to CRIS BDMS
    (Block Demand Management System).
    Pushes human-approved block disconnections to field execution units.
    """

    @staticmethod
    def push_approved_schedule(
        approved_schedule: Dict[str, Any]
    ) -> Dict[str, Any]:
        RAW_DIR.mkdir(parents=True, exist_ok=True)

        existing_sanctions = []
        if SANCTIONS_PATH.exists():
            try:
                with open(SANCTIONS_PATH, "r", encoding="utf-8") as f:
                    existing_sanctions = json.load(f)
            except Exception:
                existing_sanctions = []

        sanction_record = {
            "sanction_id": f"BDMS-SANCTION-{int(datetime.now().timestamp())}",
            "pushed_at": datetime.now().isoformat(),
            "status": "APPROVED_BY_PLANNER",
            "schedule_data": approved_schedule,
        }

        existing_sanctions.append(sanction_record)

        with open(SANCTIONS_PATH, "w", encoding="utf-8") as f:
            json.dump(existing_sanctions, f, indent=2)

        return {
            "success": True,
            "message": "Block schedule successfully pushed to CRIS BDMS workflow.",
            "sanction_id": sanction_record["sanction_id"],
            "timestamp": sanction_record["pushed_at"],
        }