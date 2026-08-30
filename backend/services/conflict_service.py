"""Data-driven maintenance and train conflict detection for MARS."""

from pathlib import Path
from typing import List, Dict, Any

import pandas as pd

from backend.services.job_service import job_service
from backend.config import CURRENT_PLAN_FILE, TRAIN_SCHEDULE_FILE, TRAIN_SECTIONS_FILE


class ConflictService:
    """Detect conflicts from the current active plan and train schedule.

    No sample job, block, train number or conflict is hard-coded here. The
    service uses the same operational datasets consumed by the planning APIs.
    """

    @staticmethod
    def _time_interval(date_value: object, start: object, end: object):
        s = pd.to_datetime(f"{date_value} {start}", errors="coerce")
        e = pd.to_datetime(f"{date_value} {end}", errors="coerce")
        if pd.isna(s) or pd.isna(e):
            return None
        if e <= s:
            e += pd.Timedelta(days=1)
        return s, e

    def _train_intervals(self) -> list[dict]:
        if not Path(TRAIN_SCHEDULE_FILE).exists() or not Path(TRAIN_SECTIONS_FILE).exists():
            return []
        schedules = pd.read_csv(TRAIN_SCHEDULE_FILE, keep_default_na=False)
        sections = pd.read_csv(TRAIN_SECTIONS_FILE, keep_default_na=False)
        merged = sections.merge(schedules[["train_id", "train_number", "train_type", "schedule_date", "status"]], on="train_id", how="left")
        result = []
        for train_id, group in merged.sort_values(["train_id", "sequence"]).groupby("train_id"):
            previous_end = None
            for row in group.to_dict("records"):
                interval = self._time_interval(row["schedule_date"], row["arrival_time"], row["departure_time"])
                if not interval:
                    continue
                start, end = interval
                while previous_end is not None and start < previous_end:
                    start += pd.Timedelta(days=1)
                    end += pd.Timedelta(days=1)
                result.append({**row, "start": start, "end": end})
                previous_end = end
        return result

    def _planned_jobs(self) -> list[dict]:
        if Path(CURRENT_PLAN_FILE).exists():
            plan = pd.read_csv(CURRENT_PLAN_FILE, keep_default_na=False)
            return [r for r in plan.to_dict("records") if str(r.get("plan_status", "")).upper() == "SCHEDULED"]
        return []

    def detect_conflicts(self) -> List[Dict[str, Any]]:
        conflicts: List[Dict[str, Any]] = []
        planned = self._planned_jobs()
        trains = self._train_intervals()

        # Maintenance vs maintenance: only compare actually scheduled work.
        for i, first in enumerate(planned):
            first_start = pd.to_datetime(first.get("scheduled_start"), errors="coerce")
            first_end = pd.to_datetime(first.get("scheduled_end"), errors="coerce")
            if pd.isna(first_start) or pd.isna(first_end):
                continue
            for second in planned[i + 1:]:
                if str(first.get("block_id", "")) != str(second.get("block_id", "")):
                    continue
                second_start = pd.to_datetime(second.get("scheduled_start"), errors="coerce")
                second_end = pd.to_datetime(second.get("scheduled_end"), errors="coerce")
                if pd.isna(second_start) or pd.isna(second_end) or not (first_start < second_end and second_start < first_end):
                    continue
                severity = "CRITICAL" if "CRITICAL" in {str(first.get("priority", "")).upper(), str(second.get("priority", "")).upper()} else "HIGH"
                conflicts.append({
                    "conflict_id": f"CONF-MAINT-{len(conflicts) + 1:03d}",
                    "type": "Maintenance vs Maintenance",
                    "severity": severity,
                    "section_id": first.get("section_id", ""),
                    "block_id": first.get("block_id", ""),
                    "job_ids": [first.get("job_id"), second.get("job_id")],
                    "departments": [first.get("department"), second.get("department")],
                    "description": f"{first.get('job_id')} overlaps {second.get('job_id')} on block {first.get('block_id')}.",
                    "suggested_resolution": f"Move {second.get('job_id')} to another feasible block/time window.",
                    "time_window": f"{max(first_start, second_start):%Y-%m-%d %H:%M} - {min(first_end, second_end):%H:%M}",
                })

        # Maintenance vs train: compare the actual current plan with actual train legs.
        for job in planned:
            start = pd.to_datetime(job.get("scheduled_start"), errors="coerce")
            end = pd.to_datetime(job.get("scheduled_end"), errors="coerce")
            if pd.isna(start) or pd.isna(end):
                continue
            for train in trains:
                if str(train.get("section_id")) != str(job.get("section_id")):
                    continue
                if start < train["end"] and train["start"] < end:
                    severity = "CRITICAL" if str(job.get("priority", "")).upper() == "CRITICAL" else "HIGH"
                    conflicts.append({
                        "conflict_id": f"CONF-TRAIN-{len(conflicts) + 1:03d}",
                        "type": "Maintenance vs Train Movement",
                        "severity": severity,
                        "section_id": job.get("section_id", ""),
                        "block_id": job.get("block_id", ""),
                        "job_ids": [job.get("job_id")],
                        "train_ids": [train.get("train_id")],
                        "train_numbers": [train.get("train_number")],
                        "departments": [job.get("department")],
                        "description": f"{job.get('job_id')} conflicts with train {train.get('train_number')} on section {job.get('section_id')}.",
                        "suggested_resolution": f"Re-plan {job.get('job_id')} outside the train movement window.",
                        "time_window": f"{train['start']:%Y-%m-%d %H:%M} - {train['end']:%H:%M}",
                    })

        return conflicts


conflict_service = ConflictService()
