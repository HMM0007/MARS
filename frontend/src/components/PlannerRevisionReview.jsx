import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { fetchApprovedWeeklyPlan, fetchPendingWeeklyRevision } from '../services/api';

const blocksOf = (plan) => plan?.scheduled_blocks || plan?.blocks || [];
const idsOf = (block) => Array.isArray(block?.job_ids) ? block.job_ids : [];
const fmt = (value) => value ? new Date(value).toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

const getPendingRecord = (payload) => payload?.revision || payload?.pending_revision || payload?.proposal || (payload?.new_job_id && payload?.plan ? payload : null);

const summarize = (baseline, proposal, newJobId) => {
  const before = blocksOf(baseline?.plan || baseline);
  const after = blocksOf(proposal);
  const beforeByJob = new Map();
  before.forEach((b) => idsOf(b).forEach((id) => beforeByJob.set(id, b)));
  const afterByJob = new Map();
  after.forEach((b) => idsOf(b).forEach((id) => afterByJob.set(id, b)));
  const moved = [];
  afterByJob.forEach((a, id) => {
    if (id === newJobId) return;
    const b = beforeByJob.get(id);
    if (b && (b.start_time !== a.start_time || b.end_time !== a.end_time || b.track_id !== a.track_id)) moved.push({ id, before: b, after: a });
  });
  const added = newJobId ? after.filter((b) => idsOf(b).includes(newJobId)) : [];
  const frozen = proposal?.incremental?.frozen_job_ids || [];
  const deferred = proposal?.deferred_jobs || proposal?.incremental?.deferred_job_ids || [];
  return { moved, added, frozen, deferred };
};

