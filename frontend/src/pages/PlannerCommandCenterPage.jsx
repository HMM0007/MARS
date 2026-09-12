import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Filter, GitBranch, RefreshCw, ShieldCheck, TrainFront, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchAllScoredJobs, fetchCOATimetable, fetchHealth, fetchPendingWeeklyRevision, fetchWeeklyPlan } from '../services/api';

const deptMeta = {
  Engineering: 'border-[#3B6EA5]/25 bg-[#3B6EA5]/10 text-[#3B6EA5]',
  'S&T': 'border-[#2F8F6B]/25 bg-[#2F8F6B]/10 text-[#2F8F6B]',
  Traction: 'border-[#C9842A]/25 bg-[#C9842A]/10 text-[#A76614]',
};
const jobsArray = (data) => Array.isArray(data) ? data : (data?.jobs || data?.items || []);
const score = (j) => Number(j?.ai_priority_score ?? j?.priority_score ?? j?.priority ?? 0);
const dept = (j) => j?.department || j?.dept || 'Unknown';
const criticality = (j) => String(j?.criticality_level || j?.criticality || '').toUpperCase();
const status = (j) => String(j?.status || '').toUpperCase();
const isClosed = (j) => ['SCHEDULED', 'COMPLETED', 'APPROVED'].includes(status(j));

