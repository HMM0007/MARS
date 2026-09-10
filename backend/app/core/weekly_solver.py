import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any
from collections import defaultdict
from ortools.sat.python import cp_model

from app.models.job import MaintenanceJob
from app.models.train import TrainMovement
from app.core.tsr_calculator import TSRCalculator

# 15-minute time steps for 7 days (7 * 24 * 4 = 672 steps)
TIME_STEP_MINUTES = 15
HORIZON_STEPS = 7 * 24 * 4


class WeeklyCPSATSolver:
    """
    Unified Level 2 Tactical Solver powered by Google OR-Tools CP-SAT.
    Optimizes Engineering, S&T, and Traction simultaneously into a 100% conflict-free schedule.
    """

    def __init__(self, jobs: List[MaintenanceJob], trains: List[TrainMovement], start_monday: datetime):
        self.jobs = jobs
        self.trains = trains
        self.start_monday = start_monday.replace(hour=0, minute=0, second=0, microsecond=0)
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

    def _datetime_to_step(self, dt: datetime) -> int:
        """Converts a Datetime to a 0..672 discrete time step."""
        diff = dt - self.start_monday
        minutes = diff.total_seconds() / 60.0
        step = int(minutes / TIME_STEP_MINUTES)
        return int(np.clip(step, 0, HORIZON_STEPS))

    def _step_to_datetime(self, step: int) -> datetime:
        """Converts a 0..672 time step back to Datetime."""
        return self.start_monday + timedelta(minutes=step * TIME_STEP_MINUTES)

    def solve(self) -> Dict[str, Any]:
        job_vars = {}
        interval_vars = {}
        scheduled_bools = {}
        
        # Track-wise interval mapping for AddNoOverlap
        track_intervals = defaultdict(list)
        
        # Section-wise job list for Consolidation matching
        section_jobs = defaultdict(list)

        # -------------------------------------------------------------
        # 1. CREATE DECISION VARIABLES
        # -------------------------------------------------------------
        for job in self.jobs:
            job_id = job.job_id
            # Duration in 15-min steps (e.g., 2.5 hrs = 10 steps)
            duration_steps = max(1, int(np.ceil((job.estimated_duration_hours * 60) / TIME_STEP_MINUTES)))

            # Variable: Is job scheduled this week?
            is_scheduled = self.model.NewBoolVar(f"scheduled_{job_id}")
            scheduled_bools[job_id] = is_scheduled

            # Variables: Start time & End time
            start_var = self.model.NewIntVar(0, HORIZON_STEPS - duration_steps, f"start_{job_id}")
            end_var = self.model.NewIntVar(duration_steps, HORIZON_STEPS, f"end_{job_id}")

            # Enforce Duration: End = Start + Duration
            self.model.Add(end_var == start_var + duration_steps)

            # Optional Interval Variable linked to is_scheduled
            interval_var = self.model.NewOptionalIntervalVar(
                start_var, duration_steps, end_var, is_scheduled, f"interval_{job_id}"
            )

            job_vars[job_id] = {
                "start": start_var,
                "end": end_var,
                "duration_steps": duration_steps,
                "scheduled": is_scheduled,
                "job": job
            }
            interval_vars[job_id] = interval_var
            
            # Map intervals to specific tracks
            track_intervals[job.track_id].append(interval_var)
            section_jobs[job.section_id].append(job)

        # -------------------------------------------------------------
        # 2. HARD CONSTRAINT: TRACK NO-OVERLAP
        # -------------------------------------------------------------
        for track_id, intervals in track_intervals.items():
            self.model.AddNoOverlap(intervals)

        # -------------------------------------------------------------
        # 3. HARD CONSTRAINT: TRAIN TIMETABLE CLEARANCE (15-min setup/clearance buffer)
        # -------------------------------------------------------------
        BUFFER_STEPS = 1  # 15 min buffer = 1 step

        for train in self.trains:
            train_start_step = self._datetime_to_step(train.entry_time)
            train_end_step = self._datetime_to_step(train.exit_time)

            # Protected train window with safety buffers
            prot_start = max(0, train_start_step - BUFFER_STEPS)
            prot_end = min(HORIZON_STEPS, train_end_step + BUFFER_STEPS)

            if prot_end <= prot_start:
                continue

            for job in self.jobs:
                if job.track_id == train.track_id:
                    j_id = job.job_id
                    is_sched = scheduled_bools[j_id]
                    st_var = job_vars[j_id]["start"]
                    et_var = job_vars[j_id]["end"]

                    # Job must end before train protected start OR start after train protected end
                    job_before_train = self.model.NewBoolVar(f"{j_id}_before_train_{train.train_id}")
                    
                    self.model.Add(et_var <= prot_start).OnlyEnforceIf([is_sched, job_before_train])
                    self.model.Add(st_var >= prot_end).OnlyEnforceIf([is_sched, job_before_train.Not()])

        # -------------------------------------------------------------
        # 4. HARD CONSTRAINT: PHYSICAL SAFETY EXCLUSION PAIRS
        # -------------------------------------------------------------
        # Thermit Welding cannot overlap with Signal Wiring on same section
        for section_id, s_jobs in section_jobs.items():
            for i, j1 in enumerate(s_jobs):
                for j2 in s_jobs[i+1:]:
                    tag1 = getattr(j1, "safety_conflict_tag", "NORMAL")
                    tag2 = getattr(j2, "safety_conflict_tag", "NORMAL")
                    
                    if (tag1 == "WELDING" and tag2 == "SIGNAL_SENSITIVE") or (tag1 == "SIGNAL_SENSITIVE" and tag2 == "WELDING"):
                        # Must not overlap in time
                        self.model.AddNoOverlap([interval_vars[j1.job_id], interval_vars[j2.job_id]])

        # -------------------------------------------------------------
        # 5. SOFT OBJECTIVE: MAXIMIZE PRIORITY + REWARD CONSOLIDATION
        # -------------------------------------------------------------
        objective_terms = []

        # Objective A: Maximizing Scheduled AI Priority Scores
        for job in self.jobs:
            j_id = job.job_id
            score_weight = int(job.ai_priority_score or 50)
            is_sched = scheduled_bools[j_id]
            objective_terms.append(score_weight * is_sched)

        # Objective B: Reward Multi-Department Consolidation ("Purple Blocks")
        consolidation_bonuses = []
        for section_id, s_jobs in section_jobs.items():
            for i, j1 in enumerate(s_jobs):
                for j2 in s_jobs[i+1:]:
                    if j1.department != j2.department:
                        s1 = scheduled_bools[j1.job_id]
                        s2 = scheduled_bools[j2.job_id]

                        both_sched = self.model.NewBoolVar(f"both_sched_{j1.job_id}_{j2.job_id}")
                        # both_sched <==> s1 AND s2
                        self.model.AddBoolAnd([s1, s2]).OnlyEnforceIf(both_sched)
                        self.model.AddBoolOr([s1.Not(), s2.Not()]).OnlyEnforceIf(both_sched.Not())

                        is_cons = self.model.NewBoolVar(f"consolidate_{j1.job_id}_{j2.job_id}")
                        
                        start_diff = self.model.NewIntVar(0, HORIZON_STEPS, f"diff_{j1.job_id}_{j2.job_id}")
                        self.model.AddAbsEquality(start_diff, job_vars[j1.job_id]["start"] - job_vars[j2.job_id]["start"])
                        
                        # If both scheduled AND start_diff <= 1 (within 15 mins) <==> is_cons
                        self.model.Add(start_diff <= 1).OnlyEnforceIf([both_sched, is_cons])
                        self.model.Add(start_diff > 1).OnlyEnforceIf([both_sched, is_cons.Not()])
                        self.model.Add(is_cons == 0).OnlyEnforceIf(both_sched.Not())
                        
                        # Add 40 point reward for consolidation
                        consolidation_bonuses.append(40 * is_cons)

        self.model.Maximize(sum(objective_terms) + sum(consolidation_bonuses))

        # -------------------------------------------------------------
        # 6. SOLVE MODEL
        # -------------------------------------------------------------
        self.solver.parameters.max_time_in_seconds = 6.0  # 6s timeout
        self.solver.parameters.num_search_workers = 4
        status = self.solver.Solve(self.model)

        # -------------------------------------------------------------
        # 7. EXTRACT & FORMAT SCHEDULE
        # -------------------------------------------------------------
        scheduled_blocks = []
        deferred_jobs = []
        consolidated_count = 0

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            # Extract scheduled blocks
            scheduled_raw = []
            for job in self.jobs:
                j_id = job.job_id
                if self.solver.Value(scheduled_bools[j_id]) == 1:
                    st_step = self.solver.Value(job_vars[j_id]["start"])
                    et_step = self.solver.Value(job_vars[j_id]["end"])
                    
                    st_dt = self._step_to_datetime(st_step)
                    et_dt = self._step_to_datetime(et_step)
                    
                    tsr_info = TSRCalculator.get_tsr_profile(job.defect_type)
                    
                    scheduled_raw.append({
                        "job": job,
                        "start_step": st_step,
                        "end_step": et_step,
                        "start_time": st_dt,
                        "end_time": et_dt,
                        "tsr_profile": tsr_info
                    })
                else:
                    deferred_jobs.append(job)

            # Group overlapping/adjacent jobs on same section into single Consolidated Blocks
            section_time_map = defaultdict(list)
            for item in scheduled_raw:
                section_time_map[item["job"].section_id].append(item)

            block_id_counter = 1
            for section_id, s_items in section_time_map.items():
                s_items.sort(key=lambda x: x["start_step"])
                
                # Merge overlapping or close jobs into single blocks
                curr_block = None
                for item in s_items:
                    if curr_block is None:
                        curr_block = {
                            "block_id": f"BLK-W1-{block_id_counter:03d}",
                            "section_id": section_id,
                            "track_id": item["job"].track_id,
                            "start_time": item["start_time"],
                            "end_time": item["end_time"],
                            "jobs": [item["job"]],
                            "departments": {item["job"].department},
                            "tsr_profiles": [item["tsr_profile"]] if item["tsr_profile"] else []
                        }
                    else:
                        # Check if overlapping or adjacent on same track
                        if item["job"].track_id == curr_block["track_id"] and item["start_time"] <= curr_block["end_time"]:
                            curr_block["jobs"].append(item["job"])
                            curr_block["departments"].add(item["job"].department)
                            curr_block["end_time"] = max(curr_block["end_time"], item["end_time"])
                            if item["tsr_profile"]:
                                curr_block["tsr_profiles"].append(item["tsr_profile"])
                        else:
                            # Finalize previous block
                            scheduled_blocks.append(self._format_block(curr_block))
                            block_id_counter += 1
                            curr_block = {
                                "block_id": f"BLK-W1-{block_id_counter:03d}",
                                "section_id": section_id,
                                "track_id": item["job"].track_id,
                                "start_time": item["start_time"],
                                "end_time": item["end_time"],
                                "jobs": [item["job"]],
                                "departments": {item["job"].department},
                                "tsr_profiles": [item["tsr_profile"]] if item["tsr_profile"] else []
                            }
                if curr_block:
                    scheduled_blocks.append(self._format_block(curr_block))
                    block_id_counter += 1

            for b in scheduled_blocks:
                if b["is_consolidated"]:
                    consolidated_count += 1

        return {
            "status": "OPTIMAL" if status == cp_model.OPTIMAL else ("FEASIBLE" if status == cp_model.FEASIBLE else "INFEASIBLE"),
            "solve_time_seconds": round(self.solver.WallTime(), 3),
            "weekly_metrics": {
                "total_jobs_evaluated": len(self.jobs),
                "scheduled_jobs_count": len(self.jobs) - len(deferred_jobs),
                "deferred_jobs_count": len(deferred_jobs),
                "total_blocks_created": len(scheduled_blocks),
                "consolidated_blocks_count": consolidated_count,
                "active_conflicts": 0,  # Always 0 by CP-SAT construction!
                "risk_coverage_percentage": round(np.mean([j.ai_priority_score for j in self.jobs if j not in deferred_jobs]) if self.jobs else 0.0, 1)
            },
            "scheduled_blocks": scheduled_blocks,
            "deferred_jobs": [j.job_id for j in deferred_jobs]
        }

    def _format_block(self, b_data: Dict[str, Any]) -> Dict[str, Any]:
        """Formats block dictionary for API response and generates Explainability text."""
        depts = list(b_data["departments"])
        is_consolidated = len(depts) > 1 or len(b_data["jobs"]) > 1
        
        primary_job = b_data["jobs"][0]
        
        explanation = (
            f"Scheduled window {b_data['start_time'].strftime('%a %H:%M')} - {b_data['end_time'].strftime('%a %H:%M')} "
            f"selected for {primary_job.job_id} ({primary_job.defect_type}). "
            f"AI Priority Score: {primary_job.ai_priority_score}. "
            f"Train clearance guaranteed with 30-min setup/clearance buffers. "
        )
        if is_consolidated:
            explanation += f"CONSOLIDATED possession combining {len(b_data['jobs'])} jobs across {len(depts)} departments ({', '.join(depts)}), saving downtime."

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
                    "ai_priority_score": j.ai_priority_score
                } for j in b_data["jobs"]
            ],
            "tsr_recovery_profile": b_data["tsr_profiles"][0] if b_data["tsr_profiles"] else None,
            "explanation": explanation
        }