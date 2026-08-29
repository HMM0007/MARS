# CP-SAT Optimizer

MARS CP-SAT uses lexicographic optimization: priority value, criticality,
scheduled count, Emergency-block use, used-block count, then completion time.
It enumerates every contiguous train-free safe window in eligible blocks. All
intervals are normalized half-open datetime intervals and converted to integer
minutes from the planning origin. The heuristic plan is supplied as a hint,
never as a constraint. Solver configuration is deterministic: one worker and
random seed 42.

Run: `python optimizer/cp_sat/cp_sat_optimizer.py`.