export default function PlannerCommandCenterPage() {
  const [weekly, setWeekly] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [trains, setTrains] = useState([]);
  const [pendingRevision, setPendingRevision] = useState(null);
  const [health, setHealth] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      fetchWeeklyPlan(),
      fetchAllScoredJobs(),
      fetchCOATimetable(),
      fetchPendingWeeklyRevision(),
      fetchHealth(),
    ]);
    const [w, j, t, r, h] = results;
    if (w.status === 'fulfilled') setWeekly(w.value);
    if (j.status === 'fulfilled') setJobs(jobsArray(j.value));
    if (t.status === 'fulfilled') setTrains(Array.isArray(t.value) ? t.value : (t.value?.timetable || []));
    if (r.status === 'fulfilled') setPendingRevision(r.value);
    if (h.status === 'fulfilled') setHealth(h.value);
    if (w.status === 'rejected' && j.status === 'rejected') setError('Unable to load current planning data from MARS 2.0.');
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const blocks = weekly?.blocks || weekly?.scheduled_blocks || [];
  const metrics = weekly?.metrics || weekly?.weekly_metrics || {};
  const deferred = weekly?.deferred_jobs || [];
  const critical = useMemo(() => jobs.filter((j) => criticality(j) === 'CRITICAL' && !isClosed(j)), [jobs]);
  const emergency = useMemo(() => jobs.filter((j) => String(j?.work_type || '').toUpperCase() === 'EMERGENCY_MAINTENANCE'), [jobs]);
  const consolidated = blocks.filter((b) => b?.is_consolidated || (b?.departments || []).length > 1);
  const conflicts = Number(metrics.active_conflicts ?? weekly?.compliance?.conflicts ?? 0);
  const filteredJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => score(b) - score(a));
    if (filter === 'CRITICAL') return sorted.filter((j) => criticality(j) === 'CRITICAL');
    if (filter === 'HIGH') return sorted.filter((j) => score(j) >= 70 && criticality(j) !== 'CRITICAL');
    if (filter === 'PENDING') return sorted.filter((j) => !isClosed(j));
    return sorted;
  }, [jobs, filter]);

  const baseline = weekly?.baseline_governance?.mode === 'APPROVED_BASELINE'
    ? `Approved baseline R${weekly?.baseline_governance?.revision ?? weekly?.baseline_revision ?? '—'}`
    : (weekly?.baseline_approved ? `Approved baseline R${weekly?.baseline_revision ?? '—'}` : 'Candidate plan');

  return (
    <main className="min-h-full bg-[#F4F6F8] p-4 font-sans text-[#1F2933]">
      <div className="mx-auto max-w-[1600px] space-y-3.5">
        <header className="flex flex-col gap-3 rounded-md border border-[#D6DEE6] bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-black uppercase tracking-wide text-[#1E3A5F]">Planner Command Centre</h1><span className="rounded border border-[#1E3A5F]/20 bg-[#1E3A5F]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1E3A5F]">Decision Workspace</span></div>
            <p className="mt-1 text-[11px] text-[#52606D]">Pune Division (CR) • {baseline} • Planner attention, decisions and coordination</p>
          </div>
          <div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-1.5"><span className={`h-2 w-2 rounded-full ${health ? 'bg-[#2F9E44]' : 'bg-[#F08C00]'}`} /><span className="text-[10px] font-bold uppercase text-[#52606D]">{health ? 'System Online' : 'Checking'}</span></div><button onClick={loadData} disabled={loading} className="flex items-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#2F6F7E] disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
        </header>

        {error && <div className="rounded border border-[#C92A2A]/25 bg-[#C92A2A]/5 px-3 py-2 text-[11px] font-semibold text-[#C92A2A]"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}

        <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Jobs in Pool', jobs.length, 'text-[#1E3A5F]'],
            ['Critical Attention', critical.length, 'text-[#C92A2A]'],
            ['Weekly Blocks', blocks.length, 'text-[#1E3A5F]'],
            ['Deferred', deferred.length || Number(metrics.total_jobs_deferred ?? 0), 'text-[#A76614]'],
            ['Conflicts', conflicts, conflicts ? 'text-[#C92A2A]' : 'text-[#2F9E44]'],
            ['Shared Blocks', consolidated.length, 'text-[#6B5B95]'],
          ].map(([label, value, cls]) => <div key={label} className="rounded border border-[#D6DEE6] bg-white px-3 py-2.5"><div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{label}</div><div className={`mt-0.5 font-mono text-xl font-black ${cls}`}>{loading ? '—' : value}</div></div>)}
        </section>

        <section className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#D6DEE6] px-3.5 py-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Planner Attention</h2><p className="text-[10px] text-[#718294]">Exceptions and decisions that require action</p></div>{pendingRevision && <Link to="/weekly" className="inline-flex items-center gap-1.5 rounded bg-[#C9842A] px-3 py-1.5 text-[10px] font-bold text-white">Review Revision <ArrowRight className="h-3 w-3" /></Link>}</div>
          <div className="grid grid-cols-1 divide-y divide-[#E5EAF0] md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="space-y-2 p-3.5"><Link to="/jobs/priority-risk" className="flex items-center justify-between rounded border border-[#D6DEE6] px-3 py-2.5 hover:bg-[#F8FAFC]"><span className="flex items-center gap-2 text-[10px] font-bold"><AlertCircle className="h-4 w-4 text-[#C92A2A]" /> Critical jobs needing attention</span><span className="font-mono text-sm font-black text-[#C92A2A]">{critical.length}</span></Link><Link to="/weekly" className="flex items-center justify-between rounded border border-[#D6DEE6] px-3 py-2.5 hover:bg-[#F8FAFC]"><span className="flex items-center gap-2 text-[10px] font-bold"><GitBranch className="h-4 w-4 text-[#C9842A]" /> Weekly revision</span><span className={`font-mono text-[10px] font-black ${pendingRevision ? 'text-[#C9842A]' : 'text-[#2F9E44]'}`}>{pendingRevision ? 'ACTION REQUIRED' : 'NO PENDING REVISION'}</span></Link></div>
            <div className="space-y-2 p-3.5"><Link to="/compliance" className="flex items-center justify-between rounded border border-[#D6DEE6] px-3 py-2.5 hover:bg-[#F8FAFC]"><span className="flex items-center gap-2 text-[10px] font-bold"><ShieldCheck className="h-4 w-4 text-[#2F9E44]" /> Compliance / conflicts</span><span className={`font-mono text-[10px] font-black ${conflicts ? 'text-[#C92A2A]' : 'text-[#2F9E44]'}`}>{conflicts ? `${conflicts} CONFLICT(S)` : 'CLEAR'}</span></Link><div className="flex items-center justify-between rounded border border-[#D6DEE6] px-3 py-2.5"><span className="flex items-center gap-2 text-[10px] font-bold"><Clock3 className="h-4 w-4 text-[#C9842A]" /> Deferred work</span><span className="font-mono text-sm font-black text-[#A76614]">{deferred.length || Number(metrics.total_jobs_deferred ?? 0)}</span></div></div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm"><div className="border-b border-[#D6DEE6] px-3.5 py-3"><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Weekly Plan Status</h2><p className="text-[10px] text-[#718294]">Status only — detailed Gantt remains in Weekly Plan</p></div><div className="grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-4"><div><div className="text-[9px] uppercase text-[#718294]">Baseline</div><div className="mt-1 text-[11px] font-black text-[#1E3A5F]">{baseline}</div></div><div><div className="text-[9px] uppercase text-[#718294]">Solver</div><div className="mt-1 font-mono text-[11px] font-black text-[#2F9E44]">{weekly?.solver_status || weekly?.status || '—'}</div></div><div><div className="text-[9px] uppercase text-[#718294]">Blocks</div><div className="mt-1 font-mono text-[11px] font-black">{blocks.length}</div></div><div><div className="text-[9px] uppercase text-[#718294]">Risk Coverage</div><div className="mt-1 font-mono text-[11px] font-black text-[#2F9E44]">{metrics.risk_coverage_percentage != null ? `${metrics.risk_coverage_percentage}%` : '—'}</div></div></div><div className="border-t border-[#D6DEE6] px-3.5 py-2.5"><Link to="/weekly" className="inline-flex items-center text-[10px] font-bold text-[#1E3A5F]">Open Weekly Plan <ArrowRight className="ml-1 h-3 w-3" /></Link></div></div>

          <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm"><div className="border-b border-[#D6DEE6] px-3.5 py-3"><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Cross-Department Coordination</h2><p className="text-[10px] text-[#718294]">Existing consolidated possessions in the approved plan</p></div><div className="space-y-2 p-3.5">{consolidated.slice(0, 4).map((b) => <div key={b.block_id} className="flex items-center justify-between rounded border border-[#D6DEE6] bg-[#FAFBFC] px-3 py-2"><div><div className="font-mono text-[9px] font-bold text-[#1E3A5F]">{b.block_id || '—'}</div><div className="text-[10px] text-[#52606D]">{b.section_id || '—'} • {b.track_id || '—'}</div></div><span className="flex items-center gap-1 text-[9px] font-bold text-[#6B5B95]"><Users className="h-3.5 w-3.5" />{(b.departments || []).join(' + ') || 'CONSOLIDATED'}</span></div>)}{!consolidated.length && <div className="text-[10px] text-[#718294]">No consolidated blocks in the current approved plan.</div>}</div></div>
        </section>

        <section className="rounded-md border border-[#D6DEE6] bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-[#D6DEE6] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Priority Work</h2><p className="text-[10px] text-[#718294]">Top jobs by MARS priority score</p></div><div className="flex items-center gap-1"><Filter className="h-3.5 w-3.5 text-[#718294]" />{['ALL','CRITICAL','HIGH','PENDING'].map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded px-2 py-1 text-[8px] font-bold ${filter === f ? 'bg-[#1E3A5F] text-white' : 'bg-[#F4F6F8] text-[#52606D]'}`}>{f}</button>)}</div></div><div className="overflow-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-[#F4F6F8] text-[9px] font-bold uppercase tracking-wider text-[#718294]"><tr><th className="px-3 py-2">Job</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Section</th><th className="px-3 py-2">AI Priority</th><th className="px-3 py-2">Criticality</th><th className="px-3 py-2">Due</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-[#E5EAF0]">{filteredJobs.slice(0, 12).map((j) => <tr key={j.job_id} className="hover:bg-[#F8FAFC]"><td className="px-3 py-2 font-mono text-[10px] font-bold text-[#1E3A5F]">{j.job_id || '—'}</td><td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${deptMeta[dept(j)] || 'border-[#D6DEE6] bg-[#F4F6F8] text-[#52606D]'}`}>{dept(j)}</span></td><td className="px-3 py-2 font-mono text-[9px] text-[#52606D]">{j.section_id || j.section || '—'}</td><td className="px-3 py-2 font-mono text-[10px] font-black">{score(j) || '—'}</td><td className="px-3 py-2 text-[9px] font-bold">{criticality(j) || '—'}</td><td className="px-3 py-2 font-mono text-[9px] text-[#52606D]">{String(j.due_date || '—').slice(0,10)}</td><td className="px-3 py-2 text-[9px] font-bold text-[#52606D]">{status(j) || 'PENDING'}</td></tr>)}</tbody></table></div><div className="border-t border-[#D6DEE6] px-3.5 py-2.5"><Link to="/jobs" className="inline-flex items-center text-[10px] font-bold text-[#1E3A5F]">Open Unified Job Pool <ArrowRight className="ml-1 h-3 w-3" /></Link></div></section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#2F9E44]" /><h3 className="text-[11px] font-black uppercase tracking-wider text-[#1E3A5F]">Compliance</h3></div><div className="mt-2 text-[10px] text-[#52606D]">{weekly?.compliance?.score != null ? `Validator score ${weekly.compliance.score}%` : 'Open the compliance module for the detailed rule audit.'}</div><Link to="/compliance" className="mt-2 inline-flex items-center text-[9px] font-bold text-[#1E3A5F]">Open Compliance <ArrowRight className="ml-1 h-3 w-3" /></Link></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><TrainFront className="h-4 w-4 text-[#B42318]" /><h3 className="text-[11px] font-black uppercase tracking-wider text-[#1E3A5F]">Train Protection</h3></div><div className="mt-2 text-[10px] text-[#52606D]">{trains.length ? `${trains.length} COA timetable movements loaded.` : 'COA timetable unavailable in this refresh.'}</div><Link to="/weekly" className="mt-2 inline-flex items-center text-[9px] font-bold text-[#1E3A5F]">Inspect weekly plan <ArrowRight className="ml-1 h-3 w-3" /></Link></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#6B5B95]" /><h3 className="text-[11px] font-black uppercase tracking-wider text-[#1E3A5F]">Planner Actions</h3></div><div className="mt-2 flex flex-wrap gap-1.5"><Link to="/weekly" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">Weekly</Link><Link to="/monthly" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">Monthly</Link><Link to="/what-if" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">What-If</Link><Link to="/integration" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">BDMS</Link></div></div>
        </section>
      </div>
    </main>
  );
}
