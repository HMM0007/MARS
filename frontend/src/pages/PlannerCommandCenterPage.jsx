import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Filter, GitBranch, RefreshCw, ShieldCheck, TrainFront, Users, XCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAllScoredJobs, fetchCOATimetable, fetchHealth, fetchPendingWeeklyRevision, fetchWeeklyPlan } from '../services/api';
import UnifiedGantt from '../components/UnifiedGantt';
import ExplainabilityModal from '../components/ExplainabilityModal';

const deptMeta = {
  Engineering: { label: 'Engineering', cls: 'bg-[#3B6EA5]/10 text-[#3B6EA5] border-[#3B6EA5]/25' },
  'S&T': { label: 'S&T', cls: 'bg-[#2F8F6B]/10 text-[#2F8F6B] border-[#2F8F6B]/25' },
  Traction: { label: 'Traction', cls: 'bg-[#C9842A]/10 text-[#A76614] border-[#C9842A]/25' },
};

const normalizeJobs = (data) => Array.isArray(data) ? data : (data?.jobs || data?.items || []);
const priorityOf = (j) => Number(j?.ai_priority_score ?? j?.priority_score ?? j?.priority ?? 0);
const deptOf = (j) => j?.department || j?.dept || 'Unknown';
const criticalityOf = (j) => String(j?.criticality_level || j?.criticality || '').toUpperCase();
const statusOf = (j) => String(j?.status || '').toUpperCase();

