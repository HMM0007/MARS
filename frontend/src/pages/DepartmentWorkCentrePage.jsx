import { useEffect, useMemo, useState } from 'react';
import { Wrench, Radio, Zap, RefreshCw, AlertTriangle, CalendarDays, Link2, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { fetchAllScoredJobs, fetchWeeklyPlan } from '../services/api';

const CONFIG = {
  Engineering: { code: 'ENG', title: 'Engineering Work Centre', subtitle: 'Civil / Track Maintenance', color: '#3B6EA5', icon: Wrench },
  'S&T': { code: 'S&T', title: 'S&T Work Centre', subtitle: 'Signalling & Telecom Maintenance', color: '#2F8F6B', icon: Radio },
  Traction: { code: 'TRD', title: 'Traction Work Centre', subtitle: 'OHE / Traction Distribution', color: '#C9842A', icon: Zap },
};

const statusFor = (job, scheduled, deferred) => {
  const source = String(job.status || '').toUpperCase();
  if (source === 'COMPLETED') return 'COMPLETED';
  if (scheduled.has(job.job_id)) return 'SCHEDULED';
  if (deferred.has(job.job_id)) return 'DEFERRED';
  return 'PENDING';
};

const statusClass = (s) => s === 'SCHEDULED' ? 'bg-[#2F9E44]/10 text-[#2F9E44] border-[#2F9E44]/25' : s === 'DEFERRED' ? 'bg-[#F08C00]/10 text-[#A76614] border-[#F08C00]/25' : s === 'COMPLETED' ? 'bg-[#2F6F7E]/10 text-[#2F6F7E] border-[#2F6F7E]/25' : 'bg-[#F4F6F8] text-[#60748A] border-[#D6DEE6]';
const priorityClass = (p) => p === 'CRITICAL' ? 'text-[#C92A2A]' : p === 'HIGH' ? 'text-[#A76614]' : 'text-[#315F8D]';

export default function DepartmentWorkCentrePage({ department = 'Engineering' }) {
  const config = CONFIG[department] || CONFIG.Engineering;
  const Icon = config.icon;
  const [jobs, setJobs] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('ALL');
  const [view, setView] = useState('attention');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [j, p] = await Promise.all([fetchAllScoredJobs(), fetchWeeklyPlan()]);
      setJobs(Array.isArray(j) ? j : (j?.jobs || []));
      setPlan(p || null);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [department]);

  const blocks = plan?.blocks || plan?.scheduled_blocks || [];
  const scheduled = useMemo(() => new Set(blocks.flatMap(b => b.job_ids || [])), [blocks]);
  const deferred = useMemo(() => new Set(plan?.deferred_jobs || []), [plan]);
  const ownJobs = useMemo(() => jobs.filter(j => j.department === department), [jobs, department]);
  const ownBlocks = useMemo(() => blocks.filter(b => (b.departments || []).includes(department)), [blocks, department]);
  const sharedBlocks = useMemo(() => ownBlocks.filter(b => (b.departments || []).length > 1), [ownBlocks]);
  const otherBlocks = useMemo(() => blocks.filter(b => !(b.departments || []).includes(department)), [blocks, department]);
  const sections = useMemo(() => ['ALL', ...Array.from(new Set(ownJobs.map(j => j.section_id).filter(Boolean))).sort()], [ownJobs]);

  const rows = useMemo(() => ownJobs.map(j => ({ ...j, displayStatus: statusFor(j, scheduled, deferred) })).filter(j => section === 'ALL' || j.section_id === section).sort((a,b) => Number(b.ai_priority_score || 0) - Number(a.ai_priority_score || 0)), [ownJobs, scheduled, deferred, section]);
  const attention = rows.filter(j => ['CRITICAL','HIGH'].includes(j.criticality_level) && j.displayStatus !== 'COMPLETED');
  const pending = rows.filter(j => j.displayStatus === 'PENDING');
  const scheduledRows = rows.filter(j => j.displayStatus === 'SCHEDULED');
  const deferredRows = rows.filter(j => j.displayStatus === 'DEFERRED');
  const shown = view === 'scheduled' ? scheduledRows : view === 'deferred' ? deferredRows : view === 'pending' ? pending : attention;

  return <main className="min-h-full bg-[#F4F6F8] p-3.5 font-sans text-[#1F2933]">
    <div className="mx-auto max-w-[1800px] space-y-3">
      <header className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded text-white" style={{backgroundColor:config.color}}><Icon className="h-5 w-5"/></div><div><div className="flex items-center gap-2"><h1 className="text-lg font-black uppercase tracking-wide" style={{color:config.color}}>{config.title}</h1><span className="rounded border border-[#D6DEE6] bg-[#F8FAFC] px-2 py-0.5 text-[9px] font-bold uppercase text-[#52606D]">{config.code}</span></div><p className="mt-1 text-[10px] text-[#718294]">{config.subtitle} • Derived from the Unified Job Pool and current planning result.</p></div></div>
          <div className="flex items-center gap-2"><select value={section} onChange={e=>setSection(e.target.value)} className="rounded border border-[#D6DEE6] bg-white px-2.5 py-2 text-[10px] font-bold text-[#52606D]"><option value="ALL">All Sections</option>{sections.slice(1).map(s=><option key={s}>{s}</option>)}</select><button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-2 text-[10px] font-bold text-white"><RefreshCw className={`h-3.5 w-3.5 ${loading?'animate-spin':''}`}/>Refresh</button></div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[["Department Jobs",ownJobs.length,"Jobs in unified pool"],["Scheduled",scheduledRows.length,"Current approved plan"],["Pending",pending.length,"Awaiting planning outcome"],["Deferred",deferredRows.length,"Returned by planner/solver"]].map(([l,v,s],i)=><button key={l} onClick={()=>setView(i===1?'scheduled':i===2?'pending':i===3?'deferred':'attention')} className="rounded border border-[#D6DEE6] bg-white p-3 text-left shadow-sm hover:bg-[#FAFBFC]"><div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{l}</div><div className="mt-1 font-mono text-2xl font-black" style={{color:i===0?config.color:i===3?'#A76614':'#1E3A5F'}}>{loading?'—':v}</div><div className="mt-1 text-[9px] text-[#8796A5]">{s}</div></button>)}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.45fr_.8fr]">
        <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[#D6DEE6] bg-[#FAFBFC] px-3.5 py-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xs font-black uppercase tracking-wider text-[#1E3A5F]">{view === 'attention' ? 'Planner Attention Queue' : `${view} Department Work`}</h2><p className="mt-0.5 text-[9px] text-[#718294]">Sorted by the XGBoost priority score already produced by MARS.</p></div><div className="flex gap-1.5">{['attention','pending','scheduled','deferred'].map(v=><button key={v} onClick={()=>setView(v)} className={`rounded border px-2 py-1 text-[9px] font-bold uppercase ${view===v?'border-[#1E3A5F] bg-[#EAF1F8] text-[#1E3A5F]':'border-[#D6DEE6] bg-white text-[#718294]'}`}>{v}</button>)}</div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-[10px]"><thead><tr className="border-b border-[#D6DEE6] bg-[#F4F6F8] text-[9px] font-bold uppercase tracking-wider text-[#52606D]"><th className="px-3 py-2.5">Job</th><th className="px-3 py-2.5">Asset / Work</th><th className="px-3 py-2.5">Section</th><th className="px-3 py-2.5">Due</th><th className="px-3 py-2.5">AI Score</th><th className="px-3 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-[#E8EDF1]">{shown.slice(0,12).map(j=><tr key={j.job_id} onClick={()=>setSelected(j)} className="cursor-pointer hover:bg-[#F8FAFC]"><td className="px-3 py-2.5"><div className="font-mono font-black text-[#1E3A5F]">{j.job_id}</div><div className={`mt-0.5 text-[8px] font-bold ${priorityClass(j.criticality_level)}`}>{j.criticality_level || 'MEDIUM'}</div></td><td className="px-3 py-2.5"><div className="font-semibold">{String(j.defect_type || 'Maintenance').replaceAll('_',' ')}</div><div className="text-[8px] text-[#8796A5]">{j.asset_id || '—'}</div></td><td className="px-3 py-2.5 font-mono">{j.section_id || '—'}<div className="text-[8px] text-[#8796A5]">{j.track_id || '—'} · KM {j.location_km ?? '—'}</div></td><td className="px-3 py-2.5 font-mono">{j.due_date || '—'}</td><td className="px-3 py-2.5 font-mono font-black text-[#1E3A5F]">{Number(j.ai_priority_score || 0).toFixed(1)}</td><td className="px-3 py-2.5"><span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${statusClass(j.displayStatus)}`}>{j.displayStatus}</span></td></tr>)}{!loading&&!shown.length&&<tr><td colSpan="6" className="px-3 py-8 text-center text-[10px] text-[#718294]">No work in this view.</td></tr>}</tbody></table></div>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#1E3A5F]"/><h2 className="text-xs font-black uppercase tracking-wider text-[#1E3A5F]">Department Schedule</h2></div><div className="mt-3 space-y-2">{ownBlocks.slice(0,6).map(b=><div key={b.block_id} className={`rounded border p-2 ${b.departments?.length>1?'border-[#6B5B95]/30 bg-[#6B5B95]/5':'border-[#D6DEE6] bg-[#FAFBFC]'}`}><div className="flex justify-between gap-2"><span className="font-mono text-[9px] font-black">{b.block_id}</span><span className="text-[8px] font-bold text-[#52606D]">{b.departments?.length>1?'SHARED':'DEPARTMENT'}</span></div><div className="mt-1 text-[9px] font-semibold">{b.start_time ? new Date(b.start_time).toLocaleString() : '—'} → {b.end_time ? new Date(b.end_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}</div><div className="mt-1 font-mono text-[8px] text-[#718294]">{b.section_id} · {b.track_id} · {(b.job_ids||[]).join(', ')}</div></div>)}{!ownBlocks.length&&<div className="text-[9px] text-[#8796A5]">No approved blocks for this department.</div>}</div></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-[#6B5B95]"/><h2 className="text-xs font-black uppercase tracking-wider text-[#1E3A5F]">Cross-Department Coordination</h2></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded border border-[#6B5B95]/25 bg-[#6B5B95]/5 p-2"><div className="text-[8px] font-bold uppercase text-[#6B5B95]">Shared Blocks</div><div className="mt-1 font-mono text-xl font-black text-[#6B5B95]">{sharedBlocks.length}</div></div><div className="rounded border border-[#D6DEE6] bg-[#FAFBFC] p-2"><div className="text-[8px] font-bold uppercase text-[#718294]">Other Occupancy</div><div className="mt-1 font-mono text-xl font-black text-[#52606D]">{otherBlocks.length}</div></div></div><p className="mt-2 text-[8px] leading-4 text-[#718294]">Shared blocks shown here are only those actually returned by the unified solver; this view does not create or fake a consolidation.</p></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#2F9E44]"/><h2 className="text-xs font-black uppercase tracking-wider text-[#1E3A5F]">Planning Integrity</h2></div><div className="mt-3 space-y-1.5 text-[9px]"><div className="flex justify-between"><span className="text-[#718294]">Solver status</span><strong>{plan?.status || plan?.solver_status || '—'}</strong></div><div className="flex justify-between"><span className="text-[#718294]">Plan blocks</span><strong>{blocks.length}</strong></div><div className="flex justify-between"><span className="text-[#718294]">Deferred by solver</span><strong>{deferred.size}</strong></div></div></div>
        </div>
      </section>

      {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10263D]/30 p-4" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><div className="w-full max-w-xl rounded-lg border border-[#D6DEE6] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#D6DEE6] px-4 py-3"><div><div className="text-sm font-black text-[#1E3A5F]">{selected.job_id}</div><div className="text-[9px] text-[#718294]">{config.title} • operational detail</div></div><button onClick={()=>setSelected(null)} className="text-[#718294]">✕</button></div><div className="grid grid-cols-2 gap-px bg-[#D6DEE6]">{[['Status',selected.displayStatus],['AI Priority',Number(selected.ai_priority_score||0).toFixed(1)],['Criticality',selected.criticality_level],['Asset',selected.asset_id],['Section',selected.section_id],['Track',selected.track_id],['Location',selected.location_km!=null?`KM ${selected.location_km}`:'—'],['Due',selected.due_date],['Work',String(selected.defect_type||'Maintenance').replaceAll('_',' ')],['Duration',selected.estimated_duration_hours?`${selected.estimated_duration_hours} h`:'—']].map(([l,v])=><div key={l} className="bg-white px-3 py-2.5"><div className="text-[8px] font-bold uppercase text-[#8796A5]">{l}</div><div className="mt-1 text-[10px] font-semibold">{v||'—'}</div></div>)}</div><div className="border-t border-[#D6DEE6] bg-[#FAFBFC] px-4 py-3 text-[9px] text-[#718294]">Status is derived from the current approved weekly planning result and source completion state.</div></div></div>}
    </div>
  </main>;
}
