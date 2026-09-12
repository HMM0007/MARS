import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, BarChart3, CheckCircle2, Database, Link2, Plus, ShieldCheck, Wrench } from 'lucide-react';
import { fetchAllScoredJobs, fetchWeeklyPlan } from '../services/api';

const BLUE = '#3B6EA5';
const PURPLE = '#6B5B95';

const badge = (level) => level === 'CRITICAL'
  ? 'bg-[#C92A2A]/10 text-[#C92A2A] border-[#C92A2A]/30'
  : level === 'HIGH'
    ? 'bg-[#F08C00]/10 text-[#F08C00] border-[#F08C00]/30'
    : 'bg-[#EEF5FC] text-[#315F8D] border-[#C9DCEC]';

export default function EngineeringDashboardPage() {
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitted, setSubmitted] = useState([]);

  useEffect(() => {
    Promise.all([fetchAllScoredJobs(), fetchWeeklyPlan()])
      .then(([all, plan]) => {
        setJobs((all || []).filter(j => j.department === 'Engineering'));
        setWeekly(plan);
      })
      .catch(err => console.error('Engineering console load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  const ownJobs = useMemo(() => {
    const map = new Map();
    [...jobs, ...submitted].forEach(j => map.set(j.job_id, j));
    return [...map.values()];
  }, [jobs, submitted]);

  const blocks = weekly?.blocks || weekly?.scheduled_blocks || [];
  const ownBlocks = blocks.filter(b => (b.departments || []).includes('Engineering'));
  const sharedBlocks = ownBlocks.filter(b => b.is_consolidated || (b.departments || []).length > 1);
  const ghostBlocks = blocks.filter(b => !(b.departments || []).includes('Engineering')).slice(0, 5);
  const critical = ownJobs.filter(j => j.criticality_level === 'CRITICAL').length;
  const pending = ownJobs.filter(j => (j.status || 'PENDING') === 'PENDING').length;
  const path = location.pathname;
  const title = path.includes('/jobs/add') ? 'Add Maintenance Job'
    : path.includes('/jobs/pending') ? 'Pending / Intake'
    : path.includes('/jobs/priority-risk') ? 'Priority & Risk'
    : path.includes('/schedule') ? 'My Weekly Schedule'
    : path.includes('/blocks') ? 'Upcoming Blocks'
    : path.includes('/assets') ? 'Asset Risk'
    : path.includes('/shared-blocks') ? 'Shared Blocks'
    : path.includes('/dependencies') ? 'Dependencies'
    : path.includes('/tsr') ? 'TSR & Safety'
    : path.includes('/heavy-machine') ? 'Heavy Machine Work'
    : 'Engineering Control Centre';

  const submitJob = (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    setSubmitted(current => [...current, {
      ...values,
      department: 'Engineering',
      status: 'PENDING',
      location_km: Number(values.location_km || 0),
      estimated_duration_hours: Number(values.estimated_duration_hours || 2),
      ai_priority_score: null,
    }]);
    setShowAdd(false);
    e.currentTarget.reset();
  };

  if (loading) return <main className="p-5 bg-[#F4F6F8] min-h-full"><div className="bg-white border border-[#D6DEE6] p-6 rounded text-sm text-[#52606D]">Loading Engineering operational data…</div></main>;

  const jobTable = ownJobs.slice(0, path.includes('/jobs') ? 50 : 8);

  return <main className="p-4 space-y-4 bg-[#F4F6F8] min-h-full font-sans text-[#1F2933]">
    <section className="bg-white border border-[#D6DEE6] rounded shadow-sm p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-l-4" style={{borderLeftColor: BLUE}}>
      <div className="flex items-center gap-3"><div className="h-11 w-11 rounded flex items-center justify-center text-white" style={{backgroundColor: BLUE}}><Wrench className="h-6 w-6"/></div><div><div className="flex items-center gap-2"><h1 className="text-lg font-black uppercase tracking-wide">Engineering Control Centre</h1><span className="px-2 py-0.5 rounded bg-[#1E3A5F] text-white text-[9px] font-bold font-mono">ENG CONSOLE</span></div><p className="text-xs text-[#52606D] mt-1">Sr. DEN (Co-ord) / Pune • Data feed: Track Management System (TMS)</p></div></div>
      <button onClick={() => setShowAdd(true)} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-bold text-white" style={{backgroundColor: BLUE}}><Plus className="h-4 w-4"/> Add Maintenance Job</button>
    </section>

    {title !== 'Engineering Control Centre' && <div className="bg-[#EEF5FC] border border-[#C9DCEC] rounded px-3 py-2 text-xs"><span className="font-bold" style={{color: BLUE}}>Engineering / {title}</span><span className="text-[#52606D]"> — department-specific operational view</span></div>}

    <section className="grid grid-cols-2 xl:grid-cols-5 gap-3">
      {[["Engineering Jobs", ownJobs.length, BLUE, 'TMS + submitted'], ['Critical', critical, '#C92A2A', 'Immediate attention'], ['Pending / Intake', pending, '#F08C00', 'Awaiting planning'], ['Scheduled Blocks', ownBlocks.length, '#2F9E44', 'Unified weekly plan'], ['Shared Blocks', sharedBlocks.length, PURPLE, 'Multi-department']].map(([label,value,color,sub]) => <div key={label} className="bg-white border border-[#D6DEE6] rounded p-3 border-t-2" style={{borderTopColor: color}}><p className="text-[10px] uppercase font-bold text-[#52606D]">{label}</p><p className="text-2xl font-black font-mono mt-1" style={{color}}>{value}</p><p className="text-[10px] text-[#718294] mt-1">{sub}</p></div>)}
    </section>

    {(title === 'Engineering Control Centre' || title === 'Priority & Risk' || title === 'Pending / Intake' || title === 'Add Maintenance Job') && <>
      <section className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border border-[#D6DEE6] rounded overflow-hidden"><div className="px-3 py-2 bg-[#F4F6F8] border-b border-[#D6DEE6] flex justify-between"><h2 className="text-xs font-bold uppercase tracking-wider">Engineering Maintenance Queue & Risk</h2><span className="text-[10px] font-mono text-[#52606D]">XGBoost Priority 0–100</span></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#F8FAFB] text-[9px] uppercase text-[#60748A]"><tr>{['Job ID','Asset / Defect','Location','Criticality','AI Risk','Status'].map(x=><th key={x} className="px-3 py-2">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#E4E9EE]">{jobTable.map(j=><tr key={j.job_id} className="hover:bg-[#F8FAFB]"><td className="px-3 py-2 font-mono font-bold text-[#1E3A5F]">{j.job_id}</td><td className="px-3 py-2"><div className="font-semibold">{j.asset_type || 'TRACK'} / {String(j.defect_type || 'MAINTENANCE').replaceAll('_',' ')}</div><div className="text-[10px] text-[#718294]">{j.asset_id}</div></td><td className="px-3 py-2 font-mono">KM {j.location_km}</td><td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${badge(j.criticality_level)}`}>{j.criticality_level}</span></td><td className="px-3 py-2 font-mono font-bold text-[#1E3A5F]">{j.ai_priority_score == null ? 'Pending' : Number(j.ai_priority_score).toFixed(1)}</td><td className="px-3 py-2 text-[9px] font-mono font-bold">{j.status || 'PENDING'}</td></tr>)}</tbody></table></div></div>
        <div className="bg-white border border-[#D6DEE6] rounded overflow-hidden"><div className="px-3 py-2 bg-[#F4F6F8] border-b border-[#D6DEE6]"><h2 className="text-xs font-bold uppercase tracking-wider">Attention Required</h2></div><div className="p-3 space-y-2">{ownJobs.filter(j=>j.criticality_level==='CRITICAL'||j.status==='DEFERRED').slice(0,6).map(j=><div key={j.job_id} className="p-2 border border-[#E4E9EE] rounded flex gap-2"><AlertTriangle className="h-4 w-4 text-[#C92A2A] shrink-0"/><div><p className="text-[11px] font-bold">{j.job_id} • {j.criticality_level}</p><p className="text-[10px] text-[#60748A]">{j.defect_type?.replaceAll('_',' ')} at KM {j.location_km}</p></div></div>)}{!ownJobs.some(j=>j.criticality_level==='CRITICAL'||j.status==='DEFERRED')&&<p className="text-xs text-[#2F9E44] flex gap-2"><CheckCircle2 className="h-4 w-4"/> No critical/deferred Engineering items in current feed.</p>}</div></div>
      </section>
      <section className="grid xl:grid-cols-2 gap-4">
        <div className="bg-white border border-[#D6DEE6] rounded overflow-hidden"><div className="px-3 py-2 bg-[#F4F6F8] border-b border-[#D6DEE6]"><h2 className="text-xs font-bold uppercase tracking-wider">Track Asset Watch</h2></div><div className="grid grid-cols-2 gap-3 p-3"><div className="border border-[#D6DEE6] rounded p-3"><Wrench className="h-5 w-5 mb-2" style={{color:BLUE}}/><p className="text-xs font-bold">Track Assets</p><p className="text-xl font-black font-mono mt-1">{ownJobs.length}</p><p className="text-[10px] text-[#718294]">Jobs in civil/track domain</p></div><div className="border border-[#D6DEE6] rounded p-3"><BarChart3 className="h-5 w-5 mb-2" style={{color:BLUE}}/><p className="text-xs font-bold">High Risk Assets</p><p className="text-xl font-black font-mono mt-1">{ownJobs.filter(j=>j.criticality_level==='CRITICAL'||j.criticality_level==='HIGH').length}</p><p className="text-[10px] text-[#718294]">Critical + high priority</p></div></div></div>
        <div className="bg-white border border-[#D6DEE6] rounded overflow-hidden"><div className="px-3 py-2 bg-[#F4F6F8] border-b border-[#D6DEE6] flex justify-between"><h2 className="text-xs font-bold uppercase tracking-wider">TMS Feed Health</h2><span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EEF5FC] text-[#315F8D] font-bold">CONNECTED</span></div><div className="p-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-lg font-black font-mono">{ownJobs.length}</p><p className="text-[9px] text-[#718294]">TMS Jobs</p></div><div><p className="text-lg font-black font-mono">{weekly?.status || 'READY'}</p><p className="text-[9px] text-[#718294]">Weekly Solver</p></div><div><p className="text-lg font-black font-mono">{ownBlocks.length}</p><p className="text-[9px] text-[#718294]">Blocks</p></div></div></div>
      </section>
    </>}

    {['My Weekly Schedule','Upcoming Blocks','Shared Blocks','Dependencies','TSR & Safety','Heavy Machine Work','Asset Risk'].includes(title) && <section className="bg-white border border-[#D6DEE6] rounded overflow-hidden"><div className="px-3 py-2 bg-[#F4F6F8] border-b border-[#D6DEE6] flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider">{title}</h2><span className="text-[10px] text-[#52606D]">Unified MARS view • Engineering scope</span></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#F8FAFB] text-[9px] uppercase text-[#60748A]"><tr><th className="px-3 py-2">Block / Job</th><th className="px-3 py-2">Section / Track</th><th className="px-3 py-2">Window</th><th className="px-3 py-2">Departments</th><th className="px-3 py-2">State</th></tr></thead><tbody className="divide-y divide-[#E4E9EE]">{(title==='Dependencies'?ownJobs.filter(j=>j.dependency_job_id):title.includes('Asset')||title.includes('TSR')||title.includes('Heavy')?ownJobs:title==='Shared Blocks'?sharedBlocks:ownBlocks).slice(0,20).map((x,i)=><tr key={x.block_id||x.job_id||i}><td className="px-3 py-2 font-mono font-bold text-[#1E3A5F]">{x.block_id||x.job_id}</td><td className="px-3 py-2">{x.section_id} / {x.track_id}</td><td className="px-3 py-2 font-mono text-[10px]">{x.start_time?.replace('T',' ') || x.due_date || '—'}{x.end_time ? ` → ${x.end_time.replace('T',' ')}` : ''}</td><td className="px-3 py-2">{(x.departments||[x.department]).join(', ')}</td><td className="px-3 py-2 font-bold text-[10px]">{x.status || (x.is_consolidated?'SHARED / PURPLE':'SCHEDULED')}</td></tr>)}</tbody></table></div></section>}

    {ghostBlocks.length > 0 && (title === 'Engineering Control Centre' || title === 'Shared Blocks') && <section className="bg-white border border-[#D6DEE6] rounded overflow-hidden"><div className="px-3 py-2 bg-[#F4F6F8] border-b border-[#D6DEE6] flex items-center gap-2"><Link2 className="h-4 w-4" style={{color:PURPLE}}/><h2 className="text-xs font-bold uppercase tracking-wider">Cross-Department Shared Block Opportunities</h2></div><div className="p-3 grid md:grid-cols-2 xl:grid-cols-3 gap-2">{ghostBlocks.map(b=><div key={b.block_id} className="border border-[#D6DEE6] rounded p-3 bg-[#FAFBFC]"><p className="text-[10px] font-mono font-bold text-[#52606D]">{b.block_id} • GHOST</p><p className="text-xs font-bold mt-1">{(b.departments||[]).join(', ') || 'Other Department'}</p><p className="text-[10px] text-[#718294] mt-1">{b.section_id} / {b.track_id} • {b.duration_hours || 2}h</p></div>)}</div></section>}

    {showAdd && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={submitJob} className="bg-white rounded-lg shadow-2xl border border-[#D6DEE6] w-full max-w-xl p-5 space-y-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black uppercase">Add Engineering Maintenance Job</h2><p className="text-[10px] text-[#718294] mt-1">Submit to Engineering intake; final block is assigned by Planner.</p></div><button type="button" onClick={()=>setShowAdd(false)} className="text-[#52606D] text-xs font-bold">Close</button></div><div className="grid grid-cols-2 gap-3">{[['job_id','Job ID','ENG-NEW-001'],['asset_id','Asset ID','TRK-PUNE-001'],['asset_type','Asset Type','TRACK'],['section_id','Section','PUNE-LNL'],['track_id','Track','PUNE-LNL-UP'],['location_km','Location (KM)','227.4'],['defect_type','Maintenance / Defect','TRACK_RENEWAL'],['estimated_duration_hours','Duration (hours)','2']].map(([name,label,placeholder])=><label key={name} className="text-[10px] font-bold text-[#52606D]">{label}<input name={name} placeholder={placeholder} required className="mt-1 w-full border border-[#D6DEE6] rounded px-2 py-1.5 text-xs font-normal text-[#1F2933]"/></label>)}</div><div className="flex justify-end gap-2 pt-2 border-t border-[#D6DEE6]"><button type="button" onClick={()=>setShowAdd(false)} className="px-3 py-1.5 border border-[#D6DEE6] rounded text-xs">Cancel</button><button type="submit" className="px-4 py-1.5 rounded text-xs font-bold text-white" style={{backgroundColor:BLUE}}>Submit Job</button></div></form></div>}
  </main>;
}
