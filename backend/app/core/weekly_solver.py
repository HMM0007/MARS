import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from collections import defaultdict
from ortools.sat.python import cp_model

from app.models.job import MaintenanceJob
from app.models.train import TrainMovement
from app.core.tsr_calculator import TSRCalculator

# 15-minute time steps for 7 days (7 * 24 * 4 = 672 steps)
TIME_STEP_MINUTES = 15
HORIZON_STEPS = 7 * 24 * 4
BUFFER_STEPS = 1  # 15 min setup + 15 min clearance are represented around trains
HEAVY_MACHINE_MIN_STEPS = 10  # 2.5 continuous hours
NIGHT_START_MINUTE = 23 * 60
NIGHT_END_MINUTE = 5 * 60

# Conservative consolidation policy.  Cross-department sharing is allowed only
# for ordinary work that is explicitly free of safety conflicts and power blocks.
# Heavy-machine and power-block work never shares a possession with another job.
HEAVY_MACHINES = {
    "CSM",
    "CSM 09-32 TAMPING MACHINE",
    "BCM",
    "BCM 80 BALLAST CLEANING MACHINE",
    "PQRS",
    "PQRS/T-28",
    "T-28",
}


class WeeklyCPSATSolver:
    """
    Unified Level 2 Tactical Solver powered by Google OR-Tools CP-SAT.

    Engineering, S&T and Traction jobs are optimized in one model.  The model
    is deliberately conservative: a schedule is only emitted when the hard
    safety constraints represented by the available job/train data are met.
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
        return int(np.clip(int(minutes / TIME_STEP_MINUTES), 0, HORIZON_STEPS))

    def _step_to_datetime(self, step: int) -> datetime:
        return self.start_monday + timedelta(minutes=step * TIME_STEP_MINUTES)

    @staticmethod
    def _is_heavy_machine(job: MaintenanceJob) -> bool:
        machine = (job.machine_required or "").strip().upper()
        return machine in HEAVY_MACHINES or any(token in machine for token in ("BCM", "CSM", "PQRS", "T-28"))

    @staticmethod
    def _is_safety_conflict(j1: MaintenanceJob, j2: MaintenanceJob) -> bool:
        tags = {getattr(j1, "safety_conflict_tag", "NORMAL"), getattr(j2, "safety_conflict_tag", "NORMAL")}
        return tags == {"WELDING", "SIGNAL_SENSITIVE"}

    @classmethod
    def _can_share_possession(cls, j1: MaintenanceJob, j2: MaintenanceJob) -> bool:
        """Return True only for conservative, same-track cross-department sharing."""
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

    def _add_non_overlap_pair(self, j1: MaintenanceJob, j2: MaintenanceJob, job_vars: Dict[str, Any], scheduled_bools: Dict[str, Any]) -> None:
        """Prevent overlap, while permitting an explicit shared possession pair."""
        s1, e1 = job_vars[j1.job_id]["start"], job_vars[j1.job_id]["end"]
        s2, e2 = job_vars[j2.job_id]["start"], job_vars[j2.job_id]["end"]
        b1, b2 = scheduled_bools[j1.job_id], scheduled_bools[j2.job_id]

        if self._can_share_possession(j1, j2):
            share = self.model.NewBoolVar(f"share_{j1.job_id}_{j2.job_id}")
            before = self.model.NewBoolVar(f"before_{j1.job_id}_{j2.job_id}")
            after = self.model.NewBoolVar(f"after_{j1.job_id}_{j2.job_id}")

            # If both are scheduled, either they share one possession at the
            # same start time, or one is completely before the other.
            self.model.AddBoolOr([b1.Not(), b2.Not(), share, before, after])
            self.model.Add(s1 == s2).OnlyEnforceIf(share)
            self.model.Add(before == 0).OnlyEnforceIf(share)
            self.model.Add(after == 0).OnlyEnforceIf(share)
            self.model.Add(e1 <= s2).OnlyEnforceIf(before)
            self.model.Add(e2 <= s1).OnlyEnforceIf(after)
            self.model.Add(share + before + after <= 1)
            return

        before = self.model.NewBoolVar(f"before_{j1.job_id}_{j2.job_id}")
        after = self.model.NewBoolVar(f"after_{j1.job_id}_{j2.job_id}")
        self.model.AddBoolOr([b1.Not(), b2.Not(), before, after])
        self.model.Add(e1 <= s2).OnlyEnforceIf(before)
        self.model.Add(e2 <= s1).OnlyEnforceIf(after)
        self.model.Add(before + after <= 1)

    def solve(self) -> Dict[str, Any]:
        job_vars: Dict[str, Dict[str, Any]] = {}
        interval_vars: Dict[str, Any] = {}
        scheduled_bools: Dict[str, Any] = {}
        section_jobs: Dict[str, List[MaintenanceJob]] = defaultdict(list)

        # -------------------------------------------------------------
        # 1. DECISION VARIABLES + HARD DURATION / DEADLINE RULES
        # -------------------------------------------------------------
        for job in self.jobs:
            job_id = job.job_id
            raw_duration_steps = max(1, int(np.ceil((job.estimated_duration_hours * 60) / TIME_STEP_MINUTES)))
            duration_steps = max(raw_duration_steps, HEAVY_MACHINE_MIN_STEPS) if self._is_heavy_machine(job) else raw_duration_steps

            is_scheduled = self.model.NewBoolVar(f"scheduled_{job_id}")
            scheduled_bools[job_id] = is_scheduled

            start_var = self.model.NewIntVar(0, max(0, HORIZON_STEPS - duration_steps), f"start_{job_id}")
            end_var = self.model.NewIntVar(duration_steps, HORIZON_STEPS, f"end_{job_id}")
            self.model.Add(end_var == start_var + duration_steps)

            interval_var = self.model.NewOptionalIntervalVar(
                start_var, duration_steps, end_var, is_scheduled, f"interval_{job_id}"
            )

            job_vars[job_id] = {
                "start": start_var,
                "end": end_var,
                "duration_steps": duration_steps,
                "scheduled": is_scheduled,
                "job": job,
            }
            interval_vars[job_id] = interval_var
            section_jobs[job.section_id].append(job)

            # A job already past its due date at the start of the planning week
            # cannot be silently scheduled after the deadline.
            due_end = datetime.combine(job.due_date, datetime.max.time())
            if due_end < self.start_monday:
                self.model.Add(is_scheduled == 0)
            elif due_end < self.start_monday + timedelta(days=7):
                due_step = min(HORIZON_STEPS, max(duration_steps, self._datetime_to_step(due_end)))
                self.model.Add(end_var <= due_step).OnlyEnforceIf(is_scheduled)

        # -------------------------------------------------------------
        # 2. TRACK OCCUPANCY — WITH EXPLICIT SHARED POSSESSION PAIRS
        # -------------------------------------------------------------
        jobs_by_track: Dict[str, List[MaintenanceJob]] = defaultdict(list)
        for job in self.jobs:
            jobs_by_track[job.track_id].append(job)

        for track_jobs in jobs_by_track.values():
            for i, j1 in enumerate(track_jobs):
                for j2 in track_jobs[i + 1:]:
                    self._add_non_overlap_pair(j1, j2, job_vars, scheduled_bools)

        # -------------------------------------------------------------
        # 3. TRAIN CLEARANCE — 15 MIN BEFORE + 15 MIN AFTER
        # -------------------------------------------------------------
        for train in self.trains:
            train_start_step = self._datetime_to_step(train.entry_time)
            train_end_step = self._datetime_to_step(train.exit_time)
            prot_start = max(0, train_start_step - BUFFER_STEPS)
            prot_end = min(HORIZON_STEPS, train_end_step + BUFFER_STEPS)
            if prot_end <= prot_start:
                continue

            for job in self.jobs:
                if job.track_id != train.track_id:
                    continue
                is_sched = scheduled_bools[job.job_id]
                st_var = job_vars[job.job_id]["start"]
                et_var = job_vars[job.job_id]["end"]
                before = self.model.NewBoolVar(f"{job.job_id}_before_train_{train.train_id}")
                after = self.model.NewBoolVar(f"{job.job_id}_after_train_{train.train_id}")

                # When scheduled, the job must be wholly before or wholly after
                # the protected train window.  The previous implementation left
                # the disjunction under-constrained.
                self.model.AddBoolOr([before, after]).OnlyEnforceIf(is_sched)
                self.model.Add(et_var <= prot_start).OnlyEnforceIf([is_sched, before])
                self.model.Add(st_var >= prot_end).OnlyEnforceIf([is_sched, after])
                self.model.Add(before + after <= 1)

        # -------------------------------------------------------------
        # 4. SAFETY EXCLUSION PAIRS + POWER-BLOCK ISOLATION
        # -------------------------------------------------------------
        for section_id, s_jobs in section_jobs.items():
            for i, j1 in enumerate(s_jobs):
                for j2 in s_jobs[i + 1:]:
                    if self._is_safety_conflict(j1, j2):
                        self._add_non_overlap_pair(j1, j2, job_vars, scheduled_bools)

                    # A power-block job owns the section for its complete work
                    # window.  This conservatively prevents another maintenance
                    # job from occupying the same section simultaneously.
                    if j1.power_block_required or j2.power_block_required:
                        self._add_non_overlap_pair(j1, j2, job_vars, scheduled_bools)

        # -------------------------------------------------------------
        # 5. DEPENDENCIES — DEPENDENCY MUST FINISH FIRST
        # -------------------------------------------------------------
        jobs_by_id = {job.job_id: job for job in self.jobs}
        for job in self.jobs:
            dep_id = job.dependency_job_id
            if not dep_id or dep_id not in jobs_by_id:
                continue
            dep_scheduled = scheduled_bools[dep_id]
            self.model.AddImplication(scheduled_bools[job.job_id], dep_scheduled)
            self.model.Add(
                job_vars[dep_id]["end"] <= job_vars[job.job_id]["start"]
            ).OnlyEnforceIf(scheduled_bools[job.job_id])

        # -------------------------------------------------------------
        # 6. PREFERRED NIGHT WINDOWS + ADJACENT TRACK THROUGHPUT PENALTY
        # -------------------------------------------------------------
        objective_terms = []
        for job in self.jobs:
            j_id = job.job_id
            score_weight = int(round(float(job.ai_priority_score or 50)))
            objective_terms.append(score_weight * scheduled_bools[j_id])

            # Night preference is a soft objective, never a hard requirement.
            if getattr(job, "preferred_window", "ANY") == "NIGHT":
                start_var = job_vars[j_id]["start"]
                night_bool = self.model.NewBoolVar(f"night_{j_id}")
                allowed = []
                for step in range(0, HORIZON_STEPS):
                    minute = (step * TIME_STEP_MINUTES) % (24 * 60)
                    in_night = minute >= NIGHT_START_MINUTE or minute < NIGHT_END_MINUTE
                    allowed.append((step, 1 if in_night else 0))
                self.model.AddAllowedAssignments([start_var, night_bool], allowed)
                self.model.Add(night_bool <= scheduled_bools[j_id])
                objective_terms.append(8 * night_bool)

        # Penalize simultaneous adjacent-track possessions in the same section.
        # This is deliberately soft so safety/priority can still dominate.
        for section_id, s_jobs in section_jobs.items():
            for i, j1 in enumerate(s_jobs):
                for j2 in s_jobs[i + 1:]:
                    if j1.track_id == j2.track_id:
                        continue
                    s1, e1 = job_vars[j1.job_id]["start"], job_vars[j1.job_id]["end"]
                    s2, e2 = job_vars[j2.job_id]["start"], job_vars[j2.job_id]["end"]
                    both = self.model.NewBoolVar(f"adj_both_{j1.job_id}_{j2.job_id}")
                    self.model.AddBoolAnd([scheduled_bools[j1.job_id], scheduled_bools[j2.job_id]]).OnlyEnforceIf(both)
                    self.model.AddBoolOr([scheduled_bools[j1.job_id].Not(), scheduled_bools[j2.job_id].Not()]).OnlyEnforceIf(both.Not())
                    overlap = self.model.NewBoolVar(f"adj_overlap_{j1.job_id}_{j2.job_id}")
                    self.model.Add(s1 < e2).OnlyEnforceIf(overlap)
                    self.model.Add(e1 > s2).OnlyEnforceIf(overlap)
                    # The overlap indicator is used only as a conservative soft
                    # penalty; no hard adjacency closure is introduced here.
                    objective_terms.append(-5 * overlap)

        self.model.Maximize(sum(objective_terms))

        # -------------------------------------------------------------
        # 7. SOLVE
        # -------------------------------------------------------------
        self.solver.parameters.max_time_in_seconds = 6.0
        self.solver.parameters.num_search_workers = 4
        status = self.solver.Solve(self.model)

        scheduled_blocks: List[Dict[str, Any]] = []
        deferred_jobs: List[MaintenanceJob] = []

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            scheduled_raw = []
            for job in self.jobs:
                j_id = job.job_id
                if self.solver.Value(scheduled_bools[j_id]) == 1:
                    st_step = self.solver.Value(job_vars[j_id]["start"])
                    et_step = self.solver.Value(job_vars[j_id]["end"])
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

            # Group only jobs that genuinely share a possession: same section,
            # same track, same start, and overlapping work.  Sequential jobs are
            # kept as separate blocks; they are NOT falsely labelled consolidated.
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

        # Actual risk coverage: weighted priority of scheduled work divided by
        # total priority of the candidate pool.  This is more meaningful than
        # reporting the mean score of scheduled jobs.
        total_priority = sum(float(j.ai_priority_score or 0) for j in self.jobs)
        scheduled_priority = sum(
            float(j.ai_priority_score or 0) for j in self.jobs if j not in deferred_jobs
        )
        risk_coverage = (scheduled_priority / total_priority * 100.0) if total_priority else 0.0

        result_status = (
            "OPTIMAL" if status == cp_model.OPTIMAL else
            "FEASIBLE" if status == cp_model.FEASIBLE else
            "INFEASIBLE"
        )

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
        # Consolidated means a genuine multi-department shared possession.
        is_consolidated = len(depts) > 1
        primary_job = b_data["jobs"][0]

        explanation = (
            f"Scheduled window {b_data['start_time'].strftime('%a %H:%M')} - {b_data['end_time'].strftime('%a %H:%M')} "
            f"selected for {primary_job.job_id} ({primary_job.defect_type}). "
            f"AI Priority Score: {primary_job.ai_priority_score}. "
            f"Train clearance guaranteed with 15-min setup and 15-min clearance buffers. "
        )
        if is_consolidated:
            explanation += (
                f"CONSOLIDATED shared possession combining {len(b_data['jobs'])} jobs across "
                f"{len(depts)} departments ({', '.join(depts)})."
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
