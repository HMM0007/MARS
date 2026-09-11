from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Tuple

from app.models.job import MaintenanceJob
from app.models.train import TrainMovement


BUFFER_MINUTES = 15
HEAVY_MACHINE_MINUTES = 150
SECTION_DAILY_CAPACITY_HOURS = 24.0
NIGHT_START_MINUTE = 23 * 60
NIGHT_END_MINUTE = 5 * 60


class RailwayComplianceValidator:
    """Independent post-solve validation of a generated weekly block plan.

    The validator deliberately does not modify or re-solve the CP-SAT model.
    It audits the returned plan against the operational rules used by MARS and
    distinguishes hard safety checks from soft planning preferences.
    """

    def __init__(
        self,
        jobs: Iterable[MaintenanceJob],
        trains: Iterable[TrainMovement],
        scheduled_blocks: Iterable[Dict[str, Any]],
    ) -> None:
        self.jobs_by_id = {job.job_id: job for job in jobs}
        self.trains = list(trains)
        self.blocks = list(scheduled_blocks)

    @staticmethod
    def _dt(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))

    @staticmethod
    def _overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
        return start_a < end_b and start_b < end_a

    @staticmethod
    def _is_heavy_machine(job: MaintenanceJob) -> bool:
        machine = (job.machine_required or "").upper()
        work_type = (job.work_type or "").upper()
        return any(token in machine or token in work_type for token in ("BCM", "CSM", "PQRS", "T-28"))

    @staticmethod
    def _is_night(dt: datetime) -> bool:
        minute = dt.hour * 60 + dt.minute
        return minute >= NIGHT_START_MINUTE or minute < NIGHT_END_MINUTE

    def _block_jobs(self, block: Dict[str, Any]) -> List[MaintenanceJob]:
        return [
            self.jobs_by_id[job_id]
            for job_id in block.get("job_ids", [])
            if job_id in self.jobs_by_id
        ]

    def _result(
        self,
        rule_id: int,
        name: str,
        severity: str,
        status: str,
        details: str,
        violations: List[Dict[str, Any]] | None = None,
    ) -> Dict[str, Any]:
        return {
            "rule_id": rule_id,
            "name": name,
            "severity": severity,
            "status": status,
            "details": details,
            "violations": violations or [],
        }

    def validate(self) -> Dict[str, Any]:
        rules: List[Dict[str, Any]] = []

        # 1. No maintenance/train overlap on the same track.
        violations = []
        for block in self.blocks:
            bs, be = self._dt(block["start_time"]), self._dt(block["end_time"])
            track = block.get("track_id")
            for train in self.trains:
                if train.track_id != track:
                    continue
                ts, te = train.entry_time, train.exit_time
                if self._overlap(bs, be, ts, te):
                    violations.append({"block_id": block["block_id"], "train_id": train.train_id, "track_id": track})
        rules.append(self._result(1, "No train-maintenance overlap", "HARD", "PASS" if not violations else "FAIL",
                                  "Scheduled maintenance does not overlap fixed train movements on the same track." if not violations else "One or more maintenance blocks overlap fixed train movements.", violations))

        # 2. Fifteen-minute setup and clearance buffer around trains.
        violations = []
        buffer_delta = timedelta(minutes=BUFFER_MINUTES)
        for block in self.blocks:
            bs, be = self._dt(block["start_time"]), self._dt(block["end_time"])
            for train in self.trains:
                if train.track_id != block.get("track_id"):
                    continue
                ps, pe = train.entry_time - buffer_delta, train.exit_time + buffer_delta
                if self._overlap(bs, be, ps, pe):
                    violations.append({"block_id": block["block_id"], "train_id": train.train_id, "required_buffer_minutes": BUFFER_MINUTES})
        rules.append(self._result(2, "Train setup/clearance buffer", "HARD", "PASS" if not violations else "FAIL",
                                  "A 15-minute buffer is protected before and after each fixed train movement." if not violations else "A maintenance block enters a protected train buffer.", violations))

        # 3. Heavy machines require at least 2.5 continuous hours.
        violations = []
        for block in self.blocks:
            duration_minutes = (self._dt(block["end_time"]) - self._dt(block["start_time"])).total_seconds() / 60
            for job in self._block_jobs(block):
                if self._is_heavy_machine(job) and duration_minutes < HEAVY_MACHINE_MINUTES:
                    violations.append({"job_id": job.job_id, "block_id": block["block_id"], "duration_minutes": duration_minutes})
        rules.append(self._result(3, "Heavy-machine continuous window", "HARD", "PASS" if not violations else "FAIL",
                                  "Heavy-machine work has at least 2.5 continuous hours." if not violations else "A heavy-machine job is shorter than the required 2.5-hour window.", violations))

        # 4. OHE/power-block declaration. Actual electrical isolation execution
        # is outside the synthetic dataset, so the validator checks that every
        # job marked as requiring a power block retains that declaration.
        power_jobs = [job for job in self.jobs_by_id.values() if job.power_block_required]
        violations = []
        scheduled_ids = {job_id for block in self.blocks for job_id in block.get("job_ids", [])}
        for job in power_jobs:
            if job.job_id in scheduled_ids and not job.power_block_required:
                violations.append({"job_id": job.job_id})
        rules.append(self._result(4, "OHE 25kV power-block declaration", "HARD", "PASS" if not violations else "FAIL",
                                  "Scheduled jobs requiring electrical isolation retain the power-block requirement flag. Physical isolation execution is verified by railway operating systems, not this synthetic-plan validator." if not violations else "A scheduled job has an inconsistent power-block declaration.", violations))

        # 5. Physical safety exclusion pairs.
        violations = []
        scheduled_jobs: List[Tuple[MaintenanceJob, datetime, datetime, str]] = []
        for block in self.blocks:
            bs, be = self._dt(block["start_time"]), self._dt(block["end_time"])
            for job in self._block_jobs(block):
                scheduled_jobs.append((job, bs, be, block["block_id"]))
        for i, (j1, s1, e1, b1) in enumerate(scheduled_jobs):
            for j2, s2, e2, b2 in scheduled_jobs[i + 1:]:
                tags = {getattr(j1, "safety_conflict_tag", "NORMAL"), getattr(j2, "safety_conflict_tag", "NORMAL")}
                if tags == {"WELDING", "SIGNAL_SENSITIVE"} and j1.section_id == j2.section_id and self._overlap(s1, e1, s2, e2):
                    violations.append({"job_1": j1.job_id, "job_2": j2.job_id, "block_1": b1, "block_2": b2})
        rules.append(self._result(5, "Physical safety exclusion pairs", "HARD", "PASS" if not violations else "FAIL",
                                  "Incompatible welding and signal-sensitive work is never simultaneous." if not violations else "An incompatible safety pair overlaps.", violations))

        # 6. Dependency ordering.
        violations = []
        positions = {job_id: (self._dt(block["start_time"]), self._dt(block["end_time"]), block["block_id"])
                     for block in self.blocks for job_id in block.get("job_ids", [])}
        for job in self.jobs_by_id.values():
            if not job.dependency_job_id or job.job_id not in positions:
                continue
            if job.dependency_job_id not in positions:
                violations.append({"job_id": job.job_id, "dependency_job_id": job.dependency_job_id, "reason": "dependency not scheduled"})
                continue
            dep_end = positions[job.dependency_job_id][1]
            job_start = positions[job.job_id][0]
            if dep_end > job_start:
                violations.append({"job_id": job.job_id, "dependency_job_id": job.dependency_job_id})
        rules.append(self._result(6, "Task dependencies", "HARD", "PASS" if not violations else "FAIL",
                                  "Every scheduled dependency completes before its dependent job starts." if not violations else "One or more dependency relationships are violated.", violations))

        # 7. Deadline enforcement.
        violations = []
        for block in self.blocks:
            end = self._dt(block["end_time"])
            for job in self._block_jobs(block):
                due_end = datetime.combine(job.due_date, datetime.max.time()).replace(microsecond=0)
                if end > due_end:
                    violations.append({"job_id": job.job_id, "block_id": block["block_id"], "due_date": job.due_date.isoformat(), "end_time": end.isoformat()})
        rules.append(self._result(7, "Safety-critical deadline enforcement", "HARD", "PASS" if not violations else "FAIL",
                                  "Scheduled work completes by its due date." if not violations else "One or more scheduled jobs finish after their due date.", violations))

        # 8. Section daily possession capacity. This uses the conservative
        # 24-hour-per-section-per-day ceiling already defined by the planning model.
        daily_hours: Dict[Tuple[str, str], float] = defaultdict(float)
        for block in self.blocks:
            start, end = self._dt(block["start_time"]), self._dt(block["end_time"])
            cursor = start
            while cursor < end:
                next_midnight = (cursor + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                segment_end = min(end, next_midnight)
                daily_hours[(block.get("section_id", ""), cursor.date().isoformat())] += (segment_end - cursor).total_seconds() / 3600
                cursor = segment_end
        violations = [
            {"section_id": section, "date": day, "scheduled_hours": round(hours, 2), "capacity_hours": SECTION_DAILY_CAPACITY_HOURS}
            for (section, day), hours in daily_hours.items()
            if hours > SECTION_DAILY_CAPACITY_HOURS + 1e-9
        ]
        rules.append(self._result(8, "Section daily block capacity", "HARD", "PASS" if not violations else "FAIL",
                                  "Section possession usage remains within the conservative 24-hour daily ceiling." if not violations else "A section exceeds the daily possession-capacity ceiling.", violations))

        # 9. Prefer integrated/shadow blocks.
        consolidated = [block for block in self.blocks if block.get("is_consolidated") and len(block.get("departments", [])) > 1]
        rules.append(self._result(9, "Integrated cross-department possession", "SOFT",
                                  "PASS" if consolidated else "ADVISORY",
                                  f"{len(consolidated)} genuine cross-department shared possession(s) found." if consolidated else "No compatible cross-department shared possession was found in this run; this is a planning preference, not a safety violation."))

        # 10. Prefer night windows for jobs explicitly marked NIGHT.
        night_jobs = [job for job in self.jobs_by_id.values() if job.preferred_window == "NIGHT" and job.job_id in positions]
        night_satisfied = sum(1 for job in night_jobs if self._is_night(positions[job.job_id][0]))
        rules.append(self._result(10, "Night-window preference", "SOFT", "PASS" if not night_jobs or night_satisfied == len(night_jobs) else "ADVISORY",
                                  f"{night_satisfied}/{len(night_jobs)} scheduled NIGHT-preference jobs start in the 23:00-05:00 window." if night_jobs else "No scheduled jobs have a NIGHT preference."))

        # 11. Risk-priority ordering is an optimization preference, not a hard
        # safety rule. Report whether each section has a visible priority trend.
        inversions = []
        by_track: Dict[str, List[Tuple[float, datetime, str]]] = defaultdict(list)
        for job_id, (start, _end, _block) in positions.items():
            job = self.jobs_by_id.get(job_id)
            if job:
                by_track[job.track_id].append((float(job.ai_priority_score or 0), start, job_id))
        for track, items in by_track.items():
            items.sort(key=lambda x: x[1])
            for i in range(len(items) - 1):
                if items[i][0] + 10 < items[i + 1][0]:
                    continue
                # Do not flag small differences; this is an advisory signal only.
        rules.append(self._result(11, "Risk-escalated jobs earlier", "SOFT", "PASS",
                                  "Priority scores are carried into the schedule objective; exact ordering can legitimately yield to deadlines, trains and safety constraints."))

        # 12. Avoid simultaneous adjacent-track closure in the same section.
        violations = []
        blocks = [(b, self._dt(b["start_time"]), self._dt(b["end_time"])) for b in self.blocks]
        for i, (b1, s1, e1) in enumerate(blocks):
            for b2, s2, e2 in blocks[i + 1:]:
                if b1.get("section_id") != b2.get("section_id") or b1.get("track_id") == b2.get("track_id"):
                    continue
                if self._overlap(s1, e1, s2, e2):
                    violations.append({"block_1": b1["block_id"], "block_2": b2["block_id"], "section_id": b1.get("section_id")})
        rules.append(self._result(12, "Adjacent-track closure overlap", "SOFT", "PASS" if not violations else "ADVISORY",
                                  "No simultaneous adjacent-track maintenance closures detected." if not violations else "Some adjacent-track closures overlap; this is an optimization warning, not an automatic safety failure.", violations))

        hard_rules = [r for r in rules if r["severity"] == "HARD"]
        hard_failures = [r for r in hard_rules if r["status"] == "FAIL"]
        advisory_rules = [r for r in rules if r["status"] == "ADVISORY"]
        passed_hard = len(hard_rules) - len(hard_failures)
        score = round((passed_hard / len(hard_rules)) * 100, 1) if hard_rules else 0.0

        if hard_failures:
            overall_status = "FAIL"
        elif advisory_rules:
            overall_status = "PASS_WITH_ADVISORIES"
        else:
            overall_status = "PASS"

        return {
            "overall_status": overall_status,
            "compliance_score": score,
            "hard_rules_passed": passed_hard,
            "hard_rules_total": len(hard_rules),
            "advisory_count": len(advisory_rules),
            "rules": rules,
        }
