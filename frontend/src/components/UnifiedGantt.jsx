import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter, RefreshCw, Train, ZoomIn, ZoomOut } from 'lucide-react';
import { fetchWeeklyPlan, fetchCOATimetable } from '../services/api';

const COLORS = {
  Engineering: '#3B6EA5',
  'S&T': '#2F8F6B',
  Traction: '#C9842A',
  Consolidated: '#6B5B95',
  Train: '#B42318',
  TSR: '#F08C00',
};
const TRACK_ORDER = ['PUNE-LNL', 'PUNE-DD', 'LNL-KJT', 'PUNE-MRJ', 'CWD-YARD'];
const DAY_WIDTHS = { compact: 220, standard: 300, detail: 420 };

const parseDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const startOfDay = (v) => { const d = new Date(v); d.setHours(0, 0, 0, 0); return d; };
const addDays = (v, n) => { const d = new Date(v); d.setDate(d.getDate() + n); return d; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const formatDay = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
const formatTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
const trackLabel = (id = '') => {
  const p = id.split('-');
  if (p.length >= 3) {
    const corridor = `${p[0]} – ${p[1]}`;
    const suffix = p.slice(2).join('-');
    if (suffix === 'UP' || suffix === 'DN' || suffix === 'LOOP') return `${corridor} · ${suffix}`;
  }
  return id.replaceAll('-', ' – ');
};
const departments = (b) => Array.isArray(b?.departments) ? b.departments.filter(Boolean) : [];
const shared = (b) => departments(b).length > 1;
const dept = (b) => shared(b) ? 'Consolidated' : (departments(b)[0] || 'Engineering');

export default function UnifiedGantt({
  blocks: propBlocks,
  trains: propTrains,
  onBlockClick,
  onSelectBlock,
  selectedBlockId,
  onOpenExplainability,
}) {
  const [plan, setPlan] = useState(null);
  const [internalTrains, setInternalTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('week');
  const [offset, setOffset] = useState(0);
  const [density, setDensity] = useState('standard');
  const [showTrains, setShowTrains] = useState(true);
  const [showTSR, setShowTSR] = useState(false);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTrack, setSelectedTrack] = useState('ALL');
  const [selectedId, setSelectedId] = useState(selectedBlockId || null);
  const [layers, setLayers] = useState(false);
  const timelineRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, t] = await Promise.all([fetchWeeklyPlan(), fetchCOATimetable().catch(() => [])]);
      setPlan(p); setInternalTrains(t || []);
    } catch (e) { setError(e?.message || 'Unable to load weekly plan'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!propBlocks?.length) loadData(); }, [propBlocks, loadData]);
  useEffect(() => { if (selectedBlockId !== undefined) setSelectedId(selectedBlockId); }, [selectedBlockId]);

  const blocks = useMemo(() => propBlocks?.length ? propBlocks : (plan?.scheduled_blocks || plan?.blocks || []), [propBlocks, plan]);
  const trains = useMemo(() => propTrains?.length ? propTrains : internalTrains, [propTrains, internalTrains]);

  // COA is fixed input. Anchor the visual week to the earliest operational
  // or maintenance date so trains are never hidden because the approved plan
  // happens to begin later in the week.
  const baseWeekStart = useMemo(() => {
    const dates = [...blocks.map(b => parseDate(b.start_time)), ...trains.map(t => parseDate(t.entry_time))].filter(Boolean).sort((a,b) => a-b);
    const first = startOfDay(dates[0] || new Date());
    const day = first.getDay();
    first.setDate(first.getDate() + (day === 0 ? -6 : 1 - day));
    return first;
  }, [blocks, trains]);

  const horizon = useMemo(() => {
    const days = view === 'day' ? 1 : view === '48h' ? 2 : 7;
    return { start: addDays(baseWeekStart, offset), end: addDays(baseWeekStart, offset + days), days };
  }, [baseWeekStart, offset, view]);
  const dayWidth = DAY_WIDTHS[density];
  const timelineWidth = dayWidth * horizon.days;
  const position = useCallback((v) => {
    const d = parseDate(v); if (!d) return null;
    return ((d - horizon.start) / (horizon.end - horizon.start)) * timelineWidth;
  }, [horizon, timelineWidth]);
  const widthBetween = useCallback((a, b) => {
    const s = parseDate(a), e = parseDate(b); if (!s || !e) return 0;
    const left = Math.max(s, horizon.start), right = Math.min(e, horizon.end);
    return Math.max(0, ((right-left) / (horizon.end-horizon.start)) * timelineWidth);
  }, [horizon, timelineWidth]);

  const filteredBlocks = useMemo(() => blocks.filter(b => {
    const s = parseDate(b.start_time), e = parseDate(b.end_time);
    if (!s || !e || e <= horizon.start || s >= horizon.end) return false;
    const d = dept(b);
    return (selectedDept === 'ALL' || d === selectedDept || (selectedDept === 'Shared' && shared(b))) &&
      (selectedTrack === 'ALL' || b.track_id === selectedTrack);
  }), [blocks, horizon, selectedDept, selectedTrack]);

  const filteredTrains = useMemo(() => showTrains ? trains.filter(t => {
    const s = parseDate(t.entry_time), e = parseDate(t.exit_time);
    return s && e && e > horizon.start && s < horizon.end;
  }) : [], [trains, showTrains, horizon]);

  const tracks = useMemo(() => {
    const ids = new Set();
    filteredBlocks.forEach(b => b.track_id && ids.add(b.track_id));
    filteredTrains.forEach(t => t.track_id && ids.add(t.track_id));
    return [...ids].sort((a,b) => {
      const pa = TRACK_ORDER.findIndex(x => a.startsWith(x));
      const pb = TRACK_ORDER.findIndex(x => b.startsWith(x));
      return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb) || a.localeCompare(b);
    });
  }, [filteredBlocks, filteredTrains]);

  const reset = () => { setView('week'); setOffset(0); setDensity('standard'); requestAnimationFrame(() => { if (timelineRef.current) timelineRef.current.scrollLeft = 0; }); };
  const move = (dir) => setOffset(v => v + dir * (view === 'day' ? 1 : view === '48h' ? 2 : 7));
  const handleBlock = (b) => { setSelectedId(b.block_id); onBlockClick?.(b); onSelectBlock?.(b); onOpenExplainability?.(b); };

  if (loading && !blocks.length) return <div className="rounded-lg border border-[#D6DEE6] bg-white p-12 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1E3A5F]" /><p className="mt-3 text-sm font-semibold text-[#1F2933]">Loading weekly possession plan…</p></div>;
  if (error && !blocks.length) return <div className="rounded-lg border border-[#D6DEE6] bg-white p-10 text-center"><p className="text-sm font-semibold text-[#C92A2A]">Weekly plan unavailable</p><p className="mt-1 text-xs text-[#52606D]">{error}</p><button onClick={loadData} className="mt-3 rounded bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white">Retry</button></div>;

  return <section className="overflow-hidden rounded-lg border border-[#C9D4DF] bg-white shadow-sm" aria-label="Weekly possession schedule">
    <div className="border-b border-[#D6DEE6] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded bg-[#EAF0F6]"><Calendar className="h-4 w-4 text-[#1E3A5F]" /></div><div><h2 className="text-sm font-extrabold uppercase tracking-wide text-[#1E3A5F]">Weekly Possession Schedule</h2><p className="text-[11px] text-[#52606D]">Fixed COA train movements · MARS maintenance windows</p></div></div>
        <div className="flex items-center gap-1.5"><button title="Previous window" onClick={() => move(-1)} className="rounded border border-[#D6DEE6] p-2 text-[#52606D]"><ChevronLeft className="h-4 w-4" /></button><button onClick={reset} className="rounded border border-[#D6DEE6] px-3 py-2 text-[11px] font-bold text-[#1E3A5F]">Full Week</button><button title="Next window" onClick={() => move(1)} className="rounded border border-[#D6DEE6] p-2 text-[#52606D]"><ChevronRight className="h-4 w-4" /></button><div className="ml-1 flex overflow-hidden rounded border border-[#D6DEE6]">{['day','48h','week'].map(m => <button key={m} onClick={() => { setView(m); setOffset(0); }} className={`px-2.5 py-2 text-[10px] font-extrabold uppercase ${view===m?'bg-[#1E3A5F] text-white':'text-[#52606D]'}`}>{m==='48h'?'48 H':m}</button>)}</div><button title="Refresh" onClick={loadData} className="ml-1 rounded border border-[#D6DEE6] p-2 text-[#1E3A5F]"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`} /></button></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F6] pt-2.5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#52606D]"><span>{formatDay(horizon.start)} — {formatDay(addDays(horizon.end,-1))}</span><span>|</span><span>{filteredBlocks.length} possessions</span><span>|</span><span>{filteredTrains.length} trains shown</span></div><div className="flex items-center gap-1.5">{['ALL','Engineering','S&T','Traction','Shared'].map(d => <button key={d} onClick={() => setSelectedDept(d)} className={`rounded border px-2.5 py-1.5 text-[10px] font-bold ${selectedDept===d?'border-[#1E3A5F] bg-[#1E3A5F] text-white':'border-[#D6DEE6] text-[#52606D]'}`}>{d==='ALL'?'All work':d}</button>)}<select value={selectedTrack} onChange={e=>setSelectedTrack(e.target.value)} className="ml-1 rounded border border-[#D6DEE6] bg-white px-2 py-1.5 text-[10px] font-semibold text-[#52606D]"><option value="ALL">All tracks</option>{tracks.map(t=><option key={t} value={t}>{trackLabel(t)}</option>)}</select><div className="relative ml-1"><button onClick={()=>setLayers(v=>!v)} className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-bold ${layers?'border-[#1E3A5F] bg-[#1E3A5F] text-white':'border-[#D6DEE6] text-[#52606D]'}`}><Filter className="h-3 w-3"/> Layers</button>{layers&&<div className="absolute right-0 top-9 z-30 w-48 rounded-md border border-[#D6DEE6] bg-white p-2.5 shadow-lg"><label className="flex items-center justify-between py-1.5 text-xs"><span className="flex items-center gap-2"><Train className="h-3.5 w-3.5 text-[#B42318]"/> Fixed trains</span><input type="checkbox" checked={showTrains} onChange={e=>setShowTrains(e.target.checked)}/></label><label className="flex items-center justify-between border-t border-[#EEF2F6] py-1.5 text-xs"><span>TSR recovery</span><input type="checkbox" checked={showTSR} onChange={e=>setShowTSR(e.target.checked)}/></label></div>}</div></div></div>
    </div>

    <div className="flex items-center justify-between border-b border-[#D6DEE6] bg-[#F8FAFC] px-4 py-2"><div className="flex flex-wrap items-center gap-4 text-[10px] text-[#52606D]"><span><b className="text-[#1F2933]">Red line:</b> fixed train movement</span><span><b className="text-[#1F2933]">Blocks:</b> MARS maintenance schedule</span><span><b className="text-[#1F2933]">Click:</b> block for decision details</span></div><div className="flex items-center gap-1 rounded border border-[#D6DEE6] bg-white p-0.5"><button title="More detail" onClick={()=>setDensity(d=>d==='compact'?'standard':'detail')} className="p-1"><ZoomIn className="h-3.5 w-3.5"/></button><span className="px-1 text-[9px] font-bold uppercase text-[#52606D]">Density</span><button title="More compact" onClick={()=>setDensity(d=>d==='detail'?'standard':'compact')} className="p-1"><ZoomOut className="h-3.5 w-3.5"/></button></div></div>

    <div className="flex min-h-[560px] max-h-[700px] overflow-hidden">
      <div className="w-[220px] shrink-0 border-r border-[#CBD5E1] bg-white"><div className="flex h-[64px] items-end border-b border-[#CBD5E1] bg-[#F8FAFC] px-4 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#52606D]">Track / line</div>{tracks.map(track=><div key={track} className="flex h-[82px] items-center border-b border-[#E2E8F0] px-4"><div><div className="text-[11px] font-extrabold text-[#1F2933]">{trackLabel(track)}</div><div className="mt-0.5 font-mono text-[9px] text-[#7B8794]">{track}</div></div></div>)}{!tracks.length&&<div className="p-5 text-xs text-[#52606D]">No track matches this view.</div>}</div>
      <div ref={timelineRef} className="relative flex-1 overflow-auto bg-white"><div style={{width:timelineWidth,minWidth:'100%'}}>
        <div className="sticky top-0 z-20 h-[64px] border-b border-[#CBD5E1] bg-white"><div className="absolute inset-0 flex">{Array.from({length:horizon.days},(_,i)=>{const day=addDays(horizon.start,i);return <div key={day.toISOString()} style={{width:dayWidth}} className="shrink-0 border-r border-[#CBD5E1] bg-[#F8FAFC]"><div className="flex h-[34px] items-center border-b border-[#E2E8F0] px-3"><span className="text-[11px] font-extrabold uppercase text-[#1F2933]">{formatDay(day)}</span></div><div className="grid h-[30px] grid-cols-6 text-[8px] font-semibold text-[#7B8794]">{[0,4,8,12,16,20].map(h=><span key={h} className="flex items-center border-r border-[#EEF2F6] pl-1.5">{String(h).padStart(2,'0')}:00</span>)}</div></div>})}</div></div>
        <div className="relative">{Array.from({length:horizon.days},(_,i)=><div key={i} style={{left:i*dayWidth,width:dayWidth}} className={`absolute top-0 bottom-0 pointer-events-none border-r border-[#D6DEE6] ${i%2?'bg-[#FBFCFD]':'bg-white'}`}/>) }
          {tracks.map(track=>{
            const trackBlocks=filteredBlocks.filter(b=>b.track_id===track);
            const trackTrains=filteredTrains.filter(t=>t.track_id===track);
            return <div key={track} className="relative h-[82px] border-b border-[#E2E8F0]">
              {trackTrains.map(train=>{const s=parseDate(train.entry_time),e=parseDate(train.exit_time);const left=position(s),width=widthBetween(s,e);if(left===null||width<=0)return null;const isFreight=String(train.train_type||train.service_type||'').toUpperCase().includes('FREIGHT');return <div key={`${train.train_id||train.train_number}-${train.entry_time}`} title={`Fixed COA train · ${train.train_number||train.train_id||''} · ${train.train_name||''} · ${formatTime(s)}–${formatTime(e)}`} className="absolute z-[2] h-[3px] rounded-full" style={{left:clamp(left,0,timelineWidth),top:15,width:Math.max(3,width),background:isFreight?'transparent':COLORS.Train,borderTop:isFreight?`2px dashed ${COLORS.Train}`:'none'}}><span className="absolute -left-0.5 -top-0.5 h-1 w-1 rounded-full" style={{background:COLORS.Train}}/></div>})}
              {trackBlocks.map(block=>{const s=parseDate(block.start_time),e=parseDate(block.end_time);if(!s||!e)return null;const left=clamp(position(s)??0,0,timelineWidth),width=widthBetween(s,e);if(width<=1)return null;const isShared=shared(block),d=isShared?'Consolidated':dept(block),color=COLORS[d]||COLORS.Engineering,selected=selectedId===block.block_id,critical=String(block.criticality||'').toUpperCase()==='CRITICAL'||Number(block.ai_priority_score||block.priority_score||0)>=90,jobIds=Array.isArray(block.job_ids)?block.job_ids:[],label=jobIds.length>1?`${jobIds.length} jobs`:(jobIds[0]||block.block_id),deptLabel=isShared?departments(block).join(' + '):(departments(block)[0]||'Engineering');return <button key={block.block_id} type="button" onClick={()=>handleBlock(block)} title={`${block.block_id} · ${label} · ${deptLabel} · ${formatTime(s)}–${formatTime(e)}`} className={`group absolute z-[3] h-[31px] overflow-hidden rounded border text-left ${selected?'ring-2 ring-[#1E3A5F] ring-offset-1':'hover:ring-1 hover:ring-[#1E3A5F]'}`} style={{left,top:38,width:Math.max(18,width),background:isShared?'#EEE8F7':`${color}14`,borderColor:isShared?COLORS.Consolidated:`${color}55`}}><span className="absolute inset-y-0 left-0 w-1" style={{background:color}}/>{critical&&<span className="absolute left-2 top-1.5 h-2 w-2 rounded-full bg-[#C92A2A]"/>}<span className="absolute inset-y-0 left-4 right-1 flex items-center gap-1 truncate pr-1 text-[9px] font-extrabold text-[#1F2933]"><span className="truncate">{label}</span>{isShared&&<span className="shrink-0 rounded bg-[#6B5B95] px-1 text-[7px] font-bold text-white">{deptLabel}</span>}</span>{width>=150&&<span className="absolute bottom-0.5 right-1 text-[7px] font-mono font-bold text-[#52606D]">{formatTime(s)}–{formatTime(e)}</span>}</button>})}
              {showTSR&&trackBlocks.map(block=>{if(!block.tsr_recovery_profile)return null;let cursor=parseDate(block.end_time);return (block.tsr_recovery_profile.recovery_stages||[]).map((stage,i)=>{if(!cursor)return null;const ss=new Date(cursor),ee=new Date(cursor.getTime()+Number(stage.duration_hours||0)*3600000);cursor=ee;const left=position(ss),width=widthBetween(ss,ee);if(left===null||width<=1)return null;return <div key={`tsr-${block.block_id}-${i}`} title={`TSR ${stage.max_speed_kmh} km/h`} className="absolute bottom-1 h-[5px] border border-dashed border-[#F08C00]" style={{left,width:Math.max(3,width),background:'repeating-linear-gradient(135deg, rgba(240,140,0,.35) 0, rgba(240,140,0,.35) 3px, transparent 3px, transparent 6px)'}}/>})})}
            </div>;
          })}
        </div>
      </div></div>
    </div>
  </section>;
}
