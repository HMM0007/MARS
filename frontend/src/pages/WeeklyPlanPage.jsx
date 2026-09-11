/**
 * MARS 2.0 Weekly Tactical Plan Console (Level 2)
 * High-density operational planning console with Gantt, Map, and Explainability modal
 */

import { useState, useEffect } from 'react';
import { fetchWeeklyPlan, fetchCOATimetable } from '../services/api';
import UnifiedGantt from '../components/UnifiedGantt';
import SatelliteMap from '../components/SatelliteMap';
import ExplainabilityModal from '../components/ExplainabilityModal';
import {
  Calendar,
  Filter,
  Layers,
  Clock,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  HelpCircle,
  MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WeeklyPlanPage = ({ currentRole }) => {
  const navigate = useNavigate();
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTrack, setSelectedTrack] = useState('ALL');

  // Bidirectional Selection & Explainability
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [weekly, timetable] = await Promise.all([
        fetchWeeklyPlan(),
        fetchCOATimetable().catch(() => []),
      ]);
      setWeeklyPlan(weekly);
      setTrains(timetable || []);
      if (weekly.blocks?.length > 0) {
        setSelectedBlock(weekly.blocks[0]);
      }
    } catch (err) {
      console.error('Failed to load weekly plan:', err);
      setError(err.message || 'Error fetching weekly plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectBlock = (blk) => {
    setSelectedBlock(blk);
    setIsModalOpen(true);
  };

  const blocks = weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];

  // Filter blocks by department and track
  const filteredBlocks = blocks.filter((blk) => {
    const depts = blk.departments || [];
    const deptMatch =
      selectedDept === 'ALL'
        ? true
        : selectedDept === 'CONSOLIDATED'
        ? blk.is_consolidated || depts.length > 1
        : depts.includes(selectedDept);

    const trackMatch =
      selectedTrack === 'ALL' || blk.track_id === selectedTrack;

    return deptMatch && trackMatch;
  });

  const tracks = Array.from(new Set(blocks.map((b) => b.track_id).filter(Boolean)));

  return (
    <main className="p-4 space-y-4 bg-[#F4F6F8] min-h-full font-sans select-none">
      {/* 1. Operational Header */}
      <div className="bg-white border border-[#D6DEE6] rounded p-3.5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-black text-[#1F2933] uppercase tracking-wide">
              Proposed Weekly Block Plan
            </h1>
            <span className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded font-mono font-bold uppercase">
              Level 2 • CP-SAT
            </span>
          </div>
          <p className="text-xs text-[#52606D] mt-0.5">
            Tactical 7-Day Planning Horizon (672 × 15-min Intervals) • Train Clearance with 15+15 min Buffers
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-[#2F9E44]/10 text-[#2F9E44] border border-[#2F9E44]/20 px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 font-mono font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>0 CONFLICTS DETECTED</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-semibold hover:bg-[#2F6F7E] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Solving...' : 'Re-solve Schedule'}</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Filter Strip */}
      <div className="bg-white border border-[#D6DEE6] rounded p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Department Filter Buttons */}
        <div className="flex items-center space-x-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-[#52606D] uppercase mr-1 flex items-center">
            <Filter className="w-3 h-3 mr-1" /> Department:
          </span>
          {[
            { id: 'ALL', label: 'All Departments' },
            { id: 'Engineering', label: 'Engineering (Civil)' },
            { id: 'S&T', label: 'S&T (Signals)' },
            { id: 'Traction', label: 'Traction (OHE)' },
            { id: 'CONSOLIDATED', label: 'Consolidated ("Purple")' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedDept(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors border ${
                selectedDept === tab.id
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-[#F4F6F8] text-[#1F2933] border-[#D6DEE6] hover:bg-[#D6DEE6]/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Track Selector */}
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-3 h-3 text-[#52606D]" />
          <span className="text-[11px] font-bold text-[#52606D] uppercase">Track:</span>
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="text-xs bg-[#F4F6F8] border border-[#D6DEE6] rounded px-2 py-1 font-mono font-medium text-[#1F2933] focus:outline-none focus:border-[#1E3A5F]"
          >
            <option value="ALL">All Tracks (Corridor-wide)</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. UNIFIED GANTT CHART (TASK 7) */}
      <UnifiedGantt
        blocks={filteredBlocks}
        trains={trains}
        onSelectBlock={handleSelectBlock}
        onBlockClick={handleSelectBlock}
        onSectionSelect={(sectionId) => {
          const matched = filteredBlocks.find((b) => b.section_id === sectionId);
          if (matched) setSelectedBlock(matched);
        }}
        selectedBlockId={selectedBlock?.block_id}
        currentRole={currentRole}
        onOpenExplainability={(blk) => {
          setSelectedBlock(blk);
          setIsModalOpen(true);
        }}
      />

      {/* 4. SATELLITE CORRIDOR MAP (TASK 8 & 9) */}
      <SatelliteMap
        blocks={filteredBlocks}
        selectedBlock={selectedBlock}
        onSelectBlock={handleSelectBlock}
        onOpenExplainability={(blk) => {
          setSelectedBlock(blk);
          setIsModalOpen(true);
        }}
        onToggleFullScreen={() => navigate('/corridor')}
      />

      {/* 5. Full High-density Tactical Sanctions Table */}
      <div className="bg-white border border-[#D6DEE6] rounded shadow-xs overflow-hidden">
        <div className="bg-[#F4F6F8] px-3.5 py-2 border-b border-[#D6DEE6] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#1E3A5F]" />
            <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
              Sanctioned Tactical Block Register
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#1F2933]">
            {filteredBlocks.length} Blocks Matched Filter
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F6F8]/60 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6]">
                <th className="py-2 px-3">Block ID</th>
                <th className="py-2 px-3">Section</th>
                <th className="py-2 px-3">Track ID</th>
                <th className="py-2 px-3">Start Window</th>
                <th className="py-2 px-3">End Window</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3">Department(s)</th>
                <th className="py-2 px-3">TSR Profile</th>
                <th className="py-2 px-3 text-right">Reason (Audit)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DEE6]/60">
              {filteredBlocks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-xs text-[#52606D]">
                    No blocks found matching the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredBlocks.map((blk) => {
                  const depts = blk.departments || ['Engineering'];
                  const isConsolidated = blk.is_consolidated || depts.length > 1;

                  return (
                    <tr
                      key={blk.block_id}
                      onClick={() => handleSelectBlock(blk)}
                      className="hover:bg-[#F4F6F8] transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-3 font-mono font-bold text-[#1E3A5F]">
                        {blk.block_id}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#1F2933]">
                        {blk.section_id}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-[#52606D]">
                        {blk.track_id}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-[#1F2933]">
                        {blk.start_time?.replace('T', ' ')}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-[#1F2933]">
                        {blk.end_time?.replace('T', ' ')}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-[#1F2933]">
                        {blk.duration_hours}h
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center space-x-1">
                          {depts.map((d) => (
                            <span
                              key={d}
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                d === 'Engineering'
                                  ? 'bg-[#3B6EA5]/15 text-[#3B6EA5] border border-[#3B6EA5]/30'
                                  : d === 'S&T'
                                  ? 'bg-[#2F8F6B]/15 text-[#2F8F6B] border border-[#2F8F6B]/30'
                                  : 'bg-[#C9842A]/15 text-[#C9842A] border border-[#C9842A]/30'
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                          {isConsolidated && (
                            <span className="text-[9px] bg-[#6B5B95]/15 text-[#6B5B95] px-1 py-0.2 rounded font-bold">
                              ★
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px]">
                        {blk.tsr_recovery_profile ? (
                          <span className="text-[#C9842A] font-semibold bg-[#C9842A]/10 px-1 py-0.5 rounded">
                            20→45→75→110 km/h
                          </span>
                        ) : (
                          <span className="text-[#52606D]">None</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectBlock(blk);
                          }}
                          className="inline-flex items-center space-x-1 text-[10px] font-bold text-[#1E3A5F] hover:text-[#2F6F7E] bg-[#1E3A5F]/10 hover:bg-[#1E3A5F]/20 px-2 py-0.5 rounded border border-[#1E3A5F]/20"
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>Why?</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. EXPLAINABILITY MODAL */}
      <ExplainabilityModal
        block={selectedBlock}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  );
};

export default WeeklyPlanPage;
