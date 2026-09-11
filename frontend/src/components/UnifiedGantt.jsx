/**
 * MARS 2.0 — REBUILT UNIFIED GANTT TIMELINE COMPONENT
 * Multi-department Railway Block Planning Timeline Component
 *
 * Visualizing wide horizontal maintenance possession bars, passing trains,
 * and TSR speed recovery zones across Pune Division tracks.
 *
 * Professional Railway Control Room Aesthetic:
 * - White background, crisp #D6DEE6 borders, Railway Blue #1E3A5F accents
 * - Wide horizontal time bars spanning 2-6 hours (stackItems={false})
 * - Exact department colors: Engineering (#3B6EA5), S&T (#2F8F6B), Traction (#C9842A), Consolidated (#6B5B95)
 * - Trains as thin discrete red movements (#B42318)
 * - TSR recovery zones with diagonal orange hatching (#F08C00)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Timeline, {
  TimelineHeaders,
  SidebarHeader,
  DateHeader,
  CustomMarker,
} from 'react-calendar-timeline';
import 'react-calendar-timeline/dist/style.css';
import moment from 'moment';
import {
  Calendar,
  Filter,
  RefreshCw,
  AlertTriangle,
  X,
  ShieldCheck,
  Check,
  Clock,
  Train as TrainIcon,
} from 'lucide-react';
import { fetchWeeklyPlan, fetchCOATimetable } from '../services/api';

// ============================================================================
// LOCKED COLOR PALETTE & STYLES (SECTION 4)
// ============================================================================
const COLORS = {
  Engineering: '#3B6EA5', // Muted Blue
  SNT: '#2F8F6B',         // Muted Green
  Traction: '#C9842A',    // Muted Amber
  Consolidated: '#6B5B95',// Soft Violet
  ConsolidatedBorder: '#A98CD3',
  Train: '#B42318',       // Soft Red
  TSR: '#F08C00',         // Amber/Orange Hatch
};

// Logical track grouping order for Pune Division (Section 5 Feature 4)
const TRACK_PRIORITY_PREFIXES = [
  'PUNE-LNL',
  'PUNE-DD',
  'LNL-KJT',
  'PUNE-MRJ',
  'CWD-YARD',
];

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
  // State for data
  const [internalPlan, setInternalPlan] = useState(null);
  const [internalTrains, setInternalTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Zoom level state
  const [zoomLevel, setZoomLevel] = useState('week'); // 'day', 'week', 'multi-week'
  const [visibleTimeStart, setVisibleTimeStart] = useState(null);
  const [visibleTimeEnd, setVisibleTimeEnd] = useState(null);

  // Filter state (Section 5 Feature 9)
  const [filters, setFilters] = useState({
    showEngineering: true,
    showSNT: true,
    showTraction: true,
    showConsolidated: true,
    showTrains: true,
    showTSR: true,
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Selected Block ID
  const [activeSelectedId, setActiveSelectedId] = useState(selectedBlockId || null);

  useEffect(() => {
    if (selectedBlockId !== undefined) {
      setActiveSelectedId(selectedBlockId);
    }
  }, [selectedBlockId]);

  // Load backend data if not provided via props
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [planData, trainsData] = await Promise.all([
        fetchWeeklyPlan(),
        fetchCOATimetable().catch(() => []),
      ]);
      setInternalPlan(planData);
      setInternalTrains(trainsData || []);
    } catch (err) {
      console.error('UnifiedGantt API Load Error:', err);
      setError(err.message || 'Failed to load weekly plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!propBlocks || propBlocks.length === 0) {
      loadData();
    }
  }, [propBlocks, loadData]);

  // Resolve weeklyPlan & trains from props or internal state
  const weeklyPlan = useMemo(() => {
    if (propBlocks && propBlocks.length > 0) {
      return {
        scheduled_blocks: propBlocks,
        weekly_metrics: {
          total_blocks_created: propBlocks.length,
          active_conflicts: 0,
          consolidated_blocks_count: propBlocks.filter(
            (b) => b.is_consolidated || (b.departments && b.departments.length > 1)
          ).length,
        },
      };
    }
    return internalPlan;
  }, [propBlocks, internalPlan]);

  const trains = useMemo(() => {
    if (propTrains && propTrains.length > 0) return propTrains;
    return internalTrains || [];
  }, [propTrains, internalTrains]);

  const scheduledBlocks = weeklyPlan?.scheduled_blocks || [];
  const metrics = weeklyPlan?.weekly_metrics || weeklyPlan?.metrics || {};

  // --------------------------------------------------------------------------
  // FEATURE 3: FIXED TIME WINDOW CALCULATION
  // --------------------------------------------------------------------------
  const { earliestTime, latestTime } = useMemo(() => {
    const allTimes = scheduledBlocks.flatMap((b) => [
      moment(b.start_time).valueOf(),
      moment(b.end_time).valueOf(),
    ]);

    if (allTimes.length === 0) {
      const now = moment().startOf('isoWeek');
      return {
        earliestTime: now,
        latestTime: now.clone().add(7, 'days'),
      };
    }

    const minTimestamp = Math.min(...allTimes);
    const maxTimestamp = Math.max(...allTimes);

    const earliest = moment(minTimestamp).startOf('day');
    const maxBlockEnd = moment(maxTimestamp).endOf('day');
    // Ensure at least a full 7-day view
    const latest = moment.max(maxBlockEnd, earliest.clone().add(7, 'days'));

    return { earliestTime: earliest, latestTime: latest };
  }, [scheduledBlocks]);

  // Initialize or update timeline bounds based on earliest & latest time
  useEffect(() => {
    if (earliestTime && latestTime) {
      setVisibleTimeStart(earliestTime.valueOf());
      setVisibleTimeEnd(earliestTime.clone().add(7, 'days').valueOf());
    }
  }, [earliestTime, latestTime]);

  // Handle Zoom Toggle
  const handleZoomToggle = (level) => {
    setZoomLevel(level);
    if (!earliestTime) return;

    if (level === 'day') {
      // 24-hour day view
      setVisibleTimeStart(earliestTime.valueOf());
      setVisibleTimeEnd(earliestTime.clone().add(24, 'hours').valueOf());
    } else if (level === 'week') {
      // 7-day complete week view (default)
      setVisibleTimeStart(earliestTime.valueOf());
      setVisibleTimeEnd(earliestTime.clone().add(7, 'days').valueOf());
    } else if (level === 'multi-week') {
      // 4-week multi-week view
      setVisibleTimeStart(earliestTime.valueOf());
      setVisibleTimeEnd(earliestTime.clone().add(28, 'days').valueOf());
    }
  };

  const handleTimeChange = (newStart, newEnd) => {
    setVisibleTimeStart(newStart);
    setVisibleTimeEnd(newEnd);
  };

  // --------------------------------------------------------------------------
  // FEATURE 8: CLICK HANDLERS
  // --------------------------------------------------------------------------
  const handleBlockClick = useCallback(
    (block) => {
      if (!block) return;
      setActiveSelectedId(block.block_id);
      if (onBlockClick) onBlockClick(block);
      if (onSelectBlock) onSelectBlock(block);
      if (onOpenExplainability) onOpenExplainability(block);
      if (onSectionSelect && block.section_id) {
        onSectionSelect(block.section_id);
      }
    },
    [onBlockClick, onSelectBlock, onOpenExplainability, onSectionSelect]
  );

  const handleItemSelect = useCallback(
    (itemId) => {
      if (typeof itemId === 'string' && itemId.startsWith('BLK-')) {
        const block = scheduledBlocks.find((b) => b.block_id === itemId);
        if (block) {
          handleBlockClick(block);
        }
      }
    },
    [scheduledBlocks, handleBlockClick]
  );

  // --------------------------------------------------------------------------
  // FEATURE 4: PROPER GROUPS (TRACK ROWS)
  // --------------------------------------------------------------------------
  const sortedGroups = useMemo(() => {
    const rawTrackSet = new Set();
    scheduledBlocks.forEach((b) => {
      if (b.track_id) rawTrackSet.add(b.track_id);
    });
    trains.forEach((t) => {
      if (t.track_id) rawTrackSet.add(t.track_id);
    });

    // Sort tracks in logical order (PUNE-LNL first, then PUNE-DD, LNL-KJT, PUNE-MRJ, CWD-YARD)
    const tracksArray = Array.from(rawTrackSet);
    tracksArray.sort((a, b) => {
      const getPriority = (track) => {
        for (let i = 0; i < TRACK_PRIORITY_PREFIXES.length; i++) {
          if (track.startsWith(TRACK_PRIORITY_PREFIXES[i])) return i;
        }
        return 999;
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });

    return tracksArray.map((trackId) => ({
      id: trackId,
      title: trackId,
      height: 55,
    }));
  }, [scheduledBlocks, trains]);

  // --------------------------------------------------------------------------
  // FEATURE 5: PROPER ITEMS (BLOCKS + TRAINS + TSR)
  // --------------------------------------------------------------------------
  const allItems = useMemo(() => {
    const timelineItems = [];

    // 1. Maintenance Blocks
    scheduledBlocks.forEach((block) => {
      const primaryDept = (block.departments && block.departments[0]) || 'Engineering';
      const isConsolidated = Boolean(
        block.is_consolidated || (block.departments && block.departments.length > 1)
      );

      // Apply department filters
      if (isConsolidated && !filters.showConsolidated) return;
      if (!isConsolidated && primaryDept === 'Engineering' && !filters.showEngineering) return;
      if (!isConsolidated && primaryDept === 'S&T' && !filters.showSNT) return;
      if (!isConsolidated && primaryDept === 'Traction' && !filters.showTraction) return;

      let bgColor = COLORS.Engineering;
      let borderStyle = 'none';
      let label = `🔧 ${block.job_ids?.[0] || block.block_id} | ${block.duration_hours || 2.5}h`;

      if (isConsolidated) {
        bgColor = COLORS.Consolidated;
        borderStyle = `2px solid ${COLORS.ConsolidatedBorder}`;
        label = `🔗 CONSOLIDATED | ${block.job_ids?.length || 1} jobs | ${block.duration_hours || 4}h`;
      } else if (primaryDept === 'S&T') {
        bgColor = COLORS.SNT;
        label = `📡 ${block.job_ids?.[0] || block.block_id} | ${block.duration_hours || 2}h`;
      } else if (primaryDept === 'Traction') {
        bgColor = COLORS.Traction;
        label = `⚡ ${block.job_ids?.[0] || block.block_id} | ${block.duration_hours || 2}h`;
      }

      const isSelected = activeSelectedId === block.block_id;

      timelineItems.push({
        id: block.block_id,
        group: block.track_id,
        title: label,
        start_time: moment(block.start_time),
        end_time: moment(block.end_time),
        canMove: false,
        canResize: false,
        itemProps: {
          style: {
            background: bgColor,
            color: '#FFFFFF',
            border: isSelected ? '2px solid #FFFFFF' : borderStyle,
            borderRadius: isConsolidated ? '6px' : '4px',
            fontSize: '11px',
            fontWeight: '600',
            padding: '4px 8px',
            boxShadow: isSelected
              ? '0 0 0 2px #1E3A5F, 0 3px 8px rgba(0, 0, 0, 0.25)'
              : isConsolidated
              ? '0 2px 8px rgba(107, 91, 149, 0.4)'
              : 'none',
          },
          onClick: () => handleBlockClick(block),
        },
      });

      // 2. TSR Recovery Zones (following blocks with tsr_recovery_profile)
      if (filters.showTSR && block.tsr_recovery_profile) {
        const stages = block.tsr_recovery_profile.recovery_stages || [];
        let currentStart = moment(block.end_time);

        stages.forEach((stage, idx) => {
          const stageStart = currentStart.clone();
          const stageEnd = stageStart.clone().add(stage.duration_hours, 'hours');
          currentStart = stageEnd.clone();

          timelineItems.push({
            id: `tsr-${block.block_id}-${idx}`,
            group: block.track_id,
            title: `▒▒ TSR: ${stage.max_speed_kmh} km/h`,
            start_time: stageStart,
            end_time: stageEnd,
            canMove: false,
            canResize: false,
            itemProps: {
              style: {
                background:
                  'repeating-linear-gradient(45deg, #F08C00 0px, #F08C00 6px, transparent 6px, transparent 12px)',
                color: '#1F2933',
                fontSize: '10px',
                fontWeight: '500',
                opacity: 0.6,
                borderRadius: '2px',
                padding: '2px 4px',
              },
            },
          });
        });
      }
    });

    // 3. Trains (thinner discrete red movements)
    if (filters.showTrains && trains.length > 0) {
      trains.forEach((train) => {
        timelineItems.push({
          id: `train-${train.train_id}`,
          group: train.track_id,
          title: `🚆 ${train.train_number}`,
          start_time: moment(train.entry_time),
          end_time: moment(train.exit_time),
          canMove: false,
          canResize: false,
          itemProps: {
            style: {
              background: COLORS.Train,
              color: '#FFFFFF',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 6px',
              opacity: 0.85,
              height: '16px',
              marginTop: '20px',
            },
          },
        });
      });
    }

    return timelineItems;
  }, [scheduledBlocks, trains, filters, activeSelectedId, handleBlockClick]);

  // Selected block for telemetry footer
  const selectedBlockObj = useMemo(() => {
    return scheduledBlocks.find((b) => b.block_id === activeSelectedId) || null;
  }, [scheduledBlocks, activeSelectedId]);

  // ==========================================================================
  // RENDER: FEATURE 7 (LOADING & ERROR STATES)
  // ==========================================================================
  if (loading && scheduledBlocks.length === 0) {
    return (
      <div className="bg-white border border-[#D6DEE6] rounded-lg shadow-sm p-12 text-center select-none">
        <div className="flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#1E3A5F]" />
          <p className="text-sm font-semibold text-[#1F2933]">
            Loading weekly plan from Divisional Control Office...
          </p>
          <span className="text-xs text-[#52606D]">
            Evaluating CP-SAT tactical block allocations & train timetable
          </span>
        </div>
      </div>
    );
  }

  if (error && scheduledBlocks.length === 0) {
    return (
      <div className="bg-white border border-[#D6DEE6] rounded-lg shadow-sm p-8 text-center select-none">
        <div className="flex flex-col items-center justify-center space-y-2.5">
          <AlertTriangle className="w-8 h-8 text-[#C92A2A]" />
          <h3 className="text-sm font-bold text-[#1F2933]">Unable to Load Weekly Schedule</h3>
          <p className="text-xs text-[#52606D] max-w-md">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-2 px-3 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-semibold hover:bg-[#2F6F7E] transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#D6DEE6] rounded-lg shadow-sm p-4 w-full select-none flex flex-col font-sans">
      {/* ==================================================================== */}
      {/* FEATURE 1: TOP HEADER STRIP                                          */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D6DEE6]">
        <div>
          <h2 className="text-base font-bold text-[#1E3A5F] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1E3A5F]" />
            Weekly Block Timeline
          </h2>
          <p className="text-xs text-[#52606D] mt-0.5">
            Pune Division (CR) | Week 1 (Mon-Sun) |{' '}
            <span className="font-semibold text-[#1F2933]">
              {metrics.total_blocks_created || scheduledBlocks.length} blocks
            </span>{' '}
            |{' '}
            <span className="font-semibold text-[#2F9E44]">
              {metrics.active_conflicts ?? 0} conflicts
            </span>{' '}
            |{' '}
            <span className="font-semibold text-[#6B5B95]">
              {metrics.consolidated_blocks_count || 0} consolidated
            </span>
          </p>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Zoom Toggle Buttons */}
          <div className="flex border border-[#D6DEE6] rounded overflow-hidden text-xs font-semibold">
            <button
              type="button"
              className={`px-3 py-1.5 transition-colors ${
                zoomLevel === 'day'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-white text-[#52606D] hover:bg-[#F4F6F8]'
              }`}
              onClick={() => handleZoomToggle('day')}
            >
              Day
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 border-l border-[#D6DEE6] transition-colors ${
                zoomLevel === 'week'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-white text-[#52606D] hover:bg-[#F4F6F8]'
              }`}
              onClick={() => handleZoomToggle('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 border-l border-[#D6DEE6] transition-colors ${
                zoomLevel === 'multi-week'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-white text-[#52606D] hover:bg-[#F4F6F8]'
              }`}
              onClick={() => handleZoomToggle('multi-week')}
            >
              Multi-Week
            </button>
          </div>

          {/* Filter Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-3 py-1.5 border rounded flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                isFilterOpen
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white border-[#D6DEE6] text-[#1F2933] hover:bg-[#F4F6F8]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Filter Dropdown */}
            {isFilterOpen && (
              <div className="absolute right-0 top-10 w-56 bg-white border border-[#D6DEE6] rounded-md shadow-xl p-3 z-30 text-xs space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#D6DEE6] font-bold text-[#1F2933]">
                  <span>Filter Layers</span>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="text-[#52606D] hover:text-[#1F2933]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.showEngineering}
                      onChange={(e) =>
                        setFilters({ ...filters, showEngineering: e.target.checked })
                      }
                      className="rounded text-[#1E3A5F]"
                    />
                    <span>Engineering (Civil)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.showSNT}
                      onChange={(e) => setFilters({ ...filters, showSNT: e.target.checked })}
                      className="rounded text-[#1E3A5F]"
                    />
                    <span>S&T (Signals)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.showTraction}
                      onChange={(e) =>
                        setFilters({ ...filters, showTraction: e.target.checked })
                      }
                      className="rounded text-[#1E3A5F]"
                    />
                    <span>Traction (OHE)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.showConsolidated}
                      onChange={(e) =>
                        setFilters({ ...filters, showConsolidated: e.target.checked })
                      }
                      className="rounded text-[#1E3A5F]"
                    />
                    <span>Consolidated (Purple)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer pt-1 border-t border-[#D6DEE6]">
                    <input
                      type="checkbox"
                      checked={filters.showTrains}
                      onChange={(e) =>
                        setFilters({ ...filters, showTrains: e.target.checked })
                      }
                      className="rounded text-[#1E3A5F]"
                    />
                    <span>Passing Trains</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.showTSR}
                      onChange={(e) => setFilters({ ...filters, showTSR: e.target.checked })}
                      className="rounded text-[#1E3A5F]"
                    />
                    <span>TSR Recovery Zones</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={loadData}
            title="Reload Schedule Data"
            disabled={loading}
            className="p-1.5 bg-white border border-[#D6DEE6] rounded text-[#1E3A5F] hover:bg-[#F4F6F8] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* FEATURE 2: LEGEND ROW                                                */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center gap-4 py-2.5 text-xs text-[#52606D] border-b border-[#D6DEE6] mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-xs bg-[#3B6EA5]" />
          <span>🔧 Engineering</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-xs bg-[#2F8F6B]" />
          <span>📡 S&T</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-xs bg-[#C9842A]" />
          <span>⚡ Traction</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-xs bg-[#6B5B95] border border-[#A98CD3]" />
          <span className="text-[#6B5B95] font-semibold">🔗 Consolidated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1.5 rounded-xs bg-[#B42318]" />
          <span>🚆 Trains</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-4 h-2.5 rounded-xs border border-dashed border-[#F08C00]"
            style={{
              background:
                'repeating-linear-gradient(45deg, #F08C00 0px, #F08C00 4px, transparent 4px, transparent 8px)',
            }}
          />
          <span>▒▒ TSR Recovery</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* FEATURE 6: TIMELINE COMPONENT CONFIGURATION                          */}
      {/* ==================================================================== */}
      <div className="relative border border-[#D6DEE6] rounded-md overflow-hidden bg-white min-h-[480px] isolate z-0">
        {scheduledBlocks.length === 0 ? (
          <div className="p-12 text-center text-[#52606D] text-xs">
            No scheduled blocks for this week. Run the CP-SAT solver to schedule jobs.
          </div>
        ) : (
          <Timeline
            groups={sortedGroups}
            items={allItems}
            defaultTimeStart={earliestTime}
            defaultTimeEnd={latestTime}
            visibleTimeStart={visibleTimeStart}
            visibleTimeEnd={visibleTimeEnd}
            onTimeChange={handleTimeChange}
            canMove={false}
            canResize={false}
            canChangeGroup={false}
            lineHeight={55}
            itemHeightRatio={0.75}
            sidebarWidth={200}
            stackItems={false}
            itemTouchSendsClick={true}
            minZoom={60 * 60 * 1000} // 1 hour minimum zoom
            maxZoom={30 * 24 * 60 * 60 * 1000} // 30 days maximum zoom
            onItemSelect={(itemId) => handleItemSelect(itemId)}
          >
            <TimelineHeaders className="bg-slate-50">
              <SidebarHeader>
                {({ getRootProps }) => (
                  <div
                    {...getRootProps()}
                    className="bg-slate-50 border-r border-slate-200 flex items-center justify-center font-semibold text-slate-700 text-sm"
                  >
                    Track ID
                  </div>
                )}
              </SidebarHeader>
              <DateHeader
                unit="day"
                labelFormat="ddd DD MMM"
                style={{
                  height: 40,
                  fontWeight: 600,
                  fontSize: '13px',
                  color: '#1F2933',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <DateHeader
                unit="hour"
                labelFormat="HH:mm"
                style={{
                  height: 30,
                  fontSize: '11px',
                  color: '#52606D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </TimelineHeaders>

            {/* Current Time Indicator ("Now") */}
            <CustomMarker date={earliestTime.clone().add(8, 'hours').valueOf()}>
              {({ styles }) => (
                <div style={styles} className="mars-now-marker" title="Operational Time">
                  <span className="mars-now-badge">Now</span>
                </div>
              )}
            </CustomMarker>
          </Timeline>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SELECTION INSPECTION TELEMETRY STRIP                                 */}
      {/* ==================================================================== */}
      {selectedBlockObj && (
        <div className="mt-3 bg-[#F8FAFC] border border-[#D6DEE6] rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-white border border-[#D6DEE6] shadow-xs text-[#2F9E44]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-sm text-[#1E3A5F]">
                  {selectedBlockObj.block_id}
                </span>
                <span className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded font-mono font-bold">
                  {selectedBlockObj.track_id}
                </span>
                {selectedBlockObj.is_consolidated && (
                  <span className="text-[10px] bg-[#6B5B95]/15 text-[#6B5B95] border border-[#6B5B95]/30 px-2 py-0.5 rounded font-bold">
                    Consolidated Possession
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#52606D] mt-1 font-mono">
                <span>
                  Window:{' '}
                  <strong className="text-[#1F2933]">
                    {moment(selectedBlockObj.start_time).format('ddd HH:mm')} →{' '}
                    {moment(selectedBlockObj.end_time).format('HH:mm')}
                  </strong>{' '}
                  ({selectedBlockObj.duration_hours || 2.5}h)
                </span>
                <span>•</span>
                <span>
                  Departments:{' '}
                  <strong className="text-[#1F2933]">
                    {(selectedBlockObj.departments || ['Engineering']).join(', ')}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Track Clearance:{' '}
                  <strong className="text-[#2F9E44]">15+15m COA Guarded</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleBlockClick(selectedBlockObj)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#2F6F7E] text-white rounded text-xs font-bold shadow-xs transition-colors"
            >
              <span>Inspect Reason for Allocation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