export default function PlannerRevisionReview() {
  const [pending, setPending] = useState(null);
  const [approved, setApproved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([fetchPendingWeeklyRevision(), fetchApprovedWeeklyPlan()]);
      const record = getPendingRecord(p);
      const hasPending = Boolean(record) && (p?.pending !== false);
      setPending(hasPending ? { ...p, revision: record } : null);
      setApproved(a?.approved ? a : (a?.plan ? { ...a, approved: true } : null));
    } catch (err) {
      console.warn('Revision review lookup failed:', err);
      setPending(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const record = pending?.revision;
  const plan = record?.plan;
  const newJobId = record?.new_job_id;
  const summary = useMemo(() => record ? summarize(approved, plan, newJobId) : null, [record, approved, plan, newJobId]);

  if (loading || !record) return null;

  const compliance = plan?.compliance;
  const frozenCount = summary.frozen.length;
  const changedCount = summary.moved.length + summary.added.length;
  const statusLabel = plan?.status || '—';

  return <section className="mt-2 rounded border border-[#D6DEE6] bg-white shadow-sm overflow-hidden">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 px-3 py-2.5 bg-[#FFF9E8] border-b border-[#F0C36A]">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#C92A2A]" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-[#1F2933]">Planner Revision Review</h2>
            <span className="rounded bg-[#C92A2A] px-1.5 py-0.5 text-[8px] font-black text-white">ACTION REQUIRED</span>
          </div>
          <p className="text-[9px] text-[#52606D] truncate">{newJobId || 'New job'} • incremental repair of approved baseline R{record.source_revision ?? '—'} • {changedCount} changed block(s)</p>
        </div>
      </div>
      <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex items-center gap-1.5 self-start lg:self-auto rounded border border-[#1E3A5F]/25 bg-white px-2.5 py-1.5 text-[9px] font-bold text-[#1E3A5F] hover:bg-[#F4F6F8]">
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? 'Hide Details' : 'Review Changes'}
      </button>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-[#D6DEE6]">
      {[['NEW JOB', newJobId || '—'], ['MOVED', summary.moved.length], ['NEW BLOCK', summary.added.length], ['FROZEN', frozenCount], ['DEFERRED', summary.deferred.length], ['SOLVER', statusLabel]].map(([label, value]) => <div key={label} className="bg-white px-2.5 py-1.5"><p className="text-[7px] font-bold uppercase text-[#718294]">{label}</p><p className="mt-0.5 truncate font-mono text-[10px] font-black text-[#1F2933]">{value}</p></div>)}
    </div>

    {expanded && <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 p-3">
      <div className="xl:col-span-2 rounded border border-[#D6DEE6] overflow-hidden">
        <div className="border-b border-[#D6DEE6] bg-[#F4F6F8] px-3 py-2"><p className="text-[9px] font-black uppercase text-[#1F2933]">Exactly What Changes</p><p className="text-[8px] text-[#718294]">Only affected changes are shown. The approved baseline remains protected until the Planner approves the revision above.</p></div>
        {summary.added.map((b) => <div key={`added-${b.block_id}`} className="border-b border-[#D6DEE6]/60 bg-[#F0FBF4] px-3 py-2"><div className="flex justify-between"><span className="text-[8px] font-black uppercase text-[#2F9E44]">+ New block</span><span className="font-mono text-[8px]">{b.block_id}</span></div><p className="mt-1 text-[9px] font-bold">{b.section_id} • {b.track_id}</p><p className="text-[8px] font-mono text-[#52606D]">{fmt(b.start_time)} → {fmt(b.end_time)}</p></div>)}
        {summary.moved.map((m) => <div key={m.id} className="border-b border-[#D6DEE6]/60 px-3 py-2"><div className="flex justify-between"><span className="text-[8px] font-black uppercase text-[#C9842A]">Changed block</span><span className="font-mono text-[8px] font-bold">{m.id}</span></div><div className="mt-1 grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] px-2 py-1"><p className="text-[7px] font-bold text-[#718294]">BEFORE</p><p className="text-[8px] font-mono">{fmt(m.before.start_time)} → {fmt(m.before.end_time)}</p><p className="text-[7px] text-[#718294]">{m.before.track_id}</p></div><div className="rounded bg-[#FFF9E8] px-2 py-1"><p className="text-[7px] font-bold text-[#8A5A00]">AFTER</p><p className="text-[8px] font-mono">{fmt(m.after.start_time)} → {fmt(m.after.end_time)}</p><p className="text-[7px] text-[#8A5A00]">{m.after.track_id}</p></div></div></div>)}
        {!summary.added.length && !summary.moved.length && <div className="px-3 py-4 text-center text-[9px] text-[#52606D]">No existing block moved. Check the decision checks for whether the new job was scheduled.</div>}
      </div>

      <div className="space-y-2">
        <div className="rounded border border-[#D6DEE6] p-2.5"><div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-[#2F9E44]"/><p className="text-[9px] font-black uppercase">Decision Checks</p></div><div className="mt-2 space-y-1.5 text-[9px]"><div className="flex justify-between"><span>New job scheduled</span><b>{plan?.incremental?.scheduled_new_job ? 'YES' : 'NO'}</b></div><div className="flex justify-between"><span>Compliance</span><b className={compliance?.overall_status === 'PASS' ? 'text-[#2F9E44]' : 'text-[#C9842A]'}>{compliance?.overall_status || 'NOT AVAILABLE'}</b></div><div className="flex justify-between"><span>Frozen approved jobs</span><b>{frozenCount}</b></div><div className="flex justify-between"><span>Deferred jobs</span><b>{summary.deferred.length}</b></div></div></div>
        <div className="rounded border border-[#D6DEE6] bg-[#F8FAFB] p-2.5"><p className="text-[8px] font-black uppercase text-[#52606D]">Planner rule</p><p className="mt-1 text-[9px] leading-relaxed text-[#1F2933]">Review the changes here first. Use the existing <b>Approve Plan Revision</b> control above only after the placement and compliance are acceptable.</p></div>
      </div>
    </div>}
  </section>;
}