export default function PlannerCommandCenterPage({ currentRole }) {
  const navigate = useNavigate();
  const [weekly, setWeekly] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [trains, setTrains] = useState([]);
  const [pendingRevision, setPendingRevision] = useState(null);
  const [health, setHealth] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [explainBlock, setExplainBlock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');

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
    const [weeklyResult, jobsResult, trainsResult, revisionResult, healthResult] = results;
    if (weeklyResult.status === 'fulfilled') setWeekly(weeklyResult.value);
    if (jobsResult.status === 'fulfilled') setJobs(normalizeJobs(jobsResult.value));
    if (trainsResult.status === 'fulfilled') setTrains(Array.isArray(trainsResult.value) ? trainsResult.value : (trainsResult.value?.timetable || []));
    if (revisionResult.status === 'fulfilled') setPendingRevision(revisionResult.value);
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (weeklyResult.status === 'rejected' && jobsResult.status === 'rejected') setError('Unable to load the operational planning data from MARS 2.0.');
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const blocks = weekly?.blocks || weekly?.scheduled_blocks || [];
  const metrics = weekly?.metrics || weekly?.weekly_metrics || {};
  const deferred = weekly?.deferred_jobs || [];
  const criticalPending = useMemo(() => jobs.filter((j) => criticalityOf(j) === 'CRITICAL' && !['SCHEDULED', 'COMPLETED', 'APPROVED'].includes(statusOf(j))), [jobs]);
  const emergencyJobs = useMemo(() => jobs.filter((j) => String(j?.work_type || '').toUpperCase() === 'EMERGENCY_MAINTENANCE'), [jobs]);
  const conflictCount = Number(metrics.active_conflicts ?? weekly?.compliance?.conflicts ?? 0);
  const consolidated = blocks.filter((b) => b?.is_consolidated || (b?.departments || []).length > 1);
  const filteredJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => priorityOf(b) - priorityOf(a));
    if (filter === 'CRITICAL') return sorted.filter((j) => criticalityOf(j) === 'CRITICAL');
    if (filter === 'HIGH') return sorted.filter((j) => priorityOf(j) >= 70 && criticalityOf(j) !== 'CRITICAL');
    if (filter === 'PENDING') return sorted.filter((j) => !['SCHEDULED', 'COMPLETED', 'APPROVED'].includes(statusOf(j)));
    return sorted;
  }, [jobs, filter]);

  const baselineLabel = weekly?.baseline_governance?.mode === 'APPROVED_BASELINE'
    ? `Approved baseline R${weekly?.baseline_governance?.revision ?? weekly?.baseline_revision ?? '—'}`
    : (weekly?.baseline_approved ? `Approved baseline R${weekly?.baseline_revision ?? '—'}` : 'Candidate plan');

  return (
    <main className="min-h-full bg-[#F4F6F8] p-4 font-sans text-[#1F2933]">
      <div className="mx-auto max-w-[1800px] space-y-3.5">
        <section className="flex flex-col gap-3 rounded-md border border-[#D6DEE6] bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-black uppercase tracking-wide text-[#1E3A5F]">Planner Command Centre</h1>
              <span className="rounded border border-[#1E3A5F]/20 bg-[#1E3A5F]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1E3A5F]">Operational Workspace</span>
              <span className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-0.5 font-mono text-[9px] font-bold text-[#52606D]">PUNE-CR</span>
            </div>
            <p className="mt-1 text-[11px] text-[#52606D]">Unified maintenance planning workspace • Engineering + S&T + Traction • Trains remain hard constraints</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-1.5">
              <span className={`h-2 w-2 rounded-full ${health ? 'bg-[#2F9E44]' : 'bg-[#F08C00]'}`} />
              <span className="text-[10px] font-bold uppercase text-[#52606D]">{health ? 'System Online' : 'Checking System'}</span>
            </div>
            <button onClick={loadData} disabled={loading} className="flex items-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#2F6F7E] disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Loading' : 'Refresh'}
            </button>
          </div>
        </section>

        {error && <div className="flex items-center gap-2 rounded border border-[#C92A2A]/25 bg-[#C92A2A]/5 px-3 py-2 text-[11px] font-semibold text-[#C92A2A]"><AlertCircle className="h-4 w-4" /> {error}</div>}

        <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
          {[
            ['Jobs in Pool', jobs.length, 'text-[#1E3A5F]'],
            ['Critical', criticalPending.length, 'text-[#C92A2A]'],
            ['Scheduled Blocks', blocks.length, 'text-[#1E3A5F]'],
            ['Deferred', deferred.length || Number(metrics.total_jobs_deferred ?? 0), 'text-[#A76614]'],
            ['Conflicts', conflictCount, conflictCount ? 'text-[#C92A2A]' : 'text-[#2F9E44]'],
            ['Shared Blocks', consolidated.length, 'text-[#6B5B95]'],
          ].map(([label, value, cls]) => <div key={label} className="rounded border border-[#D6DEE6] bg-white px-3 py-2.5"><div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{label}</div><div className={`mt-0.5 text-xl font-black font-mono ${cls}`}>{loading ? '—' : value}</div></div>)}
        </section>

        {pendingRevision && (
          <section className="flex flex-col gap-2 rounded border border-[#C9842A]/35 bg-[#FFF8EA] px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 text-[#C9842A]" /><div><div className="text-[11px] font-black uppercase text-[#8A5A0A]">Planner action required — pending revision</div><div className="text-[10px] text-[#6B7280]">A revised weekly proposal exists. The approved baseline remains protected until explicit Planner approval.</div></div></div>
            <Link to="/weekly" className="inline-flex items-center justify-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-1.5 text-[10px] font-bold text-white">Review Changes <ArrowRight className="h-3 w-3" /></Link>
          </section>
        )}

        <section className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#D6DEE6] px-3.5 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Weekly Command Gantt</h2><p className="text-[10px] text-[#718294]">{baselineLabel} • click a block for operational audit</p></div>
            <div className="flex items-center gap-1.5"><span className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1 text-[9px] font-bold text-[#52606D]">{weekly?.solver_status || weekly?.status || '—'}</span><Link to="/weekly" className="rounded border border-[#D6DEE6] px-2.5 py-1 text-[9px] font-bold text-[#1E3A5F] hover:bg-[#F4F6F8]">Open Full Weekly Plan</Link></div>
          </div>
          <div className="p-2">
            <UnifiedGantt blocks={blocks} trains={trains} selectedBlockId={selectedBlock?.block_id} onSelectBlock={(b) => setSelectedBlock(b)} onBlockClick={(b) => setSelectedBlock(b)} currentRole={currentRole} onOpenExplainability={(b) => setExplainBlock(b)} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,0.8fr)]">
          <section className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-[#D6DEE6] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Unified Job Queue</h2><p className="text-[10px] text-[#718294]">Planner view of the shared maintenance intake</p></div>
              <div className="flex items-center gap-1"><Filter className="h-3.5 w-3.5 text-[#718294]" />{['ALL','CRITICAL','HIGH','PENDING'].map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded px-2 py-1 text-[8px] font-bold ${filter === f ? 'bg-[#1E3A5F] text-white' : 'bg-[#F4F6F8] text-[#52606D]'}`}>{f}</button>)}</div>
            </div>
            <div className="max-h-[390px] overflow-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead className="sticky top-0 bg-[#F4F6F8] text-[9px] font-bold uppercase tracking-wider text-[#718294]"><tr><th className="px-3 py-2">Job</th><th className="px-3 py-2">Dept</th><th className="px-3 py-2">Section</th><th className="px-3 py-2">AI Priority</th><th className="px-3 py-2">Criticality</th><th className="px-3 py-2">Due</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody className="divide-y divide-[#E5EAF0]">{filteredJobs.slice(0, 18).map((j) => { const meta = deptMeta[deptOf(j)] || { cls: 'bg-[#F4F6F8] text-[#52606D] border-[#D6DEE6]' }; return <tr key={j.job_id} className="hover:bg-[#F8FAFC]"><td className="px-3 py-2 font-mono text-[10px] font-bold text-[#1E3A5F]">{j.job_id || '—'}</td><td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${meta.cls}`}>{deptOf(j)}</span></td><td className="px-3 py-2 font-mono text-[9px] text-[#52606D]">{j.section_id || j.section || '—'}</td><td className="px-3 py-2 font-mono text-[10px] font-black">{priorityOf(j) || '—'}</td><td className="px-3 py-2 text-[9px] font-bold">{criticalityOf(j) || '—'}</td><td className="px-3 py-2 font-mono text-[9px] text-[#52606D]">{String(j.due_date || '—').slice(0,10)}</td><td className="px-3 py-2 text-[9px] font-bold text-[#52606D]">{statusOf(j) || 'PENDING'}</td></tr>; })}</tbody>
              </table>
            </div>
            <div className="border-t border-[#D6DEE6] px-3.5 py-2"><Link to="/jobs" className="text-[10px] font-bold text-[#1E3A5F]">Open complete Unified Job Pool <ArrowRight className="inline h-3 w-3" /></Link></div>
          </section>

          <section className="space-y-3">
            <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
              <div className="border-b border-[#D6DEE6] px-3.5 py-3"><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Planner Exceptions</h2><p className="text-[10px] text-[#718294]">Only items requiring attention</p></div>
              <div className="divide-y divide-[#E5EAF0]">
                <Link to="/jobs/priority-risk" className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F8FAFC]"><span className="flex items-center gap-2 text-[10px] font-bold"><AlertCircle className="h-4 w-4 text-[#C92A2A]" /> Critical jobs needing attention</span><span className="font-mono text-[11px] font-black text-[#C92A2A]">{criticalPending.length}</span></Link>
                <Link to="/weekly" className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F8FAFC]"><span className="flex items-center gap-2 text-[10px] font-bold"><GitBranch className="h-4 w-4 text-[#C9842A]" /> Pending revision</span><span className={`font-mono text-[11px] font-black ${pendingRevision ? 'text-[#C9842A]' : 'text-[#2F9E44]'}`}>{pendingRevision ? 'ACTION' : 'NONE'}</span></Link>
                <Link to="/compliance" className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F8FAFC]"><span className="flex items-center gap-2 text-[10px] font-bold"><XCircle className="h-4 w-4 text-[#C92A2A]" /> Active conflicts</span><span className={`font-mono text-[11px] font-black ${conflictCount ? 'text-[#C92A2A]' : 'text-[#2F9E44]'}`}>{conflictCount}</span></Link>
                <div className="flex items-center justify-between px-3.5 py-2.5"><span className="flex items-center gap-2 text-[10px] font-bold"><Clock3 className="h-4 w-4 text-[#C9842A]" /> Deferred work</span><span className="font-mono text-[11px] font-black text-[#C9842A]">{deferred.length || Number(metrics.total_jobs_deferred ?? 0)}</span></div>
              </div>
            </div>

            <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
              <div className="border-b border-[#D6DEE6] px-3.5 py-3"><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Cross-Department Coordination</h2></div>
              <div className="p-3.5 space-y-2">
                {consolidated.slice(0, 5).map((b) => <button key={b.block_id} onClick={() => setSelectedBlock(b)} className="flex w-full items-center justify-between rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-2 text-left hover:bg-[#F4F6F8]"><span><div className="font-mono text-[9px] font-bold text-[#1E3A5F]">{b.block_id}</div><div className="text-[10px] font-semibold text-[#52606D]">{b.section_id} • {b.track_id}</div></span><span className="flex items-center gap-1 text-[8px] font-bold text-[#6B5B95]"><Users className="h-3.5 w-3.5" /> {(b.departments || []).join(' + ') || 'CONSOLIDATED'}</span></button>)}
                {!consolidated.length && <div className="text-[10px] text-[#718294]">No consolidated blocks in the current approved plan.</div>}
              </div>
            </div>
          </section>
        </div>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#2F9E44]" /><h3 className="text-[11px] font-black uppercase tracking-wider text-[#1E3A5F]">Compliance</h3></div><div className="mt-2 flex items-end justify-between"><span className="text-[10px] text-[#718294]">Post-solve validator</span><span className="font-mono text-lg font-black text-[#2F9E44]">{weekly?.compliance?.score ?? weekly?.compliance?.compliance_score ?? '—'}<span className="text-[9px]">%</span></span></div><Link to="/compliance" className="mt-2 inline-flex items-center text-[9px] font-bold text-[#1E3A5F]">Open Compliance & Safety <ArrowRight className="ml-1 h-3 w-3" /></Link></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><TrainFront className="h-4 w-4 text-[#B42318]" /><h3 className="text-[11px] font-black uppercase tracking-wider text-[#1E3A5F]">Train Protection</h3></div><div className="mt-2 text-[10px] text-[#52606D]">{trains.length ? `${trains.length} COA timetable movements loaded into the planning workspace.` : 'COA timetable unavailable in this refresh.'}</div><Link to="/weekly" className="mt-2 inline-flex items-center text-[9px] font-bold text-[#1E3A5F]">Inspect weekly protection <ArrowRight className="ml-1 h-3 w-3" /></Link></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#2F9E44]" /><h3 className="text-[11px] font-black uppercase tracking-wider text-[#1E3A5F]">Planner Actions</h3></div><div className="mt-2 flex flex-wrap gap-1.5"><Link to="/weekly" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">Weekly Plan</Link><Link to="/monthly" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">Monthly Plan</Link><Link to="/what-if" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">What-If</Link><Link to="/integration" className="rounded border border-[#D6DEE6] bg-[#F4F6F8] px-2 py-1.5 text-[9px] font-bold text-[#1E3A5F]">BDMS</Link></div></div>
        </section>
      </div>
      <ExplainabilityModal block={explainBlock} isOpen={Boolean(explainBlock)} onClose={() => setExplainBlock(null)} />
    </main>
  );
}
