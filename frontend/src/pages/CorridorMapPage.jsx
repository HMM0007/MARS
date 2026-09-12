import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, TrainFront, Wrench, Layers3 } from 'lucide-react';
import { fetchAllScoredJobs, fetchWeeklyPlan } from '../services/api';
import SatelliteMap from '../components/SatelliteMap';

export default function CorridorMapPage() {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [plan, jobData] = await Promise.all([fetchWeeklyPlan().catch(() => null), fetchAllScoredJobs().catch(() => [])]);
      setWeeklyPlan(plan); setJobs(Array.isArray(jobData) ? jobData : []);
    } catch (err) { setError(err?.message || 'Unable to load corridor data'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const blocks = weeklyPlan?.scheduled_blocks || weeklyPlan?.blocks || [];
  const scheduledJobIds = useMemo(() => new Set(blocks.flatMap((b) => b.job_ids || [])), [blocks]);
  const sharedBlocks = blocks.filter((b) => (b.departments || b.jobs_detail?.map((j) => j.department).filter(Boolean) || []).filter(Boolean).length > 1).length;
  const pendingJobs = jobs.filter((j) => !scheduledJobIds.has(j.job_id)).length;
  const criticalJobs = jobs.filter((j) => j.criticality_level === 'CRITICAL').length;

  return <main className="flex min-h-full flex-col gap-3 bg-[#F4F6F8] p-4 sm:p-5">
    <header className="flex flex-col gap-3 rounded-lg border border-[#D6DEE6] bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded bg-[#1E3A5F] text-white"><Layers3 className="h-4 w-4" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-bold tracking-tight text-[#1F2933]">Pune–Lonavala Corridor</h1><span className="rounded bg-[#E8F1FB] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#145DA8]">Maintenance & Block View</span></div><p className="mt-0.5 text-[11px] text-[#52606D]">Pune Division • Central Railway • Km 191.0–254.84 • Double line • 25 kV AC electrified</p></div></div>
      <div className="flex items-center gap-2"><div className="hidden items-center gap-2 text-[9px] font-mono text-[#52606D] md:flex"><span className="flex items-center gap-1"><TrainFront className="h-3.5 w-3.5" /> COA protected</span><span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-[#2F9E44]" /> CP-SAT plan</span></div><button onClick={load} disabled={loading} className="flex h-8 items-center gap-1.5 rounded-md bg-[#1E3A5F] px-3 text-[10px] font-bold text-white hover:bg-[#2F6F7E] disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Refreshing' : 'Refresh'}</button></div>
    </header>

    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <div className="rounded-md border border-[#D6DEE6] bg-white px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-[#8796A5]">Corridor Jobs</div><div className="mt-0.5 text-lg font-bold text-[#173E6C]">{jobs.length}</div></div>
      <div className="rounded-md border border-[#D6DEE6] bg-white px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-[#8796A5]">Scheduled Possessions</div><div className="mt-0.5 text-lg font-bold text-[#2F9E44]">{blocks.length}</div></div>
      <div className="rounded-md border border-[#D6DEE6] bg-white px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-[#8796A5]">Shared Blocks</div><div className="mt-0.5 text-lg font-bold text-[#6B5B95]">{sharedBlocks}</div></div>
      <div className="rounded-md border border-[#D6DEE6] bg-white px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-[#8796A5]">Pending / Critical</div><div className="mt-0.5 flex items-baseline gap-2 text-lg font-bold text-[#C9842A]"><span>{pendingJobs}</span><span className="text-[10px] font-semibold text-[#C92A2A]">{criticalJobs} critical</span></div></div>
    </div>

    {error && <div className="rounded-md border border-[#F1B6B6] bg-[#FFF5F5] px-3 py-2 text-[10px] font-semibold text-[#C92A2A]">{error}</div>}
    <section className="min-h-0 flex-1"><SatelliteMap blocks={blocks} jobs={jobs} selectedBlock={selectedBlock} selectedJob={selectedJob} onSelectBlock={setSelectedBlock} onSelectJob={setSelectedJob} isFullScreenMode={fullScreen} onToggleFullScreen={() => setFullScreen((v) => !v)} /></section>
    {!fullScreen && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#D6DEE6] bg-white px-3 py-2 text-[9px] text-[#52606D] shadow-sm"><span><Wrench className="mr-1 inline h-3 w-3 text-[#1E3A5F]" />Maintenance is rendered as corridor possessions, not map pins.</span><span>Zoom-out is bounded to the Pune–Lonavala operational context • zoom-in remains available for route detail.</span></div>}
  </main>;
}
