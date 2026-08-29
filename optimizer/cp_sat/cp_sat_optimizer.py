"""Lexicographic CP-SAT optimizer for the MARS initial maintenance plan."""

import json
import sys
from pathlib import Path

import pandas as pd
from ortools.sat.python import cp_model

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from optimizer.cp_sat.candidate_generator import CandidateGenerator
from optimizer.cp_sat.plan_validator import OptimizedPlanValidator


class CPSATOptimizer:
    OUTPUT_COLUMNS = [
        "job_id", "plan_status", "priority_rank", "priority_score", "asset_id", "section_id", "department", "work_type", "duration_min", "deadline", "block_id", "block_date", "scheduled_start", "scheduled_end", "block_type", "block_restrictions", "block_isolation_required", "train_conflict_checked", "optimizer_candidate_count", "optimizer_reason_code", "optimizer_reason_detail", "heuristic_plan_status", "heuristic_block_id", "heuristic_scheduled_start", "assignment_changed",
    ]
    def __init__(self, priority_results_path, jobs_path, assets_path, blocks_path, train_schedule_path, train_sections_path, heuristic_plan_path, output_dir="data/output"):
        self.paths = (Path(priority_results_path), Path(jobs_path), Path(assets_path), Path(blocks_path), Path(train_schedule_path), Path(train_sections_path))
        self.heuristic_plan_path, self.output_dir = Path(heuristic_plan_path), Path(output_dir)

    def optimize(self):
        generator = CandidateGenerator(*self.paths)
        jobs, blocks, trains, candidates, static_reasons = generator.generate()
        heuristic = pd.read_csv(self.heuristic_plan_path, keep_default_na=False).set_index("job_id")
        origin = min([candidate.start for candidate in candidates] or [pd.Timestamp("2026-01-01")])
        model = cp_model.CpModel(); xs = {}; starts = {}; ends = {}; selected_ends = {}; intervals = {}; by_job = {}; by_section = {}; by_block = {}
        for index, candidate in enumerate(candidates):
            job = jobs.loc[jobs.job_id == candidate.job_id].iloc[0]; duration = int(job.duration_min)
            low, high = int((candidate.start-origin).total_seconds()//60), int((candidate.end-origin).total_seconds()//60)-duration
            x = model.NewBoolVar(f"x_{index}"); start = model.NewIntVar(low, high, f"s_{index}"); end = model.NewIntVar(low+duration, high+duration, f"e_{index}")
            model.Add(end == start + duration); interval = model.NewOptionalIntervalVar(start, duration, end, x, f"i_{index}")
            # Unselected candidates contribute exactly zero to Stage 6.
            selected_end = model.NewIntVar(0, high + duration, f"selected_end_{index}")
            model.Add(selected_end == end).OnlyEnforceIf(x)
            model.Add(selected_end == 0).OnlyEnforceIf(x.Not())
            xs[index], starts[index], ends[index], selected_ends[index], intervals[index] = x, start, end, selected_end, interval
            by_job.setdefault(candidate.job_id, []).append(index); by_section.setdefault(candidate.section_id, []).append(interval); by_block.setdefault(candidate.block_id, []).append(interval)
        for job_id, indexes in by_job.items(): model.Add(sum(xs[i] for i in indexes) <= 1)
        for values in by_section.values(): model.AddNoOverlap(values)
        for values in by_block.values(): model.AddNoOverlap(values)
        # The heuristic assignment is a non-binding CP-SAT hint when it maps
        # into one of the complete train-free candidate windows.
        for index, candidate in enumerate(candidates):
            hint = heuristic.loc[candidate.job_id]
            if hint.plan_status != "SCHEDULED" or hint.block_id != candidate.block_id:
                continue
            hint_start = pd.to_datetime(hint.scheduled_start, errors="coerce")
            duration = int(jobs.loc[jobs.job_id == candidate.job_id, "duration_min"].iloc[0])
            if pd.notna(hint_start) and candidate.start <= hint_start <= candidate.end - pd.Timedelta(minutes=duration):
                model.AddHint(xs[index], 1)
                model.AddHint(starts[index], int((hint_start - origin).total_seconds() // 60))
        used = {block_id: model.NewBoolVar(f"used_{block_id}") for block_id in by_block}
        for block_id, values in by_block.items():
            for index, candidate in enumerate(candidates):
                if candidate.block_id == block_id: model.AddImplication(xs[index], used[block_id])
        priority = {row.job_id: int(round(float(row.priority_score)*100)) for row in jobs.itertuples()}
        criticality = {row.job_id: int(round(float(getattr(row, "asset_criticality_score", 0))*100)) for row in jobs.itertuples()}
        score_expr = sum(priority[c.job_id]*xs[i] for i,c in enumerate(candidates)); critical_expr = sum(criticality[c.job_id]*xs[i] for i,c in enumerate(candidates)); count_expr = sum(xs.values())
        emergency_expr = sum(xs[i] for i,c in enumerate(candidates) if blocks.loc[blocks.block_id == c.block_id, "block_type"].iloc[0].upper() == "EMERGENCY")
        completion_expr = sum(selected_ends.values()); objective_values = {}
        solver = cp_model.CpSolver(); solver.parameters.num_search_workers = 1; solver.parameters.random_seed = 42; solver.parameters.max_time_in_seconds = 20
        last_status = [None]
        def solve_stage(name, expr, maximize):
            model.Maximize(expr) if maximize else model.Minimize(expr)
            status = solver.Solve(model)
            last_status[0] = status
            if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE): raise RuntimeError(f"CP-SAT failed at {name}: {solver.StatusName(status)}")
            value = int(round(solver.ObjectiveValue())); objective_values[name] = value; model.Add(expr == value)
        solve_stage("priority", score_expr, True); solve_stage("criticality", critical_expr, True); solve_stage("scheduled_jobs", count_expr, True); solve_stage("emergency_blocks", emergency_expr, False); solve_stage("used_blocks", sum(used.values()), False); solve_stage("completion_minutes", completion_expr, False)
        selected = {}
        for i,candidate in enumerate(candidates):
            if solver.Value(xs[i]): selected[candidate.job_id] = (candidate, pd.Timestamp(origin) + pd.Timedelta(minutes=solver.Value(starts[i])))
        block_index = blocks.set_index("block_id"); rows=[]
        for job in jobs.sort_values(["priority_rank","job_id"]).itertuples():
            hint = heuristic.loc[job.job_id]; candidate_count=len(by_job.get(job.job_id, [])); selected_value=selected.get(job.job_id)
            base = {"job_id":job.job_id,"priority_rank":job.priority_rank,"priority_score":job.priority_score,"asset_id":job.asset_id,"section_id":job.section_id,"department":job.department,"work_type":job.work_type,"duration_min":int(job.duration_min),"deadline":pd.Timestamp(job.deadline).strftime("%Y-%m-%d"),"train_conflict_checked":True,"optimizer_candidate_count":candidate_count,"heuristic_plan_status":hint.plan_status,"heuristic_block_id":hint.block_id,"heuristic_scheduled_start":hint.scheduled_start}
            if selected_value:
                candidate,start=selected_value; block=block_index.loc[candidate.block_id]; end=start+pd.Timedelta(minutes=int(job.duration_min)); same=hint.plan_status=="SCHEDULED" and hint.block_id==candidate.block_id and hint.scheduled_start==start.strftime("%Y-%m-%d %H:%M")
                rows.append(base|{"plan_status":"SCHEDULED","block_id":candidate.block_id,"block_date":block.block_date,"scheduled_start":start.strftime("%Y-%m-%d %H:%M"),"scheduled_end":end.strftime("%Y-%m-%d %H:%M"),"block_type":block.block_type,"block_restrictions":block.restrictions,"block_isolation_required":block.isolation_required,"optimizer_reason_code":"SCHEDULED","optimizer_reason_detail":"Selected by lexicographic CP-SAT optimization.","assignment_changed":not same})
            else:
                code,detail=static_reasons.get(job.job_id,("NOT_SELECTED_BY_OPTIMIZER","Feasible candidates were not selected by the global objective.")); rows.append(base|{"plan_status":"UNSCHEDULED","block_id":"","block_date":"","scheduled_start":"","scheduled_end":"","block_type":"","block_restrictions":"","block_isolation_required":"","optimizer_reason_code":code,"optimizer_reason_detail":detail,"assignment_changed":hint.plan_status=="SCHEDULED"})
        plan=pd.DataFrame(rows,columns=self.OUTPUT_COLUMNS); self.output_dir.mkdir(parents=True,exist_ok=True); plan_path=self.output_dir/"optimized_maintenance_plan.csv"; plan.to_csv(plan_path,index=False)
        OptimizedPlanValidator(*self.paths[1:]).validate(plan)
        comparison=plan[["job_id","plan_status","block_id","scheduled_start","heuristic_plan_status","heuristic_block_id","heuristic_scheduled_start","assignment_changed"]]; comparison.to_csv(self.output_dir/"plan_comparison.csv",index=False)
        metric=lambda frame,col: int(pd.to_numeric(frame.loc[frame.plan_status=="SCHEDULED",col]).sum())
        h=heuristic.reset_index(); hs=h[h.plan_status=="SCHEDULED"]; os=plan[plan.plan_status=="SCHEDULED"]; raw=int(pd.to_numeric(blocks.loc[blocks.status=="Available","duration_min"]).sum())
        completion_minutes = lambda frame: int(sum((pd.to_datetime(row.scheduled_end) - origin).total_seconds() // 60 for row in frame[frame.plan_status=="SCHEDULED"].itertuples()))
        heuristic_completion = completion_minutes(h)
        optimized_completion = completion_minutes(plan)
        summary={"heuristic_scheduled_jobs":len(hs),"optimized_scheduled_jobs":len(os),"heuristic_scheduled_minutes":metric(h,"duration_min"),"optimized_scheduled_minutes":metric(plan,"duration_min"),"heuristic_priority_value":int(sum(priority[row.job_id] for row in hs.itertuples())),"optimized_priority_value":int(sum(priority[row.job_id] for row in os.itertuples())),"heuristic_criticality_value":int(sum(criticality[row.job_id] for row in hs.itertuples())),"optimized_criticality_value":int(sum(criticality[row.job_id] for row in os.itertuples())),"heuristic_block_utilization":metric(h,"duration_min")/raw,"optimized_block_utilization":metric(plan,"duration_min")/raw,"heuristic_blocks_used":int(hs.block_id.nunique()),"optimized_blocks_used":int(os.block_id.nunique()),"heuristic_emergency_blocks":int((hs.block_type=="Emergency").sum()),"optimized_emergency_blocks":int((os.block_type=="Emergency").sum()),"heuristic_selected_completion_minutes":heuristic_completion,"optimized_selected_completion_minutes":optimized_completion,"completion_improvement_minutes":heuristic_completion-optimized_completion,"jobs_newly_scheduled":int(((plan.plan_status=="SCHEDULED")&(plan.heuristic_plan_status!="SCHEDULED")).sum()),"jobs_unscheduled":int((plan.plan_status=="UNSCHEDULED").sum()),"jobs_moved":int(((plan.plan_status=="SCHEDULED")&(plan.heuristic_plan_status=="SCHEDULED")&plan.assignment_changed).sum()),"jobs_unchanged":int((~plan.assignment_changed).sum()),"solver_status":solver.StatusName(last_status[0]),"solver_wall_time_seconds":solver.WallTime(),"objective_values":objective_values}
        (self.output_dir/"optimization_summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
        return plan,summary

if __name__ == "__main__":
    base=Path(__file__).resolve().parents[2]; sample=base/"data"/"sample"
    optimizer=CPSATOptimizer(sample/"priority_results.csv",sample/"maintenance_jobs.csv",sample/"assets.csv",sample/"block_availability.csv",sample/"train_schedule.csv",sample/"train_sections.csv",base/"data"/"output"/"initial_maintenance_plan.csv",base/"data"/"output")
    plan,summary=optimizer.optimize(); print(f"Optimized plan: {len(plan)} jobs, {summary['optimized_scheduled_jobs']} scheduled")
