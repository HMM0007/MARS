import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter, Info, RefreshCw, ShieldCheck, Train, X, ZoomIn, ZoomOut } from 'lucide-react';
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

const trackLabel = (trackId = '') => {
  const parts = trackId.split('-');
  if (parts.length >= 3) {
    const corridor = `${parts[0]} – ${parts[1]}`;
    const suffix = parts.slice(2).join('-');
    if (suffix === 'UP') return `${corridor} · UP`;
    if (suffix === 'DN') return `${corridor} · DN`;
    if (suffix === 'LOOP') return `${corridor} · LOOP`;
  }
  return trackId.replaceAll('-', ' – ');
};

const deptForBlock = (block) => {
  const depts = block?.departments || [];
  if (block?.is_consolidated || depts.length > 1) return 'Consolidated';
  return depts[0] || 'Engineering';
};

const parseDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const formatDay = (date) => date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
const formatTime = (date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
const sameDay = (a, b) => a.toDateString() === b.toDateString();

export default function UnifiedGantt({
  blocks: propBlocks,
  trains: propTrains,
  onBlockClick,
  onSectionSelect,
  onSelectBlock,
  selectedBlockId,
  currentRole,
  onOpenExplainability,
}) {
  const [internalPlan, setInternalPlan] = useState(null);
  const [internalTrains, setInternalTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('week');
  const [dayOffset, setDayOffset] = useState(0);
  const [density, setDensity] = useState('standard');
  const [showTrains, setShowTrains] = useState(true);
  const [showTSR, setShowTSR] = useState(false);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTrack, setSelectedTrack] = useState('ALL');
  const [selectedId, setSelectedId] = useState(selectedBlockId || null);
  const [showLayers, setShowLayers] = useState(false);
  const timelineRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [plan, timetable] = await Promise.all([
        fetchWeeklyPlan(),
        fetchCOATimetable().catch(() => []),
      ]);
      setInternalPlan(plan);
      setInternalTrains(timetable || []);
    } catch (err) {
      console.error('Unified Gantt load error:', err);
      setError(err.message || 'Unable to load weekly plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!propBlocks || propBlocks.length === 0) loadData();
  }, [propBlocks, loadData]);

  useEffect(() => {
    if (selectedBlockId !== undefined) setSelectedId(selectedBlockId);
  }, [selectedBlockId]);

  const blocks = useMemo(() => {
    if (propBlocks && propBlocks.length) return propBlocks;
    return internalPlan?.scheduled_blocks || internalPlan?.blocks || [];
  }, [propBlocks, internalPlan]);

  const trains = useMemo(() => {
    if (propTrains && propTrains.length) return propTrains;
    return internalTrains || [];
  }, [propTrains, internalTrains]);

  const baseWeekStart = useMemo(() => {
    const first = blocks.map((b) => parseDate(b.start_time)).filter(Boolean).sort((a, b) => a - b)[0];
    if (!first) return startOfDay(new Date());
    const monday = startOfDay(first);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    return monday;
  }, [blocks]);

  const horizon = useMemo(() => {
    const days = view === 'day' ? 1 : view === '48h' ? 2 : 7;
    return { start: addDays(baseWeekStart, dayOffset), end: addDays(baseWeekStart, dayOffset + days), days };
  }, [baseWeekStart, dayOffset, view]);

  const days = useMemo(() => Array.from({ length: horizon.days }, (_, i) => addDays(horizon.start, i)), [horizon]);
  const dayWidth = DAY_WIDTHS[density];
  const timelineWidth = dayWidth * horizon.days;
  const selectedBlock = blocks.find((b) => b.block_id === selectedId) || null;

  const tracks = useMemo(() => {
    const ids = new Set();
    blocks.forEach((b) => b.track_id && ids.add(b.track_id));
    if (showTrains) trains.forEach((t) => t.track_id && ids.add(t.track_id));
    return Array.from(ids).sort((a, b) => {
      const pa = TRACK_ORDER.findIndex((prefix) => a.startsWith(prefix));
      const pb = TRACK_ORDER.findIndex((prefix) => b.startsWith(prefix));
      return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb) || a.localeCompare(b);
    });
  }, [blocks, trains, showTrains]);

  const filteredBlocks = useMemo(() => blocks.filter((block) => {
    const dept = deptForBlock(block);
    const deptMatch = selectedDept === 'ALL' || dept === selectedDept || (selectedDept === 'Shared' && dept === 'Consolidated');
    const trackMatch = selectedTrack === 'ALL' || block.track_id === selectedTrack;
    const start = parseDate(block.start_time);
    const end = parseDate(block.end_time);
    const intersects = start && end && end > horizon.start && start < horizon.end;
    return deptMatch && trackMatch && intersects;
  }), [blocks, selectedDept, selectedTrack, horizon]);

  const filteredTracks = useMemo(() => tracks.filter((track) => filteredBlocks.some((b) => b.track_id === track) || (showTrains && trains.some((t) => t.track_id === track && parseDate(t.entry_time) < horizon.end && parseDate(t.exit_time) > horizon.start))), [tracks, filteredBlocks, trains, showTrains, horizon]);

  const rangeText = `${formatDay(horizon.start)} — ${formatDay(addDays(horizon.end, -1))}`;

  const position = useCallback((value) => {
    const date = parseDate(value);
    if (!date) return null;
    const total = horizon.end.getTime() - horizon.start.getTime();
    return ((date.getTime() - horizon.start.getTime()) / total) * timelineWidth;
  }, [horizon, timelineWidth]);

  const widthBetween = useCallback((start, end) => {
    const a = parseDate(start);
    const b = parseDate(end);
    if (!a || !b) return 0;
    const left = Math.max(a.getTime(), horizon.start.getTime());
    const right = Math.min(b.getTime(), horizon.end.getTime());
    return Math.max(0, ((right - left) / (horizon.end.getTime() - horizon.start.getTime())) * timelineWidth);
  }, [horizon, timelineWidth]);

  const handleBlock = useCallback((block) => {
    setSelectedId(block.block_id);
    onBlockClick?.(block);
    onSelectBlock?.(block);
    onOpenExplainability?.(block);
    if (block.section_id) onSectionSelect?.(block.section_id);
  }, [onBlockClick, onSelectBlock, onOpenExplainability, onSectionSelect]);

  const resetWeek = () => {
    setView('week');
    setDayOffset(0);
    setDensity('standard');
    requestAnimationFrame(() => { if (timelineRef.current) timelineRef.current.scrollLeft = 0; });
  };

  const navigateWindow = (delta) => {
    const step = view === 'day' ? 1 : view === '48h' ? 2 : 7;
    setDayOffset((current) => current + delta * step);
  };

  const now = new Date();
  const nowPosition = now >= horizon.start && now <= horizon.end ? position(now) : null;

  if (loading && blocks.length === 0) {
    return <div className="rounded-lg border border-[#D6DEE6] bg-white p-12 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1E3A5F]" /><p className="mt-3 text-sm font-semibold text-[#1F2933]">Loading weekly possession plan…</p><p className="mt-1 text-xs text-[#52606D]">Preparing maintenance windows against the operating timetable.</p></div>;
  }

  if (error && blocks.length === 0) {
    return <div className="rounded-lg border border-[#D6DEE6] bg-white p-10 text-center"><p className="text-sm font-semibold text-[#C92A2A]">Weekly plan unavailable</p><p className="mt-1 text-xs text-[#52606D]">{error}</p><button onClick={loadData} className="mt-3 rounded bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white">Retry</button></div>;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#C9D4DF] bg-white shadow-sm" aria-label="Weekly possession schedule">
      {/* Planner command strip */}
      <div className="border-b border-[#D6DEE6] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#EAF0F6]"><Calendar className="h-4 w-4 text-[#1E3A5F]" /></div>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#1E3A5F]">Weekly Possession Schedule</h2>
                <p className="text-[11px] text-[#52606D]">7-day tactical view · maintenance windows against protected train movements</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button title="Previous window" onClick={() => navigateWindow(-1)} className="rounded border border-[#D6DEE6] bg-white p-2 text-[#52606D] hover:bg-[#F4F6F8]"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={resetWeek} className="rounded border border-[#D6DEE6] bg-white px-3 py-2 text-[11px] font-bold text-[#1E3A5F] hover:bg-[#F4F6F8]">Full Week</button>
            <button title="Next window" onClick={() => navigateWindow(1)} className="rounded border border-[#D6DEE6] bg-white p-2 text-[#52606D] hover:bg-[#F4F6F8]"><ChevronRight className="h-4 w-4" /></button>
            <div className="ml-1 flex overflow-hidden rounded border border-[#D6DEE6]">
              {['day', '48h', 'week'].map((mode) => <button key={mode} onClick={() => { setView(mode); setDayOffset(0); }} className={`px-2.5 py-2 text-[10px] font-extrabold uppercase ${view === mode ? 'bg-[#1E3A5F] text-white' : 'bg-white text-[#52606D] hover:bg-[#F4F6F8]'}`}>{mode === '48h' ? '48 H' : mode}</button>)}
            </div>
            <button title="Refresh plan" onClick={loadData} disabled={loading} className="ml-1 rounded border border-[#D6DEE6] bg-white p-2 text-[#1E3A5F] hover:bg-[#F4F6F8] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F6] pt-2.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#52606D]">
            <span>{rangeText}</span><span className="text-[#D6DEE6]">|</span><span>{filteredBlocks.length} possessions</span><span className="text-[#D6DEE6]">|</span><span>{trains.length} train movements protected</span>
          </div>
          <div className="flex items-center gap-1.5">
            {['ALL', 'Engineering', 'S&T', 'Traction', 'Shared'].map((dept) => <button key={dept} onClick={() => setSelectedDept(dept)} className={`rounded border px-2.5 py-1.5 text-[10px] font-bold ${selectedDept === dept ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-[#D6DEE6] bg-white text-[#52606D] hover:bg-[#F4F6F8]'}`}>{dept === 'ALL' ? 'All work' : dept}</button>)}
            <select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)} className="ml-1 rounded border border-[#D6DEE6] bg-white px-2 py-1.5 text-[10px] font-semibold text-[#52606D]"><option value="ALL">All tracks</option>{tracks.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select>
            <div className="relative ml-1">
              <button onClick={() => setShowLayers((v) => !v)} className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-bold ${showLayers ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-[#D6DEE6] bg-white text-[#52606D]'}`}><Filter className="h-3 w-3" /> Layers</button>
              {showLayers && <div className="absolute right-0 top-9 z-30 w-48 rounded-md border border-[#D6DEE6] bg-white p-2.5 shadow-lg">
                <p className="mb-2 border-b border-[#EEF2F6] pb-2 text-[10px] font-extrabold uppercase tracking-wide text-[#52606D]">Display layers</p>
                <label className="flex cursor-pointer items-center justify-between py-1.5 text-xs text-[#1F2933]"><span className="flex items-center gap-2"><Train className="h-3.5 w-3.5 text-[#B42318]" /> Protected trains</span><input type="checkbox" checked={showTrains} onChange={(e) => setShowTrains(e.target.checked)} /></label>
                <label className="flex cursor-pointer items-center justify-between border-t border-[#EEF2F6] py-1.5 text-xs text-[#1F2933]"><span className="flex items-center gap-2"><span className="h-2.5 w-3.5 border border-dashed border-[#F08C00]" /> TSR zones</span><input type="checkbox" checked={showTSR} onChange={(e) => setShowTSR(e.target.checked)} /></label>
              </div>}
            </div>
          </div>
        </div>
      </div>

      {/* Focus / density controls */}
      <div className="flex items-center justify-between border-b border-[#D6DEE6] bg-[#F8FAFC] px-4 py-2">
        <div className="flex items-center gap-4 text-[10px] text-[#52606D]">
          <span><b className="text-[#1F2933]">Read:</b> left = track · right = time</span>
          <span><b className="text-[#1F2933]">Click:</b> possession for decision details</span>
          {nowPosition !== null && <span className="font-bold text-[#C92A2A]">● NOW {formatTime(now)}</span>}
        </div>
        <div className="flex items-center gap-1 rounded border border-[#D6DEE6] bg-white p-0.5">
          <button title="More detail" onClick={() => setDensity((d) => d === 'compact' ? 'standard' : 'detail')} className="p-1 text-[#52606D] hover:bg-[#F4F6F8]"><ZoomIn className="h-3.5 w-3.5" /></button>
          <span className="px-1 text-[9px] font-bold uppercase text-[#52606D]">Density</span>
          <button title="More compact" onClick={() => setDensity((d) => d === 'detail' ? 'standard' : 'compact')} className="p-1 text-[#52606D] hover:bg-[#F4F6F8]"><ZoomOut className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Gantt board */}
      <div className="flex min-h-[610px] max-h-[720px] overflow-hidden">
        <div className="w-[220px] shrink-0 border-r border-[#CBD5E1] bg-white">
          <div className="flex h-[64px] items-end border-b border-[#CBD5E1] bg-[#F8FAFC] px-4 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#52606D]">Track / line</div>
          <div>
            {filteredTracks.map((track) => <div key={track} className="flex h-[64px] items-center border-b border-[#E2E8F0] px-4"><div className="min-w-0"><div className="truncate text-[11px] font-extrabold text-[#1F2933]">{trackLabel(track)}</div><div className="mt-0.5 truncate font-mono text-[9px] text-[#7B8794]">{track}</div></div></div>)}
            {filteredTracks.length === 0 && <div className="p-5 text-xs text-[#52606D]">No track matches this view.</div>}
          </div>
        </div>

        <div ref={timelineRef} className="relative flex-1 overflow-auto bg-white">
          <div style={{ width: timelineWidth, minWidth: '100%' }}>
            <div className="sticky top-0 z-20 h-[64px] border-b border-[#CBD5E1] bg-white">
              <div className="absolute inset-0 flex">
                {days.map((day) => <div key={day.toISOString()} style={{ width: dayWidth }} className="shrink-0 border-r border-[#CBD5E1] bg-[#F8FAFC]">
                  <div className="flex h-[34px] items-center border-b border-[#E2E8F0] px-3"><span className="text-[11px] font-extrabold uppercase text-[#1F2933]">{formatDay(day)}</span></div>
                  <div className="grid h-[30px] grid-cols-6 text-[8px] font-semibold text-[#7B8794]">{[0,4,8,12,16,20].map((h) => <span key={h} className="flex items-center border-r border-[#EEF2F6] pl-1.5">{String(h).padStart(2,'0')}:00</span>)}</div>
                </div>)}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 pointer-events-none">
                {days.map((day, i) => <div key={day.toISOString()} style={{ left: i * dayWidth, width: dayWidth }} className={`absolute top-0 bottom-0 border-r border-[#D6DEE6] ${i % 2 ? 'bg-[#FBFCFD]' : 'bg-white'}`}>
                  {[1,2,3,4,5].map((n) => <span key={n} style={{ left: `${(n / 6) * 100}%` }} className="absolute top-0 bottom-0 border-l border-[#F0F3F6]" />)}
                </div>)}
              </div>

              {filteredTracks.map((track) => {
                const trackBlocks = filteredBlocks.filter((b) => b.track_id === track);
                const trackTrains = showTrains ? trains.filter((t) => t.track_id === track && parseDate(t.entry_time) < horizon.end && parseDate(t.exit_time) > horizon.start) : [];
                return <div key={track} className="relative h-[64px] border-b border-[#E2E8F0]">
                  {/* Protected train traffic: deliberately subtle */}
                  {trackTrains.map((train) => {
                    const left = position(train.entry_time);
                    const width = widthBetween(train.entry_time, train.exit_time);
                    if (left === null || width <= 0) return null;
                    return <div key={`train-${train.train_id || train.train_number}-${track}-${train.entry_time}`} title={`Protected train ${train.train_number || train.train_id || ''}`} className="absolute top-[11px] h-[2px] rounded bg-[#B42318] opacity-65" style={{ left: clamp(left, 0, timelineWidth), width: Math.max(2, width) }}><span className="absolute -left-0.5 -top-0.5 h-1 w-1 rounded-full bg-[#B42318]" /></div>;
                  })}

                  {/* Maintenance possessions */}
                  {trackBlocks.map((block) => {
                    const start = parseDate(block.start_time);
                    const end = parseDate(block.end_time);
                    if (!start || !end) return null;
                    const left = clamp(position(start) ?? 0, 0, timelineWidth);
                    const width = widthBetween(start, end);
                    if (width <= 1) return null;
                    const dept = deptForBlock(block);
                    const color = COLORS[dept] || COLORS.Engineering;
                    const selected = selectedId === block.block_id;
                    const critical = String(block.criticality || '').toUpperCase() === 'CRITICAL' || Number(block.ai_priority_score || block.priority_score || 0) >= 90;
                    const label = block.job_ids?.length > 1 ? `${block.job_ids.length} jobs` : (block.job_ids?.[0] || block.block_id);
                    const showLabel = width >= 85;
                    return <button key={block.block_id} type="button" onClick={() => handleBlock(block)} title={`${block.block_id} · ${label} · ${dept} · ${formatTime(start)}–${formatTime(end)}`} className={`group absolute top-[23px] h-[31px] overflow-hidden rounded border text-left transition-shadow ${selected ? 'z-10 ring-2 ring-[#1E3A5F] ring-offset-1' : 'hover:z-10 hover:ring-1 hover:ring-[#1E3A5F]'}`} style={{ left, width: Math.max(18, width), background: `${color}14`, borderColor: `${color}55` }}>
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
                      {critical && <span className="absolute left-2 top-1.5 h-2 w-2 rounded-full bg-[#C92A2A]" title="Critical priority" />}
                      {showLabel && <span className="absolute inset-y-0 left-4 right-1 flex items-center gap-1 truncate pr-1 text-[9px] font-extrabold text-[#1F2933]"><span className="truncate">{label}</span>{dept === 'Consolidated' && <span className="shrink-0 rounded bg-[#6B5B95] px-1 text-[7px] font-bold text-white">SHARED</span>}</span>}
                      {showLabel && width >= 150 && <span className="absolute bottom-0.5 right-1 text-[7px] font-mono font-bold text-[#52606D]">{formatTime(start)}–{formatTime(end)}</span>}
                    </button>;
                  })}

                  {/* TSR is intentionally secondary and opt-in */}
                  {showTSR && trackBlocks.map((block) => {
                    if (!block.tsr_recovery_profile) return null;
                    const stages = block.tsr_recovery_profile.recovery_stages || [];
                    let cursor = parseDate(block.end_time);
                    return stages.map((stage, idx) => {
                      if (!cursor) return null;
                      const stageStart = new Date(cursor);
                      const stageEnd = new Date(cursor.getTime() + Number(stage.duration_hours || 0) * 3600000);
                      cursor = stageEnd;
                      const left = position(stageStart);
                      const width = widthBetween(stageStart, stageEnd);
                      if (left === null || width <= 1) return null;
                      return <div key={`tsr-${block.block_id}-${idx}`} title={`TSR ${stage.max_speed_kmh} km/h`} className="absolute bottom-[2px] h-[5px] border border-dashed border-[#F08C00] opacity-80" style={{ left, width: Math.max(3, width), background: 'repeating-linear-gradient(135deg, rgba(240,140,0,.35) 0, rgba(240,140,0,.35) 3px, transparent 3px, transparent 6px)' }} />;
                    });
                  })}
                </div>;
              })}

              {nowPosition !== null && <div className="pointer-events-none absolute top-0 bottom-0 z-15 w-px bg-[#C92A2A]" style={{ left: nowPosition }}><span className="absolute -left-3 -top-1 rounded bg-[#C92A2A] px-1 py-0.5 text-[7px] font-bold text-white">NOW</span></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Compact legend / selection footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D6DEE6] bg-[#F8FAFC] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-[9px] font-semibold text-[#52606D]">
          {['Engineering', 'S&T', 'Traction', 'Consolidated'].map((dept) => <span key={dept} className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[dept] }} />{dept === 'Consolidated' ? 'Shared possession' : dept}</span>)}
          <span className="flex items-center gap-1"><i className="h-[2px] w-4 bg-[#B42318]" />Protected train</span>
          <span className="text-[#7B8794]">Red dot on a possession = critical priority</span>
        </div>
        {selectedBlock && <div className="flex items-center gap-2 rounded border border-[#C9D4DF] bg-white px-2.5 py-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#2F9E44]" /><span className="font-mono text-[9px] font-bold text-[#1E3A5F]">{selectedBlock.block_id}</span><span className="text-[9px] text-[#52606D]">{formatTime(parseDate(selectedBlock.start_time))}–{formatTime(parseDate(selectedBlock.end_time))}</span><button onClick={() => setSelectedId(null)} className="text-[#7B8794] hover:text-[#1F2933]"><X className="h-3 w-3" /></button></div>}
      </div>
    </section>
  );
}
