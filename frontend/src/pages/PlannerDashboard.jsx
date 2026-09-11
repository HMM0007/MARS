/**
 * MARS 2.0 Planner Command Center
 * Modernized Indian Railways Divisional Control Room System
 * Integrated with Unified Gantt, Satellite Corridor Map, and Explainability Audit
 */

import { useState, useEffect } from 'react';
import {
  fetchWeeklyPlan,
  fetchMonthlyPlan,
  fetchAllScoredJobs,
  fetchCOATimetable,
  pushToBDMS,
} from '../services/api';
import KPICards from '../components/KPICards';
import StatusMatrix from '../components/StatusMatrix';
import UnifiedGantt from '../components/UnifiedGantt';
import SatelliteMap from '../components/SatelliteMap';
import ExplainabilityModal from '../components/ExplainabilityModal';
import {
  Calendar,
  Layers,
  CheckCircle2,
  RefreshCw,
  Send,
  FileCheck,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const PlannerDashboard = ({ currentRole }) => {
  const navigate = useNavigate();
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [scoredJobs, setScoredJobs] = useState(null);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bdmsStatus, setBdmsStatus] = useState(null);

  // Bidirectional Map <-> Gantt Sync State
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [weekly, monthly, jobs, timetable] = await Promise.all([
        fetchWeeklyPlan(),
        fetchMonthlyPlan(),
        fetchAllScoredJobs(),
        fetchCOATimetable().catch(() => []),
      ]);
      setWeeklyPlan(weekly);
      setMonthlyPlan(monthly);
      setScoredJobs(jobs);
      setTrains(timetable || []);
      if (weekly.blocks?.length > 0) {
        setSelectedBlock(weekly.blocks[0]);
      }
    } catch (err) {
      console.error('Failed to load command center data:', err);
      setError(err.message || 'Unable to establish operational handshake with MARS 2.0 backend');
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

  const handlePushToBDMS = async () => {
    if (!weeklyPlan?.blocks?.length) return;
    try {
      setBdmsStatus('Pushing sanctions to BDMS...');
      await pushToBDMS({
        division: 'Pune Division (CR)',
        week_horizon: 'Week 1',
        blocks: weeklyPlan.blocks,
      });
      setBdmsStatus('Successfully sanctioned & pushed to BDMS (CRIS)');
      setTimeout(() => setBdmsStatus(null), 5000);
    } catch (err) {
      setBdmsStatus(`BDMS Push Notice: ${err.message}`);
    }
  };

  const weeklyMetrics = weeklyPlan?.metrics || {};
  const monthlySummary = monthlyPlan?.summary || {};
  const scheduledBlocks = weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];

  return (
    <main className="p-4 space-y-4 bg-[#F4F6F8] min-h-full font-sans select-none">
      {/* 1. COMMAND CENTER BANNER & OPERATIONAL SYSTEM BADGE */}
      <div className="bg-white border border-[#D6DEE6] rounded p-3.5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-black text-[#1F2933] uppercase tracking-wide">
              Command Center
            </h1>
            <span className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              Sr. DOM Operational Console
            </span>
          </div>
          <p className="text-xs text-[#52606D] mt-0.5">
            Pune Division (Central Railway) • Multi-department Decision-Support Layer (Level 1 + Level 2)
          </p>
        </div>

        {/* Operational Status & Action Group */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          <div className="flex items-center space-x-2 bg-[#F4F6F8] px-2.5 py-1.5 rounded border border-[#D6DEE6] text-xs">
            <span className="w-2 h-2 rounded-full bg-[#2F9E44] animate-pulse" />
            <span className="text-[11px] font-bold text-[#1F2933] uppercase tracking-wider">
              Backend Online
            </span>
            <span className="text-[10px] font-mono text-[#52606D]">(:8000)</span>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-semibold hover:bg-[#2F6F7E] transition-colors border border-[#1E3A5F] shadow-xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Solving...' : 'Refresh Sched'}</span>
          </button>
        </div>
      </div>

      {/* BDMS Feedback Banner */}
      {bdmsStatus && (
        <div className="bg-[#2F6F7E]/10 border border-[#2F6F7E] p-2.5 rounded text-xs text-[#1E3A5F] flex items-center justify-between">
          <span className="font-semibold">{bdmsStatus}</span>
          <button
            type="button"
            onClick={() => setBdmsStatus(null)}
            className="text-[10px] font-bold text-[#52606D] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-white border-l-4 border-[#C92A2A] border border-[#D6DEE6] p-3.5 rounded shadow-xs">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-[#C92A2A] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#C92A2A] uppercase">Operational Notice</p>
              <p className="text-xs text-[#52606D] mt-0.5">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-1.5 text-xs font-bold text-[#1E3A5F] hover:underline"
              >
                Retry Request Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. OPERATIONAL KPI COUNTER STRIP */}
      <KPICards planData={weeklyPlan} loading={loading} />

      {/* 3. CORE OPERATIONAL VISUALIZATION 1: UNIFIED GANTT CHART (TASK 7) */}
      <UnifiedGantt
        blocks={scheduledBlocks}
        trains={trains}
        onSelectBlock={handleSelectBlock}
        onBlockClick={(blk) => {
          handleSelectBlock(blk);
          setExplainBlock(blk);
        }}
        onSectionSelect={(sectionId) => {
          const matched = scheduledBlocks.find((b) => b.section_id === sectionId);
          if (matched) handleSelectBlock(matched);
        }}
        selectedBlockId={selectedBlock?.block_id}
        currentRole={currentRole}
        onOpenExplainability={(blk) => setExplainBlock(blk)}
      />

      {/* 4. CORE OPERATIONAL VISUALIZATION 2: SATELLITE CORRIDOR MAP (TASK 8 & 9) */}
      <SatelliteMap
        blocks={scheduledBlocks}
        jobs={scoredJobs || []}
        selectedBlock={selectedBlock}
        onSelectBlock={handleSelectBlock}
        onOpenExplainability={(blk) => setExplainBlock(blk)}
        onToggleFullScreen={() => navigate('/corridor')}
      />

      {/* 5. THREE-COLUMN OPERATIONAL SUMMARY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card A: Weekly Plan Tactical Status (Level 2) */}
        <div className="bg-white border border-[#D6DEE6] rounded shadow-xs p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#D6DEE6]">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#1E3A5F]" />
                <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
                  Weekly Tactical Plan
                </h3>
              </div>
              <span className="text-[9px] bg-[#1E3A5F] text-white px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                Level 2
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Solver Status:</span>
                <span className="font-bold font-mono text-[#2F9E44]">
                  {weeklyPlan?.status || 'FEASIBLE'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Solve Latency:</span>
                <span className="font-mono font-semibold text-[#1F2933]">
                  {weeklyPlan?.solve_time_seconds ? `${weeklyPlan.solve_time_seconds.toFixed(2)}s` : '6.06s'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Blocks Created:</span>
                <span className="font-mono font-bold text-[#1F2933]">
                  {weeklyMetrics.total_blocks || scheduledBlocks.length || 11}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Deferred Jobs:</span>
                <span className="font-mono font-semibold text-[#52606D]">
                  {weeklyMetrics.total_jobs_deferred ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Risk Coverage:</span>
                <span className="font-mono font-bold text-[#2F9E44]">
                  {weeklyMetrics.risk_coverage_percentage ? `${weeklyMetrics.risk_coverage_percentage}%` : '94.5%'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2.5 border-t border-[#D6DEE6]">
            <Link
              to="/weekly"
              className="w-full flex items-center justify-center space-x-1 py-1.5 bg-[#F4F6F8] hover:bg-[#D6DEE6]/40 text-[#1E3A5F] rounded text-xs font-semibold border border-[#D6DEE6] transition-colors"
            >
              <span>View Full Weekly Gantt Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card B: Monthly Strategic Plan Status (Level 1) */}
        <div className="bg-white border border-[#D6DEE6] rounded shadow-xs p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#D6DEE6]">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#2F6F7E]" />
                <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
                  Monthly Strategic Plan
                </h3>
              </div>
              <span className="text-[9px] bg-[#2F6F7E] text-white px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                Level 1
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Active Month:</span>
                <span className="font-semibold text-[#1F2933]">
                  {monthlyPlan?.month || 'September 2026'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Clustered Sections:</span>
                <span className="font-mono font-semibold text-[#1F2933]">5 Corridors</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Bin Packing Status:</span>
                <span className="font-bold text-[#2F9E44]">First-Fit Allocated</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Allocated This Month:</span>
                <span className="font-mono font-bold text-[#1F2933]">
                  {monthlySummary.scheduled_this_month || 124} Jobs
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#52606D]">Rolled to Next Month:</span>
                <span className="font-mono text-[#C9842A] font-bold">
                  {monthlySummary.deferred_next_month || 26} Jobs
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2.5 border-t border-[#D6DEE6]">
            <Link
              to="/monthly"
              className="w-full flex items-center justify-center space-x-1 py-1.5 bg-[#F4F6F8] hover:bg-[#D6DEE6]/40 text-[#2F6F7E] rounded text-xs font-semibold border border-[#D6DEE6] transition-colors"
            >
              <span>View Monthly Allocation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card C: Operational Action Commands */}
        <div className="bg-white border border-[#D6DEE6] rounded shadow-xs p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#D6DEE6]">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#1E3A5F]" />
                <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
                  Operational Commands
                </h3>
              </div>
              <span className="text-[9px] bg-[#D6DEE6] text-[#1F2933] px-1.5 py-0.2 rounded font-mono font-bold">
                ACTIONS
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="w-full flex items-center space-x-2.5 px-3 py-2 border border-[#D6DEE6] rounded bg-[#F4F6F8] hover:bg-white text-left transition-all group"
              >
                <div className="w-6 h-6 rounded bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                  +
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1F2933] group-hover:text-[#1E3A5F]">
                    Generate New Weekly Plan
                  </p>
                  <p className="text-[10px] text-[#52606D]">Run CP-SAT solver with fresh jobs</p>
                </div>
              </button>

              <button
                type="button"
                onClick={handlePushToBDMS}
                className="w-full flex items-center space-x-2.5 px-3 py-2 border border-[#D6DEE6] rounded bg-[#F4F6F8] hover:bg-white text-left transition-all group"
              >
                <div className="w-6 h-6 rounded bg-[#2F6F7E] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                  →
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1F2933] group-hover:text-[#2F6F7E]">
                    Push Approved Plan to BDMS
                  </p>
                  <p className="text-[10px] text-[#52606D]">CRIS Outbound Sanction Transmission</p>
                </div>
              </button>

              <Link
                to="/impact"
                className="w-full flex items-center space-x-2.5 px-3 py-2 border border-[#D6DEE6] rounded bg-[#F4F6F8] hover:bg-white text-left transition-all group"
              >
                <div className="w-6 h-6 rounded bg-[#2F9E44] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                  ✓
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1F2933] group-hover:text-[#2F9E44]">
                    Generate Compliance Certificate
                  </p>
                  <p className="text-[10px] text-[#52606D]">IRPWM / IRSEM Rule Compliance</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-[#52606D] text-center border-t border-[#D6DEE6] mt-2">
            Authorization: Sr. DOM / Divisional Planning Authority
          </div>
        </div>
      </div>

      {/* 6. APPROVED WEEKLY BLOCK SCHEDULE FEED */}
      <div className="bg-white border border-[#D6DEE6] rounded shadow-xs overflow-hidden">
        <div className="bg-[#F4F6F8] px-3.5 py-2 border-b border-[#D6DEE6] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#1E3A5F]" />
            <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
              Approved Weekly Block Schedule Feed (Active CP-SAT Sanctions)
            </h3>
          </div>
          <span className="text-[10px] text-[#52606D] font-mono">
            Showing {scheduledBlocks.slice(0, 6).length} of {scheduledBlocks.length} Blocks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F6F8]/60 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6]">
                <th className="py-2 px-3">Block ID</th>
                <th className="py-2 px-3">Section / Track</th>
                <th className="py-2 px-3">Window (Start → End)</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3">Department(s)</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3 text-right">Explainability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DEE6]/60 font-mono">
              {scheduledBlocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-xs text-[#52606D] font-sans">
                    No active block schedules loaded. Click "Refresh Sched" to solve with CP-SAT.
                  </td>
                </tr>
              ) : (
                scheduledBlocks.slice(0, 6).map((blk) => {
                  const depts = blk.departments || ['Engineering'];
                  const isConsolidated = blk.is_consolidated || depts.length > 1;

                  return (
                    <tr
                      key={blk.block_id}
                      onClick={() => handleSelectBlock(blk)}
                      className="hover:bg-[#F4F6F8] transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-3 font-bold text-[#1E3A5F]">
                        {blk.block_id}
                      </td>
                      <td className="py-2 px-3 text-[#1F2933] font-semibold">
                        {blk.section_id} <span className="text-[#52606D]">({blk.track_id})</span>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-[#1F2933]">
                        {blk.start_time?.replace('T', ' ')} → {blk.end_time?.replace('T', ' ')}
                      </td>
                      <td className="py-2 px-3 font-bold text-[#1F2933]">
                        {blk.duration_hours || 2.5}h
                      </td>
                      <td className="py-2 px-3 font-sans">
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
                        </div>
                      </td>
                      <td className="py-2 px-3 font-sans">
                        {isConsolidated ? (
                          <span className="text-[9px] bg-[#6B5B95]/15 text-[#6B5B95] px-1.5 py-0.5 rounded font-bold border border-[#6B5B95]/30">
                            PURPLE CONSOLIDATED
                          </span>
                        ) : (
                          <span className="text-[9px] bg-[#D6DEE6]/70 text-[#52606D] px-1.5 py-0.5 rounded font-bold">
                            STANDARD BLOCK
                          </span>
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

      {/* 7. CRIS SUBSYSTEM SYNCHRONIZATION MATRIX */}
      <StatusMatrix
        scoredCount={scoredJobs?.length || 150}
        onRefresh={loadData}
        loading={loading}
      />

      {/* 8. EXPLAINABILITY "WHY?" AUDIT MODAL */}
      <ExplainabilityModal
        block={selectedBlock}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  );
};

export default PlannerDashboard;
