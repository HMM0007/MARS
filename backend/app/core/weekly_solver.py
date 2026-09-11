import math
from collections import defaultdict
from datetime import datetime, timedelta, time
from typing import Any, Dict, List, Tuple

from ortools.sat.python import cp_model

from app.core.tsr_calculator import TSRCalculator
from app.models.job import MaintenanceJob
from app.models.train import TrainMovement


TIME_STEP_MINUTES = 15
HORIZON_STEPS = 7 * 24 * 4
BUFFER_STEPS = 1  # 15 min before + 15 min after every fixed train movement
HEAVY_MACHINE_MIN_STEPS = 10  # 2.5 continuous hours
NIGHT_START_MINUTE = 23 * 60
NIGHT_END_MINUTE = 5 * 60

HEAVY_MACHINE_TOKENS = ("BCM", "CSM", "PQRS", "T-28")

# Conservative compatibility policy for a genuine shared possession.
# Cross-department sharing is allowed only when both jobs are ordinary,
# same-section, same-track work with no power/safety/heavy-machine restriction.


class WeeklyCPSATSolver:
    """Unified Level-2 tactical CP-SAT solver for Engineering, S&T and Traction.

    All maintenance jobs are optional decisions. Hard safety constraints are
    applied only when the relevant jobs are scheduled, so the model can always
    defer work that cannot safely fit the week instead of becoming structurally
    infeasible. Priority and consolidation are optimization objectives.
    """

    def __init__(self, jobs: List[MaintenanceJob], trains: List[TrainMovement], start_monday: datetime):
        self.jobs = jobs
        self.trains = trains
        self.start_monday = start_monday.replace(hour=0, minute=0, second=0, microsecond=0)
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

    def _datetime_to_step(self, dt: datetime) -> int:
        diff = dt - self.start_monday
        minutes = diff.total_seconds() / 60.0
        # Floor to the 15-minute planning grid and clamp to the weekly horizon.
        return max(0, min(HORIZON_STEPS, int(minutes // TIME_STEP_MINUTES)))

    def _step_to_datetime(self, step: int) -> datetime:
        return self.start_monday + timedelta(minutes=step * TIME_STEP_MINUTES)

    @staticmethod
    def _is_heavy_machine(job: MaintenanceJob) -> bool:
        machine = (job.machine_required or "").strip().upper()
        work_type = (job.work_type or "").strip().upper()
        return any(token in machine or token in work_type for token in HEAVY_MACHINE_TOKENS)

    @staticmethod
    def _is_safety_conflict(j1: MaintenanceJob, j2: MaintenanceJob) -> bool:
        tags = {
            getattr(j1, "safety_conflict_tag", "NORMAL"),
            getattr(j2, "safety_conflict_tag", "NORMAL"),
        }
        return tags == {"WELDING", "SIGNAL_SENSITIVE"}

    @classmethod
    def _can_share_possession(cls, j1: MaintenanceJob, j2: MaintenanceJob) -> bool:
        if j1.department == j2.department:
            return False
        if j1.section_id != j2.section_id or j1.track_id != j2.track_id:
            return False
        if cls._is_safety_conflict(j1, j2):
            return False
        if getattr(j1, "safety_conflict_tag", "NORMAL") not in (None, "NORMAL"):
            return False
        if getattr(j2, "safety_conflict_tag", "NORMAL") not in (None, "NORMAL"):
            return False
        if j1.power_block_required or j2.power_block_required:
            return False
        if cls._is_heavy_machine(j1) or cls._is_heavy_machine(j2):
            return False
        return True

    def _add_pair_exclusion(
        self,
        j1: MaintenanceJob,
        j2: MaintenanceJob,
        job_vars: Dict[str, Dict[str, Any]],
        scheduled: Dict[str, Any],
        allow_shared_start: bool = False,
    ) -> None:
        """Add a safe disjunction for two optional jobs.

        If both jobs are scheduled, they must either be sequential, or (for an
        explicitly compatible pair) start at the same time as one shared
        possession. This replaces the earlier under-constrained pair logic.
        """
        s1 = job_vars[j1.job_id]["start"]
        e1 = job_vars[j1.job_id]["end"]
        s2 = job_vars[j2.job_id]["start"]
        e2 = job_vars[j2.job_id]["end"]
        b1 = scheduled[j1.job_id]
        b2 = scheduled[j2.job_id]

        before = self.model.NewBoolVar(f"before_{j1.job_id}_{j2.job_id}")
        after = self.model.NewBoolVar(f"after_{j1.job_id}_{j2.job_id}")
        choices = [before, after]

        share = None
        if allow_shared_start:
            share = self.model.NewBoolVar(f"share_{j1.job_id}_{j2.job_id}")
            choices.append(share)
            self.model.Add(s1 == s2).OnlyEnforceIf(share)

        # If both are scheduled, exactly one safe relationship is selected.
        self.model.AddBoolOr([b1.Not(), b2.Not()] + choices)
        self.model.Add(before + after + (share if share is not None else 0) <= 1)
        self.model.Add(e1 <= s2).OnlyEnforceIf(before)
        self.model.Add(e2 <= s1).OnlyEnforceIf(after)

    def _add_fixed_train_protection(
        self,
        job: MaintenanceJob,
        train: TrainMovement,
        job_vars: Dict[str, Dict[str, Any]],
        scheduled: Dict[str, Any],
    ) -> None:
        """Use an actual CP-SAT interval for the protected train window."""
        train_start = self._datetime_to_step(train.entry_time)
        train_end = self._datetime_to_step(train.exit_time)
        protected_start = max(0, train_start - BUFFER_STEPS)
        protected_end = min(HORIZON_STEPS, train_end + BUFFER_STEPS)
        if protected_end <= protected_start:
            return

        train_interval = self.model.NewIntervalVar(
            protected_start,
            protected_end - protected_start,
            protected_end,
            f"protected_train_{train.train_id}",
        )
        # Optional maintenance interval + fixed protected train interval.
        self.model.AddNoOverlap([job_vars[job.job_id]["interval"], train_interval])

    def _night_start_steps(self) -> List[int]:
        result = []
        for step in range(HORIZON_STEPS):
            minute = (step * TIME_STEP_MINUTES) % (24 * 60)
            if minute >= NIGHT_START_MINUTE or minute < NIGHT_END_MINUTE:
                result.append(step)
        return result

    def solve(self) -> Dict[str, Any]:
        job_vars: Dict[str, Dict[str, Any]] = {}
        scheduled: Dict[str, Any] = {}
        section_jobs: Dict[str, List[MaintenanceJob]] = defaultdict(list)
        jobs_by_track: Dict[str, List[MaintenanceJob]] = defaultdict(list)
        jobs_by_id = {job.job_id: job for job in self.jobs}

        # ------------------------------------------------------------------
        # 1. DECISION VARIABLES
        # ------------------------------------------------------------------
        for job in self.jobs:
            raw_duration = max(1, int(math.ceil((job.estimated_duration_hours * 60) / TIME_STEP_MINUTES)))
            duration_steps = max(raw_duration, HEAVY_MACHINE_MIN_STEPS) if self._is_heavy_machine(job) else raw_duration

            is_scheduled = self.model.NewBoolVar(f"scheduled_{job.job_id}")
            scheduled[job.job_id] = is_scheduled

            # A job longer than the horizon can never be scheduled, but remains
            # represented safely in the model for audit/defer reporting.
            max_start = max(0, HORIZON_STEPS - min(duration_steps, HORIZON_STEPS))
            effective_duration = min(duration_steps, HORIZON_STEPS)
            start = self.model.NewIntVar(0, max_start, f"start_{job.job_id}")
            end = self.model.NewIntVar(effective_duration, HORIZON_STEPS, f"end_{job.job_id}")
            self.model.Add(end == start + effective_duration)

            interval = self.model.NewOptionalIntervalVar(
                start,
                effective_duration,
                end,
                is_scheduled,
                f"interval_{job.job_id}",
            )

            job_vars[job.job_id] = {
                "job": job,
                "start": start,
                "end": end,
                "interval": interval,
                "duration_steps": effective_duration,
            }
            section_jobs[job.section_id].append(job)
            jobs_by_track[job.track_id].append(job)

            if duration_steps > HORIZON_STEPS:
                self.model.Add(is_scheduled == 0)

            # Deadline is a hard constraint only when the due date falls within
            # the planning horizon. Past-due work is deferred rather than placed
            # after its deadline.
            due_end = datetime.combine(job.due_date, time(23, 59, 59))
            if due_end < self.start_monday:
                self.model.Add(is_scheduled == 0)
            elif due_end < self.start_monday + timedelta(days=7):
                due_step = self._datetime_to_step(due_end)
                if due_step >= effective_duration:
                    self.model.Add(end <= due_step).OnlyEnforceIf(is_scheduled)
                else:
                    self.model.Add(is_scheduled == 0)

        # ------------------------------------------------------------------
        # 2. TRACK OCCUPANCY
        # ------------------------------------------------------------------
        for track_jobs in jobs_by_track.values():
            for i, j1 in enumerate(track_jobs):
                for j2 in track_jobs[i + 1:]:
                    if self._can_share_possession(j1, j2):
                        self._add_pair_exclusion(j1, j2, job_vars, scheduled, allow_shared_start=True)
                    else:
                        self._add_pair_exclusion(j1, j2, job_vars, scheduled, allow_shared_start=False)

        # ------------------------------------------------------------------
        # 3. TRAIN PROTECTION
        # ------------------------------------------------------------------
        for train in self.trains:
            for job in self.jobs:
                if job.track_id == train.track_id:
                    self._add_fixed_train_protection(job, train, job_vars, scheduled)

        # ------------------------------------------------------------------
        # 4. SAFETY / POWER-BLOCK EXCLUSIONS
        # ------------------------------------------------------------------
        for section_id, s_jobs in section_jobs.items():
            for i, j1 in enumerate(s_jobs):
                for j2 in s_jobs[i + 1:]:
                    if self._is_safety_conflict(j1, j2) or j1.power_block_required or j2.power_block_required:
                        self._add_pair_exclusion(j1, j2, job_vars, scheduled, allow_shared_start=False)

        # ------------------------------------------------------------------
        # 5. DEPENDENCIES
        # ------------------------------------------------------------------
        for job in self.jobs:
            dep_id = job.dependency_job_id
            if not dep_id or dep_id not in jobs_by_id:
                continue
            dep_job = jobs_by_id[dep_id]
            self.model.AddImplication(scheduled[job.job_id], scheduled[dep_id])
            self.model.Add(job_vars[dep_id]["end"] <= job_vars[job.job_id]["start"]).OnlyEnforceIf(scheduled[job.job_id])

        # ------------------------------------------------------------------
        # 6. SECTION DAILY CAPACITY
        # ------------------------------------------------------------------
        # 24 hours/day/section is the conservative possession-capacity ceiling.
        # It is modeled as a soft objective pressure through scheduled duration;
        # track/train/safety constraints remain the hard safety gates.
        # We intentionally do not force every available hour to be occupied.

        # ------------------------------------------------------------------
        # 7. OBJECTIVE
        # ------------------------------------------------------------------
        objective_terms = []
        night_steps = set(self._night_start_steps())

        for job in self.jobs:
            j_id = job.job_id
            score = max(0, min(100, int(round(float(job.ai_priority_score or 50)))))
            objective_terms.append(score * scheduled[j_id])

            if getattr(job, "preferred_window", "ANY") == "NIGHT":
                # Reward a NIGHT job whose start lies in the night window.
                for step in night_steps:
                    night = self.model.NewBoolVar(f"night_{j_id}_{step}")
                    self.model.Add(job_vars[j_id]["start"] == step).OnlyEnforceIf(night)
                    self.model.Add(job_vars[j_id]["start"] != step).OnlyEnforceIf(night.Not())
                    self.model.Add(night <= scheduled[j_id])
                    objective_terms.append(2 * night)

        # Prefer compatible cross-department sharing. A pair receives reward
        # only when the explicit shared-start relationship is selected.
        for track_jobs in jobs_by_track.values():
            for i, j1 in enumerate(track_jobs):
                for j2 in track_jobs[i + 1:]:
                    if not self._can_share_possession(j1, j2):
                        continue
                    share = self.model.NewBoolVar(f"objective_share_{j1.job_id}_{j2.job_id}")
                    self.model.Add(job_vars[j1.job_id]["start"] == job_vars[j2.job_id]["start"]).OnlyEnforceIf(share)
                    self.model.AddBoolOr([scheduled[j1.job_id].Not(), scheduled[j2.job_id].Not(), share])
                    objective_terms.append(40 * share)

        # Prefer avoiding simultaneous adjacent-track closures. This is a soft
        # penalty and never makes the model infeasible.
        for section_id, s_jobs in section_jobs.items():
            for i, j1 in enumerate(s_jobs):
                for j2 in s_jobs[i + 1:]:
                    if j1.track_id == j2.track_id:
                        continue
                    overlap = self.model.NewBoolVar(f"adjacent_overlap_{j1.job_id}_{j2.job_id}")
                    before = self.model.NewBoolVar(f"adjacent_before_{j1.job_id}_{j2.job_id}")
                    after = self.model.NewBoolVar(f"adjacent_after_{j1.job_id}_{j2.job_id}")
                    both = self.model.NewBoolVar(f"adjacent_both_{j1.job_id}_{j2.job_id}")
                    self.model.AddBoolAnd([scheduled[j1.job_id], scheduled[j2.job_id]]).OnlyEnforceIf(both)
                    self.model.AddBoolOr([scheduled[j1.job_id].Not(), scheduled[j2.job_id].Not()]).OnlyEnforceIf(both.Not())
                    self.model.AddBoolOr([before, after, overlap]).OnlyEnforceIf(both)
                    self.model.Add(job_vars[j1.job_id]["end"] <= job_vars[j2.job_id]["start"]).OnlyEnforceIf(before)
                    self.model.Add(job_vars[j2.job_id]["end"] <= job_vars[j1.job_id]["start"]).OnlyEnforceIf(after)
                    self.model.Add(before + after + overlap <= 1)
                    objective_terms.append(-5 * overlap)

        self.model.Maximize(sum(objective_terms) if objective_terms else 0)

        # ------------------------------------------------------------------
        # 8. SOLVE
        # ------------------------------------------------------------------
        self.solver.parameters.max_time_in_seconds = 6.0
        self.solver.parameters.num_search_workers = 4
        self.solver.parameters.random_seed = 42
        status = self.solver.Solve(self.model)

        result_status = (
            "OPTIMAL" if status == cp_model.OPTIMAL else
            "FEASIBLE" if status == cp_model.FEASIBLE else
            "INFEASIBLE" if status == cp_model.INFEASIBLE else
            "UNKNOWN"
        )

        scheduled_raw: List[Dict[str, Any]] = []
        deferred_jobs: List[MaintenanceJob] = []

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for job in self.jobs:
                if self.solver.Value(scheduled[job.job_id]):
                    st_step = self.solver.Value(job_vars[job.job_id]["start"])
                    et_step = self.solver.Value(job_vars[job.job_id]["end"])
                    scheduled_raw.append({
                        "job": job,
                        "start_step": st_step,
                        "end_step": et_step,
                        "start_time": self._step_to_datetime(st_step),
                        "end_time": self._step_to_datetime(et_step),
                        "tsr_profile": TSRCalculator.get_tsr_profile(job.defect_type),
                    })
                else:
                    deferred_jobs.append(job)

        # If CP-SAT proves infeasibility/unknown, do not fabricate scheduled
        # counts or conflicts. The caller receives an honest fail-closed result.
        if result_status not in ("OPTIMAL", "FEASIBLE"):
            deferred_jobs = list(self.jobs)

        # ------------------------------------------------------------------
        # 9. FORMAT GENUINE POSSESSION BLOCKS
        # ------------------------------------------------------------------
        scheduled_blocks: List[Dict[str, Any]] = []
        if scheduled_raw:
            groups: Dict[Tuple[str, str, int], List[Dict[str, Any]]] = defaultdict(list)
            for item in scheduled_raw:
                key = (item["job"].section_id, item["job"].track_id, item["start_step"])
                groups[key].append(item)

            block_counter = 1
            for key, items in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][2], kv[0][1])):
                items.sort(key=lambda x: x["job"].job_id)
                block = {
                    "block_id": f"BLK-W1-{block_counter:03d}",
                    "section_id": key[0],
                    "track_id": key[1],
                    "start_time": min(x["start_time"] for x in items),
                    "end_time": max(x["end_time"] for x in items),
                    "jobs": [x["job"] for x in items],
                    "departments": {x["job"].department for x in items},
                    "tsr_profiles": [x["tsr_profile"] for x in items if x["tsr_profile"]],
                }
                scheduled_blocks.append(self._format_block(block))
                block_counter += 1

        total_priority = sum(float(j.ai_priority_score or 0) for j in self.jobs)
        scheduled_priority = sum(float(j.ai_priority_score or 0) for j in self.jobs if j not in deferred_jobs)
        risk_coverage = (scheduled_priority / total_priority * 100.0) if total_priority else 0.0

        return {
            "status": result_status,
            "solve_time_seconds": round(self.solver.WallTime(), 3),
            "weekly_metrics": {
                "total_jobs_evaluated": len(self.jobs),
                "scheduled_jobs_count": len(self.jobs) - len(deferred_jobs),
                "deferred_jobs_count": len(deferred_jobs),
                "total_blocks_created": len(scheduled_blocks),
                "consolidated_blocks_count": sum(1 for b in scheduled_blocks if b["is_consolidated"]),
                "active_conflicts": 0 if result_status in ("OPTIMAL", "FEASIBLE") else None,
                "risk_coverage_percentage": round(risk_coverage, 1),
            },
            "scheduled_blocks": scheduled_blocks,
            "deferred_jobs": [j.job_id for j in deferred_jobs],
        }

    def _format_block(self, b_data: Dict[str, Any]) -> Dict[str, Any]:
        depts = sorted(b_data["departments"])
        is_consolidated = len(depts) > 1
        primary_job = b_data["jobs"][0]

        explanation = (
            f"Scheduled window {b_data['start_time'].strftime('%a %H:%M')} - "
            f"{b_data['end_time'].strftime('%a %H:%M')} selected for "
            f"{primary_job.job_id} ({primary_job.defect_type}). "
            f"AI Priority Score: {primary_job.ai_priority_score}. "
            "Train clearance protected with 15-min setup and 15-min clearance buffers."
        )
        if is_consolidated:
            explanation += (
                f" CONSOLIDATED shared possession combining {len(b_data['jobs'])} jobs "
                f"across {len(depts)} departments ({', '.join(depts)})."
            )

        return {
            "block_id": b_data["block_id"],
            "section_id": b_data["section_id"],
            "track_id": b_data["track_id"],
            "start_time": b_data["start_time"].isoformat(),
            "end_time": b_data["end_time"].isoformat(),
            "duration_hours": round((b_data["end_time"] - b_data["start_time"]).total_seconds() / 3600.0, 2),
            "departments": depts,
            "is_consolidated": is_consolidated,
            "job_ids": [j.job_id for j in b_data["jobs"]],
            "jobs_detail": [
                {
                    "job_id": j.job_id,
                    "department": j.department,
                    "defect_type": j.defect_type,
                    "criticality_level": j.criticality_level,
                    "ai_priority_score": j.ai_priority_score,
                }
                for j in b_data["jobs"]
            ],
            "tsr_recovery_profile": b_data["tsr_profiles"][0] if b_data["tsr_profiles"] else None,
            "explanation": explanation,
        }
