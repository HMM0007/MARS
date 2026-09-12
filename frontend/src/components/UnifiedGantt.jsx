import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Timeline, { TimelineHeaders, SidebarHeader, DateHeader, CustomMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/dist/style.css';
import moment from 'moment';
import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, RefreshCw, ShieldCheck, TrainFront } from 'lucide-react';
import { fetchWeeklyPlan, fetchCOATimetable } from '../services/api';

const COLORS = {
  Engineering: '#3B6EA5',
  'S&T': '#2F8F6B',
  Traction: '#C9842A',
  Consolidated: '#6B5B95',
  Train: '#B42318',
  TSR: '#F08C00',
  Ink: '#1F2933',
  Slate: '#52606D',
  Border: '#D6DEE6',
};

const TRACK_ORDER = ['PUNE-LNL', 'PUNE-DD', 'LNL-KJT', 'PUNE-MRJ', 'CWD-YARD'];
const deptOf = (block) => (block?.is_consolidated || (block?.departments || []).length > 1)
  ? 'Consolidated'
  : ((block?.departments || [])[0] || 'Engineering');

const fmt = (value, format = 'DD MMM HH:mm') => value ? moment(value).format(format) : '—';

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
  const [anchorDay, setAnchorDay] = useState(null);
  const [visibleTimeStart, setVisibleTimeStart] = useState(null);
  const [visibleTimeEnd, setVisibleTimeEnd] = useState(null);
  const [activeSelectedId, setActiveSelectedId] = useState(selectedBlockId || null);
  const [layers, setLayers] = useState({ work: true, trains: true, tsr: false });
  const [showLegend, setShowLegend] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [planData, trainsData] = await Promise.all([
        fetchWeeklyPlan(),
        fetchCOATimetable().catch(() => []),
      ]);
      setInternalPlan(planData);
      setInternalTrains(Array.isArray(trainsData) ? trainsData : (trainsData?.timetable || []));
    } catch (err) {
      setError(err.message || 'Failed to load weekly plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!propBlocks?.length) loadData();
  }, [propBlocks, loadData]);

  useEffect(() => {
    if (selectedBlockId !== undefined) setActiveSelectedId(selectedBlockId || null);
  }, [selectedBlockId]);

  const scheduledBlocks = useMemo(
    () => propBlocks?.length ? propBlocks : (internalPlan?.blocks || internalPlan?.scheduled_blocks || []),
    [propBlocks, internalPlan]
  );
  const trains = useMemo(() => propTrains?.length ? propTrains : internalTrains, [propTrains, internalTrains]);
  const metrics = internalPlan?.weekly_metrics || internalPlan?.metrics || {};

  const bounds = useMemo(() => {
    const times = scheduledBlocks.flatMap((b) => [moment(b.start_time).valueOf(), moment(b.end_time).valueOf()]).filter(Number.isFinite);
    if (!times.length) {
      const start = moment().startOf('isoWeek');
      return { start, end: start.clone().add(7, 'days') };
    }
    const start = moment(Math.min(...times)).startOf('day');
    return { start, end: start.clone().add(7, 'days') };
  }, [scheduledBlocks]);

  useEffect(() => {
    setAnchorDay(bounds.start.clone());
    setVisibleTimeStart(bounds.start.valueOf());
    setVisibleTimeEnd(bounds.end.valueOf());
  }, [bounds]);

  const setPreset = useCallback((nextView, nextAnchor = anchorDay || bounds.start) => {
    const base = moment(nextAnchor).startOf('day');
    setView(nextView);
    setAnchorDay(base);
    if (nextView === 'week') {
      setVisibleTimeStart(bounds.start.valueOf());
      setVisibleTimeEnd(bounds.end.valueOf());
    } else {
      setVisibleTimeStart(base.valueOf());
      setVisibleTimeEnd(base.clone().add(nextView === 'day' ? 24 : 48, 'hours').valueOf());
    }
  }, [anchorDay, bounds]);

  const shift = (days) => {
    const base = moment(anchorDay || bounds.start).add(days, 'days');
    if (view === 'week') {
      const maxStart = bounds.end.clone().subtract(7, 'days');
      const clamped = base.isAfter(maxStart) ? maxStart : base.isBefore(bounds.start) ? bounds.start : base;
      setAnchorDay(clamped);
      setVisibleTimeStart(bounds.start.valueOf());
      setVisibleTimeEnd(bounds.end.valueOf());
    } else {
      const hours = view === 'day' ? 24 : 48;
      const maxStart = bounds.end.clone().subtract(hours, 'hours');
      const clamped = base.isAfter(maxStart) ? maxStart : base.isBefore(bounds.start) ? bounds.start : base;
      setAnchorDay(clamped);
      setVisibleTimeStart(clamped.valueOf());
      setVisibleTimeEnd(clamped.clone().add(hours, 'hours').valueOf());
    }
  };

  const handleBlockClick = useCallback((block) => {
    if (!block) return;
    setActiveSelectedId(block.block_id);
    onBlockClick?.(block);
    onSelectBlock?.(block);
    onOpenExplainability?.(block);
    if (block.section_id) onSectionSelect?.(block.section_id);
  }, [onBlockClick, onSelectBlock, onOpenExplainability, onSectionSelect]);

  const selectedBlock = useMemo(
    () => scheduledBlocks.find((b) => b.block_id === activeSelectedId) || null,
    [scheduledBlocks, activeSelectedId]
  );

  const groups = useMemo(() => {
    const ids = new Set();
    scheduledBlocks.forEach((b) => b.track_id && ids.add(b.track_id));
    trains.forEach((t) => t.track_id && ids.add(t.track_id));
    return Array.from(ids).sort((a, b) => {
      const ai = TRACK_ORDER.findIndex((x) => a.startsWith(x));
      const bi = TRACK_ORDER.findIndex((x) => b.startsWith(x));
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
    }).map((id) => ({ id, title: id, height: 62 }));
  }, [scheduledBlocks, trains]);

  const items = useMemo(() => {
    const out = [];
    if (layers.work) scheduledBlocks.forEach((block) => {
      const department = deptOf(block);
      const color = COLORS[department] || COLORS.Engineering;
      const consolidated = department === 'Consolidated';
      out.push({
        id: block.block_id,
        group: block.track_id,
        title: block.block_id,
        start_time: moment(block.start_time),
        end_time: moment(block.end_time),
        kind: 'work',
        department,
        itemProps: {
          className: 'mars-gantt-work-item',
          style: { background: color, border: consolidated ? '2px solid #A98CD3' : `1px solid ${color}`, borderRadius: 5 },
        },
      });
      if (layers.tsr && block.tsr_recovery_profile) {
        let start = moment(block.end_time);
        (block.tsr_recovery_profile.recovery_stages || []).forEach((stage, index) => {
          const end = start.clone().add(Number(stage.duration_hours || 0), 'hours');
          out.push({
            id: `tsr-${block.block_id}-${index}`,
            group: block.track_id,
            title: `TSR ${stage.max_speed_kmh} km/h`,
            start_time: start,
            end_time: end,
            kind: 'tsr',
            itemProps: { className: 'mars-gantt-tsr-item' },
          });
          start = end;
        });
      }
    });
    if (layers.trains) trains.forEach((train, index) => out.push({
      id: `train-${train.train_id || train.train_number || index}`,
      group: train.track_id,
      title: train.train_number || train.train_id || 'TRAIN',
      start_time: moment(train.entry_time),
      end_time: moment(train.exit_time),
      kind: 'train',
      itemProps: { className: 'mars-gantt-train-item' },
    }));
    return out;
  }, [scheduledBlocks, trains, layers]);

  const itemRenderer = ({ item, itemContext, getItemProps }) => {
    const width = itemContext?.width || 0;
    const isSelected = item.kind === 'work' && activeSelectedId === item.id;
    if (item.kind === 'train') {
      return <div {...getItemProps({ style: { ...itemContext.style, background: 'transparent', border: 0, boxShadow: 'none' } })} title={`Train ${item.title}`}>
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded bg-[#B42318]" />
        {width > 54 && <span className="absolute left-1 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-[#B42318] px-1 text-[8px] font-bold text-white">{item.title}</span>}
      </div>;
    }
    if (item.kind === 'tsr') {
      return <div {...getItemProps({ style: { ...itemContext.style, background: 'repeating-linear-gradient(135deg, rgba(240,140,0,.82) 0 5px, rgba(240,140,0,.16) 5px 10px)', border: '1px dashed #F08C00', color: COLORS.Ink } })} title={item.title}>
        {width > 48 && <span className="px-1 text-[8px] font-bold">{item.title}</span>}
      </div>;
    }
    const dept = item.department || 'Engineering';
    return <div {...getItemProps({ style: { ...itemContext.style, height: 30, top: 7, padding: 0, overflow: 'hidden', boxShadow: isSelected ? '0 0 0 2px #1E3A5F' : '0 1px 2px rgba(31,41,51,.12)' } })} onClick={() => handleBlockClick(scheduledBlocks.find((b) => b.block_id === item.id))} title={`${item.id} • ${dept}`}>
      <div className="flex h-full min-w-0 items-center px-2 text-[9px] font-bold text-white">
        {width > 82 ? <span className="truncate">{item.id}</span> : width > 30 ? <span className="truncate">{item.id?.replace(/^BLK-/, '')}</span> : null}
      </div>
    </div>;
  };

  if (loading && !scheduledBlocks.length) return <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-[#D6DEE6] bg-white"><div className="text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1E3A5F]"/><p className="mt-2 text-sm font-semibold text-[#1F2933]">Loading weekly schedule…</p><p className="mt-1 text-xs text-[#718294]">Loading approved blocks and train protection data</p></div></div>;
  if (error && !scheduledBlocks.length) return <div className="rounded-lg border border-[#D6DEE6] bg-white p-10 text-center"><p className="text-sm font-bold text-[#C92A2A]">Unable to load weekly schedule</p><p className="mt-1 text-xs text-[#52606D]">{error}</p><button onClick={loadData} className="mt-3 rounded bg-[#1E3A5F] px-3 py-1.5 text-xs font-bold text-white">Retry</button></div>;

  const conflictCount = Number(metrics.active_conflicts ?? 0);
  const consolidatedCount = Number(metrics.consolidated_blocks_count ?? scheduledBlocks.filter((b) => deptOf(b) === 'Consolidated').length);

  return <section className="overflow-hidden rounded-lg border border-[#D6DEE6] bg-white shadow-sm">
    <style>{`
      .mars-gantt .rct-header-root { background:#F8FAFC !important; border-color:#D6DEE6 !important; }
      .mars-gantt .rct-sidebar { background:#FAFBFC; border-color:#D6DEE6 !important; }
      .mars-gantt .rct-sidebar-row { border-color:#E8EDF2 !important; }
      .mars-gantt .rct-horizontal-lines .rct-hl-even, .mars-gantt .rct-horizontal-lines .rct-hl-odd { border-color:#E8EDF2 !important; }
      .mars-gantt .rct-vertical-lines .rct-vl { border-color:#EDF1F5 !important; }
      .mars-gantt .rct-scroll { scrollbar-color:#AAB7C4 #F4F6F8; }
      .mars-gantt .rct-item { cursor:pointer; }
      .mars-gantt .rct-dateHeader { border-color:#D6DEE6 !important; }
    `}</style>
    <div className="border-b border-[#D6DEE6] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-md bg-[#1E3A5F]/10 p-2"><CalendarDays className="h-5 w-5 text-[#1E3A5F]"/></div>
          <div><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Weekly Possession Schedule</h2><p className="text-[10px] text-[#718294]">7-day tactical view • maintenance windows against protected train movements</p></div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => shift(-1)} className="rounded border border-[#D6DEE6] p-1.5 text-[#52606D] hover:bg-[#F4F6F8]" title="Previous period"><ChevronLeft className="h-4 w-4"/></button>
          <button onClick={() => { setView('week'); setAnchorDay(bounds.start.clone()); setVisibleTimeStart(bounds.start.valueOf()); setVisibleTimeEnd(bounds.end.valueOf()); }} className="rounded border border-[#D6DEE6] px-2.5 py-1.5 text-[10px] font-bold text-[#1E3A5F] hover:bg-[#F4F6F8]">Full Week</button>
          <button onClick={() => shift(1)} className="rounded border border-[#D6DEE6] p-1.5 text-[#52606D] hover:bg-[#F4F6F8]" title="Next period"><ChevronRight className="h-4 w-4"/></button>
          <div className="ml-1 flex overflow-hidden rounded border border-[#D6DEE6]">
            {['day','48h','week'].map((v) => <button key={v} onClick={() => setPreset(v, anchorDay || bounds.start)} className={`px-2.5 py-1.5 text-[9px] font-bold uppercase ${view === v ? 'bg-[#1E3A5F] text-white' : 'bg-white text-[#52606D] hover:bg-[#F4F6F8]'}`}>{v === '48h' ? '48 H' : v}</button>)}
          </div>
          <button onClick={loadData} disabled={loading} className="rounded border border-[#D6DEE6] p-1.5 text-[#1E3A5F] hover:bg-[#F4F6F8] disabled:opacity-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF1F5] pt-2.5">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-[#718294]">
          <span>{fmt(visibleTimeStart, 'DD MMM YYYY')} — {fmt(visibleTimeEnd, 'DD MMM YYYY')}</span><span className="text-[#D6DEE6]">|</span><span>{scheduledBlocks.length} blocks</span><span className={conflictCount ? 'text-[#C92A2A]' : 'text-[#2F9E44]'}>{conflictCount ? `${conflictCount} conflicts` : 'No conflicts'}</span><span className="text-[#6B5B95]">{consolidatedCount} shared</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setLayers((x) => ({ ...x, work: !x.work }))} className={`flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold ${layers.work ? 'border-[#1E3A5F]/30 bg-[#1E3A5F]/10 text-[#1E3A5F]' : 'border-[#D6DEE6] text-[#718294]'}`}>{layers.work ? <Eye className="h-3 w-3"/> : <EyeOff className="h-3 w-3"/>} Work</button>
          <button onClick={() => setLayers((x) => ({ ...x, trains: !x.trains }))} className={`flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold ${layers.trains ? 'border-[#B42318]/30 bg-[#B42318]/5 text-[#B42318]' : 'border-[#D6DEE6] text-[#718294]'}`}><TrainFront className="h-3 w-3"/> Trains</button>
          <button onClick={() => setLayers((x) => ({ ...x, tsr: !x.tsr }))} className={`flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold ${layers.tsr ? 'border-[#F08C00]/40 bg-[#F08C00]/10 text-[#A76614]' : 'border-[#D6DEE6] text-[#718294]'}`}><ShieldCheck className="h-3 w-3"/> TSR</button>
          <button onClick={() => setShowLegend((x) => !x)} className="flex items-center gap-1 rounded border border-[#D6DEE6] px-2 py-1 text-[9px] font-bold text-[#52606D]">{showLegend ? <EyeOff className="h-3 w-3"/> : <Eye className="h-3 w-3"/>} Legend</button>
        </div>
      </div>
    </div>

    {showLegend && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#D6DEE6] bg-[#FAFBFC] px-4 py-2 text-[9px] font-semibold text-[#52606D]">
      {['Engineering','S&T','Traction','Consolidated'].map((d) => <span key={d} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[d] }}/>{d}</span>)}
      <span className="ml-2 flex items-center gap-1.5"><i className="h-[3px] w-4 rounded bg-[#B42318]"/> Protected train</span><span className="flex items-center gap-1.5"><i className="h-2 w-4 border border-dashed border-[#F08C00] bg-[#F08C00]/20"/> TSR</span>
      <span className="ml-auto text-[#718294]">Click a possession to inspect its decision</span>
    </div>}

    <div className="mars-gantt h-[610px] overflow-hidden">
      {scheduledBlocks.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-[#52606D]">No scheduled blocks for this week.</div> : <Timeline
        groups={groups}
        items={items}
        defaultTimeStart={bounds.start}
        defaultTimeEnd={bounds.end}
        visibleTimeStart={visibleTimeStart}
        visibleTimeEnd={visibleTimeEnd}
        onTimeChange={(start, end) => { setVisibleTimeStart(start); setVisibleTimeEnd(end); }}
        canMove={false}
        canResize={false}
        canChangeGroup={false}
        lineHeight={62}
        itemHeightRatio={0.52}
        sidebarWidth={190}
        stackItems={false}
        minZoom={60 * 60 * 1000}
        maxZoom={30 * 24 * 60 * 60 * 1000}
        itemRenderer={itemRenderer}
        onItemSelect={(id) => { const b = scheduledBlocks.find((x) => x.block_id === id); if (b) handleBlockClick(b); }}
      >
        <TimelineHeaders>
          <SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} className="flex h-full items-center border-r border-[#D6DEE6] bg-[#F8FAFC] px-3 text-[9px] font-black uppercase tracking-wider text-[#52606D]">Track / Line</div>}</SidebarHeader>
          <DateHeader unit="day" labelFormat="ddd DD MMM" style={{ height: 34, fontSize: 10, fontWeight: 800, color: COLORS.Ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
          <DateHeader unit="hour" labelFormat="HH:mm" style={{ height: 25, fontSize: 8, color: COLORS.Slate, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
        </TimelineHeaders>
        {moment().isBetween(bounds.start, bounds.end, undefined, '[)') && <CustomMarker date={moment().valueOf()}>{({ styles }) => <div style={styles} className="z-20 border-l-2 border-[#C92A2A]"><span className="absolute -left-3 -top-5 rounded bg-[#C92A2A] px-1.5 py-0.5 text-[8px] font-black text-white">NOW</span></div>}</CustomMarker>}
      </Timeline>}
    </div>

    <div className="flex items-center justify-between border-t border-[#D6DEE6] bg-[#FAFBFC] px-4 py-2 text-[9px] text-[#718294]">
      <div><span className="font-bold text-[#52606D]">Planner view:</span> drag timeline horizontally to inspect a window • click a block for details</div>
      {selectedBlock && <div className="flex items-center gap-2"><span className="font-mono font-bold text-[#1E3A5F]">{selectedBlock.block_id}</span><span>{selectedBlock.track_id}</span><span>{fmt(selectedBlock.start_time, 'DD MMM HH:mm')}–{fmt(selectedBlock.end_time, 'HH:mm')}</span></div>}
    </div>
  </section>;
}
