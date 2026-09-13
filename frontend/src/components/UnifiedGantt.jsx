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
const DAY_WIDTH_CONFIG = {
  day: { compact: 1320, standard: 1680, detail: 2160 },
  '48h': { compact: 960, standard: 1200, detail: 1560 },
  week: { compact: 260, standard: 340, detail: 440 },
};

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

  // Anchor the visual week to the earliest operational or maintenance date
  const baseWeekStart = useMemo(() => {
    const dates = [...blocks.map(b => parseDate(b.start_time)), ...trains.map(t => parseDate(t.entry_time))].filter(Boolean).sort((a, b) => a - b);
    const first = startOfDay(dates[0] || new Date());
    const day = first.getDay();
    first.setDate(first.getDate() + (day === 0 ? -6 : 1 - day));
    return first;
  }, [blocks, trains]);

  const horizon = useMemo(() => {
    const days = view === 'day' ? 1 : view === '48h' ? 2 : 7;
    return { start: addDays(baseWeekStart, offset), end: addDays(baseWeekStart, offset + days), days };
  }, [baseWeekStart, offset, view]);

  const dayWidth = (DAY_WIDTH_CONFIG[view] || DAY_WIDTH_CONFIG.week)[density] || 340;
  const handoverWidth = view === 'day' ? 140 : 0;
  const timelineWidth = dayWidth * horizon.days;
  const totalCanvasWidth = timelineWidth + handoverWidth;

  const position = useCallback((v) => {
    const d = parseDate(v); if (!d) return null;
    return ((d - horizon.start) / (horizon.end - horizon.start)) * timelineWidth;
  }, [horizon, timelineWidth]);

  const widthBetween = useCallback((a, b) => {
    const s = parseDate(a), e = parseDate(b); if (!s || !e) return 0;
    const left = Math.max(s, horizon.start), right = Math.min(e, horizon.end);
    return Math.max(0, ((right - left) / (horizon.end - horizon.start)) * timelineWidth);
  }, [horizon, timelineWidth]);

  // Enable smooth horizontal wheel scrolling
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > 0 && Math.abs(e.deltaX) === 0) {
        if (el.scrollWidth > el.clientWidth) {
          el.scrollLeft += e.deltaY * 1.2;
          e.preventDefault();
        }
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
    return [...ids].sort((a, b) => {
      const pa = TRACK_ORDER.findIndex(x => a.startsWith(x));
      const pb = TRACK_ORDER.findIndex(x => b.startsWith(x));
      return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb) || a.localeCompare(b);
    });
  }, [filteredBlocks, filteredTrains]);

  const reset = () => { setView('week'); setOffset(0); setDensity('standard'); requestAnimationFrame(() => { if (timelineRef.current) timelineRef.current.scrollLeft = 0; }); };
  const move = (dir) => setOffset(v => v + dir * (view === 'day' ? 1 : view === '48h' ? 2 : 7));
  const handleBlock = (b) => { setSelectedId(b.block_id); onBlockClick?.(b); onSelectBlock?.(b); onOpenExplainability?.(b); };

  const scrollToHour = (hour) => {
    if (!timelineRef.current) return;
    const target = (hour / 24) * dayWidth;
    timelineRef.current.scrollTo({ left: Math.max(0, target - 40), behavior: 'smooth' });
  };

  const dayTicks = useMemo(() => {
    if (view === 'day') {
      return Array.from({ length: 24 }, (_, i) => i);
    }
    if (view === '48h') {
      return [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    }
    return [0, 4, 8, 12, 16, 20];
  }, [view]);

  if (loading && !blocks.length) return <div className="rounded-lg border border-[#D6DEE6] bg-white p-12 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1E3A5F]" /><p className="mt-3 text-sm font-semibold text-[#1F2933]">Loading weekly possession plan…</p></div>;
  if (error && !blocks.length) return <div className="rounded-lg border border-[#D6DEE6] bg-white p-10 text-center"><p className="text-sm font-semibold text-[#C92A2A]">Weekly plan unavailable</p><p className="mt-1 text-xs text-[#52606D]">{error}</p><button onClick={loadData} className="mt-3 rounded bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white">Retry</button></div>;

  return <section className="overflow-hidden rounded-lg border border-[#C9D4DF] bg-white shadow-sm" aria-label="Weekly possession schedule">
    <div className="border-b border-[#D6DEE6] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#EAF0F6]"><Calendar className="h-4 w-4 text-[#1E3A5F]" /></div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#1E3A5F]">Weekly Possession Schedule</h2>
            <p className="text-[11px] text-[#52606D]">Fixed COA train movements · MARS maintenance windows</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button title="Previous window" onClick={() => move(-1)} className="rounded border border-[#D6DEE6] p-2 text-[#52606D] hover:bg-[#F1F5F9]"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={reset} className="rounded border border-[#D6DEE6] px-3 py-2 text-[11px] font-bold text-[#1E3A5F] hover:bg-[#F1F5F9]">Full Week</button>
          <button title="Next window" onClick={() => move(1)} className="rounded border border-[#D6DEE6] p-2 text-[#52606D] hover:bg-[#F1F5F9]"><ChevronRight className="h-4 w-4" /></button>
          <div className="ml-1 flex overflow-hidden rounded border border-[#D6DEE6]">
            {['day', '48h', 'week'].map(m => (
              <button key={m} onClick={() => { setView(m); }} className={`px-2.5 py-2 text-[10px] font-extrabold uppercase transition-colors ${view === m ? 'bg-[#1E3A5F] text-white' : 'bg-white text-[#52606D] hover:bg-[#F8FAFC]'}`}>
                {m === '48h' ? '48 H' : m}
              </button>
            ))}
          </div>
          <button title="Refresh" onClick={loadData} className="ml-1 rounded border border-[#D6DEE6] p-2 text-[#1E3A5F] hover:bg-[#F1F5F9]"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F6] pt-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#52606D]">
          <span>{view === 'day' ? `${formatDay(horizon.start)} · 24-Hour Timeline` : `${formatDay(horizon.start)} — ${formatDay(addDays(horizon.end, -1))}`}</span>
          <span>|</span>
          <span>{filteredBlocks.length} possessions</span>
          <span>|</span>
          <span>{filteredTrains.length} trains shown</span>
        </div>
        <div className="flex items-center gap-1.5">
          {['ALL', 'Engineering', 'S&T', 'Traction', 'Shared'].map(d => (
            <button key={d} onClick={() => setSelectedDept(d)} className={`rounded border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${selectedDept === d ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-[#D6DEE6] bg-white text-[#52606D] hover:bg-[#F8FAFC]'}`}>
              {d === 'ALL' ? 'All work' : d}
            </button>
          ))}
          <select value={selectedTrack} onChange={e => setSelectedTrack(e.target.value)} className="ml-1 rounded border border-[#D6DEE6] bg-white px-2 py-1.5 text-[10px] font-semibold text-[#52606D]">
            <option value="ALL">All tracks</option>
            {tracks.map(t => <option key={t} value={t}>{trackLabel(t)}</option>)}
          </select>
          <div className="relative ml-1">
            <button onClick={() => setLayers(v => !v)} className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-bold ${layers ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-[#D6DEE6] bg-white text-[#52606D]'}`}>
              <Filter className="h-3 w-3" /> Layers
            </button>
            {layers && (
              <div className="absolute right-0 top-9 z-30 w-48 rounded-md border border-[#D6DEE6] bg-white p-2.5 shadow-lg">
                <label className="flex items-center justify-between py-1.5 text-xs"><span className="flex items-center gap-2"><Train className="h-3.5 w-3.5 text-[#B42318]" /> Fixed trains</span><input type="checkbox" checked={showTrains} onChange={e => setShowTrains(e.target.checked)} /></label>
                <label className="flex items-center justify-between border-t border-[#EEF2F6] py-1.5 text-xs"><span>TSR recovery</span><input type="checkbox" checked={showTSR} onChange={e => setShowTSR(e.target.checked)} /></label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6DEE6] bg-[#F8FAFC] px-4 py-2">
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#52606D]">
        <span><b className="text-[#1F2933]">Train ribbon:</b> fixed COA movement</span>
        <span><b className="text-[#1F2933]">Blocks:</b> MARS maintenance schedule</span>
        <span><b className="text-[#1F2933]">🌙 Overnight:</b> spans midnight boundary</span>
        <span><b className="text-[#1F2933]">Click:</b> block for decision details</span>
      </div>
      <div className="flex items-center gap-3">
        {view === 'day' && (
          <div className="flex items-center gap-1 text-[9px]">
            <span className="font-bold text-[#52606D]">Jump:</span>
            <button onClick={() => scrollToHour(0)} className="rounded border border-[#D6DEE6] bg-white px-1.5 py-0.5 font-semibold text-[#1E3A5F] hover:bg-[#EEF2F6]">00:00</button>
            <button onClick={() => scrollToHour(6)} className="rounded border border-[#D6DEE6] bg-white px-1.5 py-0.5 font-semibold text-[#1E3A5F] hover:bg-[#EEF2F6]">06:00</button>
            <button onClick={() => scrollToHour(12)} className="rounded border border-[#D6DEE6] bg-white px-1.5 py-0.5 font-semibold text-[#1E3A5F] hover:bg-[#EEF2F6]">12:00</button>
            <button onClick={() => scrollToHour(18)} className="rounded border border-[#D6DEE6] bg-white px-1.5 py-0.5 font-semibold text-[#1E3A5F] hover:bg-[#EEF2F6]">18:00</button>
            <button onClick={() => scrollToHour(22)} className="rounded border border-[#6B5B95] bg-[#EEE8F7] px-1.5 py-0.5 font-bold text-[#6B5B95] hover:bg-[#E4DAF3]">22:00 Night 🌙</button>
          </div>
        )}
        <div className="flex items-center gap-1 rounded border border-[#D6DEE6] bg-white p-0.5">
          <button title="More detail" onClick={() => setDensity(d => d === 'compact' ? 'standard' : 'detail')} className="p-1"><ZoomIn className="h-3.5 w-3.5" /></button>
          <span className="px-1 text-[9px] font-bold uppercase text-[#52606D]">Density</span>
          <button title="More compact" onClick={() => setDensity(d => d === 'detail' ? 'standard' : 'compact')} className="p-1"><ZoomOut className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>

    <div className="flex min-h-[560px] max-h-[700px] overflow-hidden">
      {/* Pinned Left Track Column */}
      <div className="w-[220px] shrink-0 border-r border-[#CBD5E1] bg-white shadow-xs z-10">
        <div className="flex h-[64px] items-end border-b border-[#CBD5E1] bg-[#F8FAFC] px-4 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#52606D]">Track / line</div>
        {tracks.map(track => (
          <div key={track} className="flex h-[82px] items-center border-b border-[#E2E8F0] px-4">
            <div>
              <div className="text-[11px] font-extrabold text-[#1F2933]">{trackLabel(track)}</div>
              <div className="mt-0.5 font-mono text-[9px] text-[#7B8794]">{track}</div>
            </div>
          </div>
        ))}
        {!tracks.length && <div className="p-5 text-xs text-[#52606D]">No track matches this view.</div>}
      </div>

      {/* Horizontal Scrollable Timeline */}
      <div 
        ref={timelineRef} 
        className="relative flex-1 overflow-x-auto overflow-y-hidden bg-white"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#94A3B8 #F1F5F9',
        }}
      >
        <div style={{ width: totalCanvasWidth, minWidth: '100%' }}>
          {/* Header Row */}
          <div className="sticky top-0 z-20 h-[64px] border-b border-[#CBD5E1] bg-white shadow-xs">
            <div className="absolute inset-0 flex">
              {Array.from({ length: horizon.days }, (_, i) => {
                const day = addDays(horizon.start, i);
                const colWidth = dayWidth / dayTicks.length;
                return (
                  <div key={day.toISOString()} style={{ width: dayWidth }} className="shrink-0 border-r border-[#CBD5E1] bg-[#F8FAFC]">
                    <div className="flex h-[34px] items-center justify-between border-b border-[#E2E8F0] px-3">
                      <span className="text-[11px] font-extrabold uppercase text-[#1F2933]">{formatDay(day)}</span>
                      {view === 'day' && <span className="rounded bg-[#1E3A5F] px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider">Full Day Window</span>}
                    </div>
                    <div className="flex h-[30px]">
                      {dayTicks.map(h => (
                        <div key={h} style={{ width: colWidth }} className="flex items-center border-r border-[#E2E8F0] px-1 font-mono text-[9px] font-semibold text-[#64748B]">
                          {String(h).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {view === 'day' && (
                <div style={{ width: handoverWidth }} className="shrink-0 border-r border-[#CBD5E1] bg-[#F1F5F9] flex flex-col justify-center px-3 border-l-2 border-dashed border-[#94A3B8]">
                  <div className="text-[10px] font-extrabold text-[#1E3A5F] flex items-center gap-1">
                    <span>🌙</span>
                    <span>Sun +1d</span>
                  </div>
                  <div className="text-[8px] font-semibold text-[#64748B]">Overnight Handover</div>
                </div>
              )}
            </div>
          </div>

          {/* Grid Rows */}
          <div className="relative">
            {/* Background Hour Guidelines */}
            {Array.from({ length: horizon.days }, (_, i) => {
              const colWidth = dayWidth / dayTicks.length;
              return (
                <div key={i} style={{ left: i * dayWidth, width: dayWidth }} className="absolute top-0 bottom-0 pointer-events-none flex border-r border-[#CBD5E1]">
                  {dayTicks.map((h, idx) => (
                    <div key={h} style={{ width: colWidth }} className={`h-full border-r border-[#EEF2F6] ${idx % 2 === 1 ? 'bg-[rgba(248,250,252,0.5)]' : ''}`} />
                  ))}
                </div>
              );
            })}
            {view === 'day' && (
              <div 
                style={{ left: timelineWidth, width: handoverWidth }} 
                className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed border-[#94A3B8] bg-[repeating-linear-gradient(135deg,rgba(241,245,249,0.7)_0,rgba(241,245,249,0.7)_8px,rgba(248,250,252,0.7)_8px,rgba(248,250,252,0.7)_16px)]" 
              />
            )}

            {/* Tracks */}
            {tracks.map(track => {
              const trackBlocks = filteredBlocks.filter(b => b.track_id === track);
              const trackTrains = filteredTrains.filter(t => t.track_id === track);
              return (
                <div key={track} className="relative h-[82px] border-b border-[#E2E8F0]">
                  {/* Trains */}
                  {trackTrains.map(train => {
                    const s = parseDate(train.entry_time), e = parseDate(train.exit_time);
                    const left = position(s), width = widthBetween(s, e);
                    if (left === null || width <= 0) return null;
                    const isFreight = String(train.train_type || train.service_type || '').toUpperCase().includes('FREIGHT');
                    const trainNum = train.train_number || train.train_id || 'TRN';
                    const trainName = train.train_name || '';
                    const renderedWidth = Math.max(22, width);
                    const showFull = renderedWidth >= 75;
                    const showNum = renderedWidth >= 30;
                    return (
                      <div 
                        key={`${train.train_id || train.train_number}-${train.entry_time}`} 
                        title={`Fixed COA Timetable • Train ${trainNum} ${trainName ? `(${trainName})` : ''} • ${formatTime(s)}–${formatTime(e)} • Protected by COA buffer`} 
                        className={`absolute z-[2] flex h-[16px] cursor-pointer items-center overflow-hidden rounded-[3px] border text-left shadow-xs transition-transform hover:z-10 hover:scale-105 ${isFreight ? 'border-[#64748B] bg-[#F1F5F9] text-[#334155]' : 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'}`} 
                        style={{ left: clamp(left, 0, timelineWidth), top: 9, width: renderedWidth, boxSizing: 'border-box', borderLeft: `2.5px solid ${isFreight ? '#475569' : '#B91C1C'}` }}
                      >
                        <div className="flex h-full w-full min-w-0 items-center gap-0.5 px-1 text-[8px] font-bold leading-none whitespace-nowrap">
                          <Train className={`h-2.5 w-2.5 shrink-0 ${isFreight ? 'text-[#475569]' : 'text-[#B91C1C]'}`} />
                          {showNum && <span className="font-mono font-extrabold truncate">{trainNum}{showFull && trainName ? ` ${trainName.split(' ')[0]}` : ''}</span>}
                          <span className="shrink-0 text-[7px] opacity-60">›</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Maintenance Blocks */}
                  {trackBlocks.map(block => {
                    const s = parseDate(block.start_time), e = parseDate(block.end_time);
                    if (!s || !e) return null;

                    const isOvernight = s.toDateString() !== e.toDateString() || (e.getTime() - s.getTime()) > 86400000;
                    const isCutLeft = s < horizon.start;
                    const isCutRight = e > horizon.end;

                    const left = isCutLeft ? 0 : clamp(position(s) ?? 0, 0, timelineWidth);
                    const width = widthBetween(s, e);
                    if (width <= 1 && !isCutRight && !isCutLeft) return null;

                    const isShared = shared(block);
                    const d = isShared ? 'Consolidated' : dept(block);
                    const color = COLORS[d] || COLORS.Engineering;
                    const selected = selectedId === block.block_id;
                    const critical = String(block.criticality || '').toUpperCase() === 'CRITICAL' || Number(block.ai_priority_score || block.priority_score || 0) >= 90;
                    const jobIds = Array.isArray(block.job_ids) ? block.job_ids : [];
                    const label = jobIds.length > 1 ? `${jobIds.length} jobs (${jobIds.join(' + ')})` : (jobIds[0] || block.block_id);
                    const shortLabel = jobIds.length > 1 ? `${jobIds.length} jobs` : (jobIds[0] || block.block_id);
                    const deptLabel = isShared ? departments(block).join(' + ') : (departments(block)[0] || 'Engineering');

                    // Compute rendered block width with overnight continuation extension in DAY mode
                    let blockWidth = Math.max(16, width - 2);
                    if (isCutRight && view === 'day') {
                      const nextDayMins = (e.getTime() - horizon.end.getTime()) / 60000;
                      const extraPx = Math.min(handoverWidth, (nextDayMins / 120) * handoverWidth);
                      blockWidth = Math.max(100, width + extraPx);
                    } else if (isCutRight) {
                      blockWidth = Math.max(80, width - 2);
                    } else if (isCutLeft) {
                      blockWidth = Math.max(80, width - 2);
                    }

                    // Tooltip text
                    let titleText = `${block.block_id} · ${label} · ${deptLabel} · ${formatTime(s)}–${formatTime(e)}`;
                    if (isOvernight) {
                      titleText = `🌙 OVERNIGHT POSSESSION: ${block.block_id}\nDepartments: ${deptLabel}\nJobs: ${jobIds.join(', ')}\nWindow: ${formatDay(s)} ${formatTime(s)} → ${formatDay(e)} ${formatTime(e)} (${(block.duration_hours || 0).toFixed(1)} hrs total)\n${isCutRight ? 'Notice: Continues across midnight into the next day.' : isCutLeft ? 'Notice: Began on previous night before midnight.' : 'Spans across midnight.'}`;
                    }

                    return (
                      <button 
                        key={block.block_id} 
                        type="button" 
                        onClick={() => handleBlock(block)} 
                        title={titleText} 
                        className={`group absolute z-[3] h-[38px] overflow-hidden rounded border text-left transition-all ${selected ? 'ring-2 ring-[#1E3A5F] ring-offset-1 shadow-md' : 'hover:ring-1 hover:ring-[#1E3A5F]'}`} 
                        style={{
                          left, 
                          top: 30, 
                          width: blockWidth, 
                          boxSizing: 'border-box', 
                          background: isShared ? '#EEE8F7' : `${color}14`, 
                          borderColor: isShared ? COLORS.Consolidated : `${color}55`,
                          borderRight: isCutRight ? `3px dashed ${isShared ? '#6B5B95' : color}` : undefined,
                          borderLeft: isCutLeft ? `3px dashed ${isShared ? '#6B5B95' : color}` : undefined,
                        }}
                      >
                        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
                        {critical && <span className="absolute left-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#C92A2A]" />}
                        
                        <div className="absolute inset-y-0 left-3 right-1 flex flex-col justify-center overflow-hidden pr-1">
                          <div className="flex items-center gap-1 leading-tight">
                            {isOvernight && <span className="text-[9px]">🌙</span>}
                            <span className="truncate text-[9px] font-extrabold text-[#1F2933]">
                              {isCutLeft ? `⬅ ${shortLabel}` : label}
                            </span>
                            {isShared && (
                              <span className="shrink-0 rounded bg-[#6B5B95] px-1 text-[7px] font-extrabold uppercase text-white shadow-2xs">
                                Shared: {deptLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[7px] font-mono font-bold text-[#52606D] mt-0.5">
                            <span>{formatTime(s)}–{formatTime(e)}</span>
                            {isCutRight && <span className="font-sans font-extrabold text-[#1E3A5F]">➔ Spans to {formatDay(e)}</span>}
                            {isCutLeft && <span className="font-sans font-extrabold text-[#1E3A5F]">⬅ From {formatDay(s)}</span>}
                            {block.duration_hours && <span>({Number(block.duration_hours).toFixed(1)}h)</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* TSR Profile */}
                  {showTSR && trackBlocks.map(block => {
                    if (!block.tsr_recovery_profile) return null;
                    let cursor = parseDate(block.end_time);
                    return (block.tsr_recovery_profile.recovery_stages || []).map((stage, i) => {
                      if (!cursor) return null;
                      const ss = new Date(cursor), ee = new Date(cursor.getTime() + Number(stage.duration_hours || 0) * 3600000);
                      cursor = ee;
                      const left = position(ss), width = widthBetween(ss, ee);
                      if (left === null || width <= 1) return null;
                      return (
                        <div 
                          key={`tsr-${block.block_id}-${i}`} 
                          title={`TSR ${stage.max_speed_kmh} km/h`} 
                          className="absolute bottom-1 h-[5px] border border-dashed border-[#F08C00]" 
                          style={{ left, width: Math.max(3, width), background: 'repeating-linear-gradient(135deg, rgba(240,140,0,.35) 0, rgba(240,140,0,.35) 3px, transparent 3px, transparent 6px)' }} 
                        />
                      );
                    });
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </section>;
}

