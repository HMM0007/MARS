# Railway-Aware Heuristic

The Railway-Aware Heuristic constructs a deterministic, feasible starting plan
for the later CP-SAT optimizer. It does not optimize the final schedule.

## Inputs

- `data/sample/priority_results.csv`
- `data/sample/maintenance_jobs.csv`
- `data/sample/assets.csv`
- `data/sample/block_availability.csv`
- `data/sample/train_schedule.csv`
- `data/sample/train_sections.csv`

`goods_train_forecast.csv` is intentionally not used in this first version.

## Scheduling policy

Active jobs are ordered by `priority_rank`, descending `priority_score`,
ascending deadline, descending duration, and `job_id`. Each job is assigned
the first feasible interval in that order. A feasible assignment requires an
available block on the asset section, completion by the deadline, compatible
restriction and isolation values, no train overlap, and unused maintenance
capacity.

Intervals are half-open: `[start, end)`. An end time that is at or before the
start time is normalized into the next day, so `22:00-00:00` becomes a
two-hour overnight interval. Train section dates are reconstructed from each
train's schedule date and sequence order.

Restrictions are interpreted as follows: `Engineering work only` permits the
Engineering department, `OHE work only` permits Traction, and `None` or
`Limited speed` permit all departments. A job requiring isolation can only use
a block where isolation is available.

## Output

The generated file is `data/output/initial_maintenance_plan.csv`. It contains
one row for every active job. Rows are marked `SCHEDULED` or `UNSCHEDULED` and
include a machine-readable reason code plus an explanatory detail. Dataset V1
under `data/sample` is never modified.

Run from the repository root:

```powershell
python optimizer/heuristic/railway_heuristic.py
```
