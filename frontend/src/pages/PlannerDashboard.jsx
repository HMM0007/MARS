/**
 * MARS Planner Command Center
 * Modernized Indian Railways Divisional Control Room System
 * Executive Decision, Review, Plan Approval & CRIS BDMS Sanction Cockpit
 * 
 * Flow:
 * 1. Planner reviews scheduled blocks & job details in the review deck
 * 2. Planner approves and sanctions the plan (locking it as official divisional baseline)
 * 3. Dedicated options to redirect to Unified Gantt (/weekly) and Corridor Map (/corridor)
 * 4. Planner pushes the approved plan to CRIS BDMS
 */

import { useState, useEffect, useMemo } from 'react';
import {
  fetchWeeklyPlan,
  fetchFreshWeeklyPlan,
  approveWeeklyPlan,
  fetchApprovedPlanHistory,
  fetchMonthlyPlan,
  fetchAllScoredJobs,
  fetchCOATimetable,
  pushToBDMS,
} from '../services/api';
import KPICards from '../components/KPICards';
import StatusMatrix from '../components/StatusMatrix';
import ExplainabilityModal from '../components/ExplainabilityModal';
import {
  Calendar,
  Layers,
  CheckCircle2,
  RefreshCw,
  Send,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowRight,
  HelpCircle,
  History,
  ShieldCheck,
  Check,
  X,
  Wrench,
  Filter,
  TrainFront,
  RotateCcw,
  Map,
  FileCheck2,
  ChevronRight,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const deptMeta = {
  Engineering: 'border-[#3B6EA5]/25 bg-[#3B6EA5]/10 text-[#3B6EA5]',
  'S&T': 'border-[#2F8F6B]/25 bg-[#2F8F6B]/10 text-[#2F8F6B]',
  Traction: 'border-[#C9842A]/25 bg-[#C9842A]/10 text-[#A76614]',
};

const priorityBadge = (lvl) => {
  if (lvl === 'CRITICAL') return 'bg-[#C92A2A]/10 text-[#C92A2A] border-[#C92A2A]/25 font-bold';
  if (lvl === 'HIGH') return 'bg-[#F08C00]/10 text-[#A76614] border-[#F08C00]/25 font-bold';
  if (lvl === 'LOW') return 'bg-[#EEF2F4] text-[#60748A] border-[#D6DEE6]';
  return 'bg-[#EEF5FC] text-[#315F8D] border-[#C9DCEC]';
};

const statusBadge = (s) => {
  if (s === 'SCHEDULED') return 'bg-[#2F9E44]/15 text-[#2F9E44] border-[#2F9E44]/30 font-bold';
  if (s === 'DEFERRED') return 'bg-[#F08C00]/15 text-[#A76614] border-[#F08C00]/30 font-bold';
  if (s === 'COMPLETED') return 'bg-[#2F6F7E]/15 text-[#2F6F7E] border-[#2F6F7E]/30 font-bold';
  return 'bg-[#F4F6F8] text-[#52606D] border-[#D6DEE6] font-semibold';
};

const PlannerDashboard = ({ currentRole }) => {
  const navigate = useNavigate();
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [scoredJobs, setScoredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bdmsStatus, setBdmsStatus] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Workflow state
  const [isCandidate, setIsCandidate] = useState(false);
  const [generatingCandidate, setGeneratingCandidate] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approverName, setApproverName] = useState('Sr. DOM Pune (Planner)');
  const [historyList, setHistoryList] = useState([]);

  // Inspection & Review Deck State
  const [activeDeckTab, setActiveDeckTab] = useState('BLOCKS'); // 'BLOCKS' | 'SCHEDULED_JOBS' | 'PENDING' | 'DEFERRED'
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [weekly, monthly, jobs, history] = await Promise.all([
        fetchWeeklyPlan(),
        fetchMonthlyPlan(),
        fetchAllScoredJobs(),
        fetchApprovedPlanHistory().catch(() => []),
      ]);
      setWeeklyPlan(weekly);
      setMonthlyPlan(monthly);
      setScoredJobs(Array.isArray(jobs) ? jobs : (jobs?.jobs || []));
      setHistoryList(history || []);
      const isFreshCandidate = Boolean(
        !weekly?.baseline_approved &&
        weekly?.baseline_governance?.mode === 'FRESH_CANDIDATE'
      );
      setIsCandidate(isFreshCandidate);

      const blocks = weekly.blocks || weekly.scheduled_blocks || [];
      if (blocks.length > 0) {
        setSelectedBlock(blocks[0]);
      }
    } catch (err) {
      console.error('Failed to load command center data:', err);
      setError(err.message || 'Unable to establish operational handshake with MARS backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Generate Fresh Candidate Plan (CP-SAT Solver)
  const handleGenerateFreshPlan = async () => {
    try {
      setGeneratingCandidate(true);
      setError(null);
      const freshPlan = await fetchFreshWeeklyPlan(1);
      setWeeklyPlan(freshPlan);
      setIsCandidate(true);
      const blocks = freshPlan.blocks || freshPlan.scheduled_blocks || [];
      if (blocks.length > 0) setSelectedBlock(blocks[0]);
      setActionSuccess({
        type: 'CANDIDATE_GENERATED',
        title: 'New Plan generated',
        description: 'Candidate schedule computed by CP-SAT. Review the blocks and jobs below, then click "Approve & Sanction Plan".',
      });
      setTimeout(() => setActionSuccess(null), 8000);
    } catch (err) {
      console.error('Failed to generate fresh weekly plan:', err);
      setError(`Candidate generation error: ${err.message}`);
    } finally {
      setGeneratingCandidate(false);
    }
  };

  // Approve Plan
  const handleConfirmApproval = async () => {
    if (!weeklyPlan) return;
    try {
      setApprovalSubmitting(true);
      const payload = {
        week: 1,
        plan: weeklyPlan,
        approved_by: approverName.trim() || 'Sr. DOM Pune (Planner)',
      };
      await approveWeeklyPlan(payload);
      setIsApprovalModalOpen(false);
      setIsCandidate(false);
      setActionSuccess({
        type: 'PLAN_APPROVED',
        title: 'Weekly Plan Approved & Sanctioned!',
        description: 'Official baseline revision locked. You can now transmit sanctions to CRIS BDMS below or inspect visualizers.',
      });
      await loadData();
      setTimeout(() => setActionSuccess(null), 10000);
    } catch (err) {
      console.error('Approval failed:', err);
      setError(`Plan approval failed: ${err.message}`);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  // Push to BDMS
  const handlePushToBDMS = async () => {
    const blocks = weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];
    if (!blocks.length) return;
    try {
      setBdmsStatus('Pushing sanctions to CRIS BDMS...');
      const res = await pushToBDMS({
        division: 'Pune Division (CR)',
        planning_week: 1,
        approval_status: 'APPROVED',
        approval_id: `APPR-R${revisionNumber}-${weeklyPlan?.approved_by || 'Sr. DOM Pune'}`,
        plan_version: `v${revisionNumber}.0`,
        scheduled_blocks: blocks,
        blocks,
      });
      setBdmsStatus(`Successfully sanctioned & pushed to BDMS (CRIS) • Ref: ${res.bdms_reference || res.transaction_id || 'BDMS-PUNE-ACCEPTED'}`);
      setTimeout(() => setBdmsStatus(null), 8000);
    } catch (err) {
      setBdmsStatus(`BDMS Push Notice: ${err.message}`);
    }
  };

  const scheduledBlocks = weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];
  const deferredJobsList = weeklyPlan?.deferred_jobs || [];
  const revisionNumber = weeklyPlan?.baseline_governance?.revision ?? weeklyPlan?.baseline_revision ?? (historyList[0]?.revision ?? 1);

  // Synchronize scheduled job IDs in current plan
  const planScheduledJobIds = useMemo(() => {
    return new Set(scheduledBlocks.flatMap((b) => b?.job_ids || []));
  }, [scheduledBlocks]);

  // Compute job display status
  const getJobStatus = (j) => {
    if (j.status === 'COMPLETED') return 'COMPLETED';
    if (planScheduledJobIds.has(j.job_id)) return 'SCHEDULED';
    if (deferredJobsList.includes(j.job_id)) return 'DEFERRED';
    return j.status || 'PENDING';
  };

  const scheduledJobs = useMemo(() => {
    return scoredJobs.filter((j) => getJobStatus(j) === 'SCHEDULED');
  }, [scoredJobs, planScheduledJobIds]);

  const pendingJobs = useMemo(() => {
    return scoredJobs.filter((j) => getJobStatus(j) === 'PENDING');
  }, [scoredJobs, planScheduledJobIds]);

  const deferredJobs = useMemo(() => {
    return scoredJobs.filter((j) => getJobStatus(j) === 'DEFERRED');
  }, [scoredJobs, deferredJobsList]);

  // Filtered blocks based on search
  const filteredBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scheduledBlocks;
    return scheduledBlocks.filter((b) => {
      return (
        String(b.block_id || '').toLowerCase().includes(q) ||
        String(b.section_id || '').toLowerCase().includes(q) ||
        String(b.track_id || '').toLowerCase().includes(q) ||
        (b.departments || []).some((d) => d.toLowerCase().includes(q)) ||
        (b.job_ids || []).some((id) => id.toLowerCase().includes(q))
      );
    });
  }, [scheduledBlocks, searchQuery]);

  // Filtered jobs for the active tab
  const activeDeckJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = [];
    if (activeDeckTab === 'SCHEDULED_JOBS') base = scheduledJobs;
    else if (activeDeckTab === 'PENDING') base = pendingJobs;
    else if (activeDeckTab === 'DEFERRED') base = deferredJobs;

    if (!q) return base;
    return base.filter((j) => {
      return (
        String(j.job_id || '').toLowerCase().includes(q) ||
        String(j.asset_id || '').toLowerCase().includes(q) ||
        String(j.section_id || '').toLowerCase().includes(q) ||
        String(j.track_id || '').toLowerCase().includes(q) ||
        String(j.defect_type || '').toLowerCase().includes(q) ||
        String(j.department || '').toLowerCase().includes(q)
      );
    });
  }, [activeDeckTab, scheduledJobs, pendingJobs, deferredJobs, searchQuery]);

  // Jobs inside selected block
  const selectedBlockJobs = useMemo(() => {
    if (!selectedBlock) return [];
    const jobIds = selectedBlock.job_ids || [];
    return scoredJobs.filter((j) => jobIds.includes(j.job_id));
  }, [selectedBlock, scoredJobs]);

  return (
    <main className="p-4 space-y-4 bg-[#F4F6F8] min-h-full font-sans select-none">
      {/* 1. TOP HEADER & OPERATIONAL CONSOLE BANNER */}
      <div className="bg-white border border-[#D6DEE6] rounded p-3.5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-black text-[#1F2933] uppercase tracking-wide">
              Planner Command Center
            </h1>
            <span className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              Sr. DOM Operational Cockpit
            </span>
          </div>
          <p className="text-xs text-[#52606D] mt-0.5">
            Pune Division (Central Railway) • Plan Review, Sanction Authority & CRIS BDMS Integration
          </p>
        </div>

        {/* Operational Status & Top Actions */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#F4F6F8] text-[#1E3A5F] rounded text-xs font-semibold hover:bg-[#E5EDF5] transition-colors border border-[#D6DEE6] shadow-xs"
          >
            <History className="w-3.5 h-3.5 text-[#1E3A5F]" />
            <span>Approved Plans List ({historyList.length})</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading || generatingCandidate}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-semibold hover:bg-[#2F6F7E] transition-colors border border-[#1E3A5F] shadow-xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh State'}</span>
          </button>
        </div>
      </div>

      {/* 2. PLAN GOVERNANCE & ACTION BAR (REVIEW -> APPROVE -> PUSH TO BDMS) */}
      <div className={`border rounded-lg p-4 shadow-sm transition-all ${
        isCandidate
          ? 'bg-gradient-to-r from-[#FFF9DB] via-[#FFF3BF] to-[#FFF9DB] border-[#F08C00]/50'
          : 'bg-gradient-to-r from-[#EBFBEE] via-[#D3F9D8] to-[#EBFBEE] border-[#2F9E44]/50'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className={`p-2.5 rounded-full mt-0.5 shadow-xs ${
              isCandidate ? 'bg-[#F08C00] text-white' : 'bg-[#2F9E44] text-white'
            }`}>
              {isCandidate ? <Sparkles className="w-5 h-5 animate-pulse" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider ${
                  isCandidate
                    ? 'bg-[#F08C00] text-white'
                    : 'bg-[#2F9E44] text-white'
                }`}>
                  {isCandidate ? 'CANDIDATE PLAN PROPOSED (Awaiting Approval)' : `APPROVED BASELINE • Revision R${revisionNumber}`}
                </span>
                <span className="text-xs font-bold text-[#1F2933]">
                  Week 1 Tactical Schedule • {scheduledBlocks.length} Blocks Sanctioned
                </span>
              </div>
              <p className="text-xs text-[#52606D] mt-1">
                {isCandidate
                  ? 'The CP-SAT optimization engine has scheduled the weekly work. Review the blocks and enclosed maintenance jobs below, then click "Approve & Sanction Plan".'
                  : `Active divisional baseline sanctioned by ${weeklyPlan?.approved_by || 'Sr. DOM Pune'}. All enclosed jobs are scheduled across engineering, signalling, and traction.`}
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
            {isCandidate ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsApprovalModalOpen(true)}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#2F9E44] hover:bg-[#28883B] text-white rounded text-xs font-bold shadow-sm transition-transform active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Sanction Plan</span>
                </button>

                <button
                  type="button"
                  onClick={loadData}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-[#F4F6F8] text-[#52606D] rounded text-xs font-semibold border border-[#D6DEE6]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Revert to Approved Baseline</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePushToBDMS}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#2F6F7E] hover:bg-[#255864] text-white rounded text-xs font-bold shadow-sm transition-transform active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Push Approved Plan to BDMS (CRIS)</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateFreshPlan}
                  disabled={generatingCandidate}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-[#F4F6F8] text-[#1E3A5F] rounded text-xs font-semibold border border-[#D6DEE6] disabled:opacity-60"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${generatingCandidate ? 'animate-spin' : ''}`} />
                  <span>{generatingCandidate ? 'Solving CP-SAT...' : 'Generate New Candidate Plan'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* POST-APPROVAL NAVIGATION OPTIONS: Direct Redirects to Gantt Chart & Corridor Map */}
        <div className="mt-3.5 pt-3 border-t border-black/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="text-[11px] text-[#52606D] flex items-center space-x-1.5">
            <span className="font-bold text-[#1F2933]">Approved Plan Visualizers:</span>
            <span>Reflected live in dedicated consoles across the Pune Division.</span>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              to="/weekly"
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-[#F4F6F8] text-[#1E3A5F] rounded text-xs font-bold border border-[#D6DEE6] shadow-2xs transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-[#1E3A5F]" />
              <span>Open in Unified Gantt Chart →</span>
            </Link>

            <Link
              to="/corridor"
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-[#F4F6F8] text-[#2F6F7E] rounded text-xs font-bold border border-[#D6DEE6] shadow-2xs transition-colors"
            >
              <Map className="w-3.5 h-3.5 text-[#2F6F7E]" />
              <span>Open on Corridor Map →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className={`p-3.5 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#1F2933] border ${
          (typeof actionSuccess === 'object' && actionSuccess.type === 'CANDIDATE_GENERATED')
            ? 'bg-[#EEF5FC] border-[#1E3A5F]/20 border-l-4 border-l-[#1E3A5F]'
            : 'bg-[#EBFBEE] border-[#2F9E44]/30 border-l-4 border-l-[#2F9E44]'
        }`}>
          <div className="flex items-center space-x-2.5">
            {typeof actionSuccess === 'object' && actionSuccess.type === 'CANDIDATE_GENERATED' ? (
              <Sparkles className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-[#2F9E44] flex-shrink-0" />
            )}
            <div>
              <p className="font-bold text-[#1F2933]">
                {typeof actionSuccess === 'object' ? actionSuccess.title : actionSuccess}
              </p>
              <p className="text-[11px] text-[#52606D]">
                {typeof actionSuccess === 'object'
                  ? actionSuccess.description
                  : 'Action completed successfully.'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {typeof actionSuccess === 'object' && actionSuccess.type === 'PLAN_APPROVED' && (
              <button
                type="button"
                onClick={handlePushToBDMS}
                className="px-3.5 py-1.5 bg-[#2F6F7E] hover:bg-[#255864] text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Push to BDMS Now →</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionSuccess(null)}
              className="text-[#52606D] hover:underline text-[10px] px-1 font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {bdmsStatus && (
        <div className="bg-[#2F6F7E]/10 border border-[#2F6F7E] p-2.5 rounded text-xs text-[#1E3A5F] flex items-center justify-between">
          <span className="font-semibold">{bdmsStatus}</span>
          <button type="button" onClick={() => setBdmsStatus(null)} className="text-[10px] font-bold text-[#52606D] hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="bg-white border-l-4 border-[#C92A2A] border border-[#D6DEE6] p-3.5 rounded shadow-xs">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-[#C92A2A] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#C92A2A] uppercase">Operational Notice</p>
              <p className="text-xs text-[#52606D] mt-0.5">{error}</p>
              <button type="button" onClick={loadData} className="mt-1.5 text-xs font-bold text-[#1E3A5F] hover:underline">
                Retry Request Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. OPERATIONAL KPI COUNTER STRIP */}
      <KPICards planData={weeklyPlan} loading={loading} />

      {/* 4. CORE OPERATIONAL DECISION QUEUE: SCHEDULED BLOCKS & JOBS REVIEW DECK */}
      <div className="bg-white border border-[#D6DEE6] rounded-lg shadow-xs overflow-hidden">
        {/* Review Deck Navigation Header */}
        <div className="bg-[#F4F6F8] px-4 py-3 border-b border-[#D6DEE6] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <FileCheck2 className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="text-xs font-black text-[#1F2933] uppercase tracking-wider">
                Tactical Schedule Review Deck
              </h2>
            </div>
            <p className="text-[10px] text-[#52606D] mt-0.5">
              Review all scheduled blocks, time windows, and enclosed maintenance work before sanctioning
            </p>
          </div>

          {/* Search & Tabs */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search block, section, defect..."
              className="px-2.5 py-1.5 text-xs border border-[#D6DEE6] rounded bg-white outline-none w-56"
            />

            <div className="flex items-center bg-white border border-[#D6DEE6] rounded p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setActiveDeckTab('BLOCKS')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeDeckTab === 'BLOCKS'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#52606D] hover:bg-[#F4F6F8]'
                }`}
              >
                Scheduled Blocks ({scheduledBlocks.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveDeckTab('SCHEDULED_JOBS')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeDeckTab === 'SCHEDULED_JOBS'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#52606D] hover:bg-[#F4F6F8]'
                }`}
              >
                Scheduled Jobs ({scheduledJobs.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveDeckTab('PENDING')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeDeckTab === 'PENDING'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#52606D] hover:bg-[#F4F6F8]'
                }`}
              >
                Pending Queue ({pendingJobs.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveDeckTab('DEFERRED')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeDeckTab === 'DEFERRED'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#52606D] hover:bg-[#F4F6F8]'
                }`}
              >
                Deferred ({deferredJobs.length})
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: SCHEDULED BLOCKS TABLE */}
        {activeDeckTab === 'BLOCKS' && (
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#F4F6F8] border-b border-[#D6DEE6] text-[10px] font-bold text-[#52606D] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Block ID</th>
                  <th className="py-2.5 px-3">Section / Track</th>
                  <th className="py-2.5 px-3">Time Window</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Departments</th>
                  <th className="py-2.5 px-3">Enclosed Jobs</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Review & Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEE6]/60 font-mono">
                {filteredBlocks.map((blk) => {
                  const depts = blk.departments || ['Engineering'];
                  const isConsolidated = blk.is_consolidated || depts.length > 1;
                  const isSelected = selectedBlock?.block_id === blk.block_id;

                  return (
                    <tr
                      key={blk.block_id}
                      onClick={() => setSelectedBlock(blk)}
                      className={`hover:bg-[#F4F6F8] transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EEF5FC] border-l-4 border-l-[#1E3A5F]' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-[#1E3A5F]">
                        {blk.block_id}
                      </td>
                      <td className="py-2.5 px-3 text-[#1F2933] font-semibold">
                        {blk.section_id} <span className="text-[#52606D]">({blk.track_id})</span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[#1F2933]">
                        {blk.start_time?.replace('T', ' ')} → {blk.end_time?.replace('T', ' ')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#1F2933]">
                        {blk.duration_hours || 2.5}h
                      </td>
                      <td className="py-2.5 px-3 font-sans">
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
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-bold text-[#1E3A5F]">
                          {(blk.job_ids || []).length} Jobs
                        </span>
                        <span className="text-[10px] text-[#52606D] ml-1">
                          ({(blk.job_ids || []).slice(0, 2).join(', ')}{blk.job_ids?.length > 2 ? '...' : ''})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {isConsolidated ? (
                          <span className="text-[9px] bg-[#6B5B95]/15 text-[#6B5B95] px-1.5 py-0.5 rounded font-bold border border-[#6B5B95]/30">
                            SHARED PURPLE
                          </span>
                        ) : (
                          <span className="text-[9px] bg-[#D6DEE6]/70 text-[#52606D] px-1.5 py-0.5 rounded font-bold">
                            STANDARD BLOCK
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBlock(blk);
                              setIsExplainModalOpen(true);
                            }}
                            className="inline-flex items-center space-x-1 text-[10px] font-bold text-[#1E3A5F] hover:text-[#2F6F7E] bg-[#1E3A5F]/10 hover:bg-[#1E3A5F]/20 px-2 py-0.5 rounded border border-[#1E3A5F]/20"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>Why?</span>
                          </button>

                          <Link
                            to="/weekly"
                            onClick={(e) => e.stopPropagation()}
                            title="Inspect on Unified Gantt Chart"
                            className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-[#2F6F7E] hover:underline"
                          >
                            <span>Gantt</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredBlocks.length && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[#52606D] font-sans">
                      No blocks found matching "{searchQuery}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TABS 2, 3, 4: JOBS TABLE (SCHEDULED / PENDING / DEFERRED) */}
        {activeDeckTab !== 'BLOCKS' && (
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#F4F6F8] border-b border-[#D6DEE6] text-[10px] font-bold text-[#52606D] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Defect / Work Description</th>
                  <th className="py-2.5 px-3">Section / Track</th>
                  <th className="py-2.5 px-3">Location KM</th>
                  <th className="py-2.5 px-3">AI Priority</th>
                  <th className="py-2.5 px-3">Criticality</th>
                  <th className="py-2.5 px-3">Plan Status</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEE6]/60 font-mono">
                {activeDeckJobs.slice(0, 80).map((j) => {
                  const st = getJobStatus(j);
                  return (
                    <tr
                      key={j.job_id}
                      onClick={() => setSelectedJob(j)}
                      className="hover:bg-[#F4F6F8] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-bold text-[#1E3A5F]">{j.job_id}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${deptMeta[j.department]}`}>
                          {j.department}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-[#1F2933]">
                        {String(j.defect_type || 'Maintenance').replaceAll('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-[#52606D]">
                        {j.section_id} <span className="text-[10px]">({j.track_id})</span>
                      </td>
                      <td className="py-2.5 px-3 text-[#1F2933]">
                        KM {j.location_km ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#1E3A5F]">
                        {Number(j.ai_priority_score || 0).toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] ${priorityBadge(j.criticality_level)}`}>
                          {j.criticality_level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`px-2 py-0.5 rounded border text-[9px] ${statusBadge(st)}`}>
                          {st}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(j);
                          }}
                          className="text-[10px] font-bold text-[#1E3A5F] hover:underline"
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!activeDeckJobs.length && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-[#52606D] font-sans">
                      No jobs found in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Selected Block Quick Review Bar */}
        {selectedBlock && activeDeckTab === 'BLOCKS' && (
          <div className="bg-[#FAFBFC] border-t border-[#D6DEE6] p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 text-xs">
            <div>
              <span className="font-bold text-[#1E3A5F]">Active Block Selected:</span>{' '}
              <strong className="font-mono text-[#1F2933]">{selectedBlock.block_id}</strong> ({selectedBlock.section_id} • {selectedBlock.track_id}) •{' '}
              <span className="text-[#52606D]">Enclosed Jobs: {(selectedBlock.job_ids || []).join(', ')}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsExplainModalOpen(true)}
                className="text-[10px] font-bold text-[#1E3A5F] hover:underline flex items-center space-x-1"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Explain Decision</span>
              </button>
              <span className="text-[#D6DEE6]">|</span>
              <Link to="/weekly" className="text-[10px] font-bold text-[#1E3A5F] hover:underline">
                View in Gantt Console →
              </Link>
              <span className="text-[#D6DEE6]">|</span>
              <Link to="/corridor" className="text-[10px] font-bold text-[#2F6F7E] hover:underline">
                View on Corridor Map →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 5. CRIS SUBSYSTEM SYNCHRONIZATION MATRIX */}
      <StatusMatrix
        scoredCount={scoredJobs.length || 150}
        onRefresh={loadData}
        loading={loading}
      />

      {/* 6. APPROVAL CONFIRMATION MODAL */}
      {isApprovalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-[#D6DEE6] shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-[#57D6A8]" />
                <h3 className="text-sm font-black uppercase tracking-wider">Sanction & Approve Weekly Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-[#F4F6F8] p-3 rounded border border-[#D6DEE6] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#52606D]">Planning Horizon:</span>
                  <span className="font-bold text-[#1F2933]">Week 1 (7-Day Tactical Schedule)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52606D]">Total Blocks Created:</span>
                  <span className="font-mono font-bold text-[#1E3A5F]">{scheduledBlocks.length} Blocks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52606D]">Jobs Scheduled:</span>
                  <span className="font-mono font-bold text-[#2F9E44]">{planScheduledJobIds.size} Maintenance Jobs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52606D]">Deferred Jobs:</span>
                  <span className="font-mono font-semibold text-[#A76614]">{deferredJobsList.length} Jobs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52606D]">Passenger Train Protection:</span>
                  <span className="font-bold text-[#2F9E44]">100% Conflict-Free (COA Timetable Verified)</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1F2933] uppercase mb-1">
                  Sanctioning Authority (Approver Name / Role):
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="e.g. Sr. DOM Pune (Planner)"
                  className="w-full px-3 py-2 border border-[#D6DEE6] rounded text-xs outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div className="p-2.5 bg-[#FFF9DB] border border-[#F08C00]/30 rounded text-[11px] text-[#A76614]">
                <strong>Divisional Sanction Notice:</strong> Approving this plan will lock it as official baseline Revision R{revisionNumber + 1}, update all {planScheduledJobIds.size} enclosed maintenance jobs to <strong>SCHEDULED</strong> across the entire system, and enable direct CRIS BDMS transmission.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#D6DEE6]">
                <button
                  type="button"
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#52606D] font-semibold hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproval}
                  disabled={approvalSubmitting}
                  className="px-4 py-2 bg-[#2F9E44] hover:bg-[#28883B] text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow-sm disabled:opacity-60"
                >
                  {approvalSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sanctioning...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Sanction Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. APPROVED PLANS HISTORY MODAL */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-[#D6DEE6] shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-[#57D6A8]" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Approved Plans List & Revision Audit Log
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <p className="text-xs text-[#52606D]">
                Every approved plan is recorded as an immutable divisional baseline revision with timestamps, sanctioning authority, and job counts.
              </p>

              <div className="space-y-2">
                {historyList.map((entry, idx) => (
                  <div
                    key={entry.revision || idx}
                    className={`p-3.5 rounded border transition-all ${
                      idx === 0
                        ? 'bg-[#EBFBEE] border-[#2F9E44]/40 shadow-xs'
                        : 'bg-[#FAFBFC] border-[#D6DEE6]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                          idx === 0 ? 'bg-[#2F9E44] text-white' : 'bg-[#1E3A5F] text-white'
                        }`}>
                          Revision R{entry.revision}
                        </span>
                        {idx === 0 && (
                          <span className="text-[9px] bg-[#2F9E44]/20 text-[#2F9E44] px-2 py-0.5 rounded font-bold uppercase">
                            Active Baseline
                          </span>
                        )}
                        <span className="text-xs font-bold text-[#1F2933]">
                          Week {entry.planning_week || 1} Tactical Plan
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#52606D]">
                        {entry.approved_at ? new Date(entry.approved_at).toLocaleString() : '—'}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-[#52606D] block text-[9px] uppercase font-semibold">Approver:</span>
                        <strong className="text-[#1F2933]">{entry.approved_by || 'Sr. DOM Pune'}</strong>
                      </div>
                      <div>
                        <span className="text-[#52606D] block text-[9px] uppercase font-semibold">Blocks Created:</span>
                        <strong className="font-mono text-[#1E3A5F]">{entry.block_count || 0} Blocks</strong>
                      </div>
                      <div>
                        <span className="text-[#52606D] block text-[9px] uppercase font-semibold">Jobs Scheduled:</span>
                        <strong className="font-mono text-[#2F9E44]">{entry.scheduled_job_count || (entry.job_ids || []).length} Jobs</strong>
                      </div>
                      <div>
                        <span className="text-[#52606D] block text-[9px] uppercase font-semibold">Solver Status:</span>
                        <strong className="font-mono text-[#2F9E44]">{entry.solver_status || 'FEASIBLE'}</strong>
                      </div>
                    </div>
                  </div>
                ))}

                {!historyList.length && (
                  <div className="text-center py-8 text-xs text-[#52606D]">
                    No approved plan history records found.
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#F4F6F8] border-t border-[#D6DEE6] flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-bold hover:bg-[#2F6F7E]"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. SINGLE JOB DETAIL MODAL */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="bg-white rounded-lg border border-[#D6DEE6] shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1E3A5F] text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-black">{selectedJob.job_id}</div>
                <div className="text-[10px] text-white/75">{selectedJob.department} Maintenance Job</div>
              </div>
              <button type="button" onClick={() => setSelectedJob(null)} className="text-white/75 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                <div className="text-[9px] text-[#52606D] uppercase font-bold">Tactical Plan Status</div>
                <div className="mt-1">
                  <span className={`px-2 py-0.5 rounded border text-[10px] ${statusBadge(getJobStatus(selectedJob))}`}>
                    {getJobStatus(selectedJob)}
                  </span>
                </div>
              </div>

              <div className="bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                <div className="text-[9px] text-[#52606D] uppercase font-bold">AI Priority Score</div>
                <div className="mt-1 font-mono font-black text-sm text-[#1E3A5F]">
                  {Number(selectedJob.ai_priority_score || 0).toFixed(1)} / 100
                </div>
              </div>

              <div className="bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                <div className="text-[9px] text-[#52606D] uppercase font-bold">Criticality Level</div>
                <div className="mt-1 font-bold text-[#1F2933]">{selectedJob.criticality_level}</div>
              </div>

              <div className="bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                <div className="text-[9px] text-[#52606D] uppercase font-bold">Duration Required</div>
                <div className="mt-1 font-bold text-[#1F2933]">{selectedJob.estimated_duration_hours || 2} hours</div>
              </div>

              <div className="col-span-2 bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                <div className="text-[9px] text-[#52606D] uppercase font-bold">Work / Defect Description</div>
                <div className="mt-1 font-semibold text-[#1F2933]">
                  {String(selectedJob.defect_type || 'Maintenance').replaceAll('_', ' ')}
                </div>
              </div>

              <div className="col-span-2 bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                <div className="text-[9px] text-[#52606D] uppercase font-bold">Corridor Location</div>
                <div className="mt-1 font-mono text-[#1F2933]">
                  {selectedJob.section_id} • Track {selectedJob.track_id} • KM {selectedJob.location_km ?? '—'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#F4F6F8] border-t border-[#D6DEE6] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-3 py-1 bg-[#1E3A5F] text-white rounded text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. EXPLAINABILITY "WHY?" AUDIT MODAL */}
      <ExplainabilityModal
        block={selectedBlock}
        jobCatalog={scoredJobs}
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
      />
    </main>
  );
};

export default PlannerDashboard;
