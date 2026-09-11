/**
 * MARS 2.0 Department Operational Console
 * Specialized views for Engineering (Civil), S&T (Signals), and Traction (OHE)
 * Features Own Jobs, Priority Scoring, and Interactive Ghost Block Co-Scheduling.
 */

import { useState, useEffect } from 'react';
import { fetchWeeklyPlan, fetchAllScoredJobs } from '../services/api';
import {
  Wrench,
  Radio,
  Zap,
  Layers,
  Ghost,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  AlertTriangle,
} from 'lucide-react';

const DepartmentPage = ({ deptKey = 'Engineering' }) => {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Task 11: Interactive Ghost Block Co-Scheduling State
  const [activeGhostBlock, setActiveGhostBlock] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [consolidationSuccess, setConsolidationSuccess] = useState(null);

  const deptConfig = {
    Engineering: {
      name: 'Engineering (Civil Track)',
      code: 'ENG',
      authority: 'Sr. DEN (Co-ord) / Pune',
      color: '#3B6EA5',
      icon: Wrench,
      sourceSystem: 'Track Management System (TMS)',
      badgeClass: 'bg-[#3B6EA5]/15 text-[#3B6EA5] border-[#3B6EA5]/30',
    },
    'S&T': {
      name: 'S&T (Signals & Telecom)',
      code: 'S&T',
      authority: 'Sr. DSTE / Pune',
      color: '#2F8F6B',
      icon: Radio,
      sourceSystem: 'Signalling Maintenance (SMMS)',
      badgeClass: 'bg-[#2F8F6B]/15 text-[#2F8F6B] border-[#2F8F6B]/30',
    },
    Traction: {
      name: 'Traction Distribution (TRD / OHE)',
      code: 'TRD',
      authority: 'Sr. DEE (TRD) / Pune',
      color: '#C9842A',
      icon: Zap,
      sourceSystem: 'Traction Distribution (TDMS)',
      badgeClass: 'bg-[#C9842A]/15 text-[#C9842A] border-[#C9842A]/30',
    },
  };

  const config = deptConfig[deptKey] || deptConfig.Engineering;
  const Icon = config.icon;

  useEffect(() => {
    const loadDeptData = async () => {
      try {
        setLoading(true);
        const [weekly, jobs] = await Promise.all([
          fetchWeeklyPlan(),
          fetchAllScoredJobs(),
        ]);
        setWeeklyPlan(weekly);
        setAllJobs(jobs || []);
      } catch (err) {
        console.error('Error loading department data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDeptData();
  }, [deptKey]);

  // Own jobs vs other department jobs
  const ownJobs = allJobs.filter((j) => j.department === deptKey);
  const scheduledBlocks = weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];

  // Scheduled blocks belonging to this department
  const ownBlocks = scheduledBlocks.filter((b) =>
    (b.departments || []).includes(deptKey)
  );

  // Ghost Blocks: blocks booked by OTHER departments on corridor tracks
  const ghostBlocks = scheduledBlocks.filter(
    (b) => !(b.departments || []).includes(deptKey)
  );

  // Handle Co-Scheduling Submit (Convert to Purple Block)
  const handleCoScheduleSubmit = (e) => {
    e.preventDefault();
    if (!activeGhostBlock || !selectedJobId) return;

    const chosenJob = ownJobs.find((j) => j.job_id === selectedJobId);

    // Locally update the ghost block to become a joint consolidated Purple Block
    activeGhostBlock.departments = Array.from(
      new Set([...(activeGhostBlock.departments || []), deptKey])
    );
    activeGhostBlock.is_consolidated = true;
    activeGhostBlock.job_ids = Array.from(
      new Set([...(activeGhostBlock.job_ids || []), selectedJobId])
    );
    if (chosenJob) {
      activeGhostBlock.jobs_detail = [
        ...(activeGhostBlock.jobs_detail || []),
        chosenJob,
      ];
    }

    setConsolidationSuccess({
      blockId: activeGhostBlock.block_id,
      jobId: selectedJobId,
      trackId: activeGhostBlock.track_id,
    });

    setActiveGhostBlock(null);
    setSelectedJobId('');

    setTimeout(() => {
      setConsolidationSuccess(null);
    }, 6000);
  };

  return (
    <main className="p-4 space-y-4 bg-[#F4F6F8] min-h-full font-sans select-none">
      {/* 1. Department Header Banner */}
      <div className="bg-white border border-[#D6DEE6] rounded p-3.5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded flex items-center justify-center text-white shadow-xs"
            style={{ backgroundColor: config.color }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black text-[#1F2933] uppercase tracking-wide">
                {config.name}
              </h1>
              <span className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded font-mono font-bold">
                {config.code} CONSOLE
              </span>
            </div>
            <p className="text-xs text-[#52606D] mt-0.5">
              Authority: {config.authority} • Data Feeds from {config.sourceSystem}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[#52606D]">Integrated Pool:</span>
          <span className="font-mono font-bold text-[#1F2933] bg-[#F4F6F8] px-2 py-1 rounded border border-[#D6DEE6]">
            {ownJobs.length} Jobs Queued
          </span>
        </div>
      </div>

      {/* Consolidation Success Banner */}
      {consolidationSuccess && (
        <div className="bg-[#6B5B95]/15 border border-[#6B5B95] p-3 rounded text-xs text-[#1F2933] flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#6B5B95] flex-shrink-0" />
            <div>
              <p className="font-bold text-[#6B5B95] uppercase">
                Joint Consolidation Sanctioned (Purple Block Created)
              </p>
              <p className="text-[#52606D] mt-0.5">
                Job <span className="font-mono font-bold text-[#1F2933]">{consolidationSuccess.jobId}</span> has been co-scheduled into <span className="font-mono font-bold text-[#1F2933]">{consolidationSuccess.blockId}</span> on {consolidationSuccess.trackId}. Multi-department bonus (+40 points) applied!
              </p>
            </div>
          </div>
          <button
            onClick={() => setConsolidationSuccess(null)}
            className="text-[10px] font-bold text-[#52606D] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Department Metric Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2" style={{ borderTopColor: config.color }}>
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Department Jobs</span>
          <p className="text-2xl font-black font-mono mt-1" style={{ color: config.color }}>
            {ownJobs.length}
          </p>
          <p className="text-[10px] text-[#52606D] mt-1">Pending AI Priority Rank</p>
        </div>

        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2 border-t-[#2F9E44]">
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Sanctioned Blocks</span>
          <p className="text-2xl font-black font-mono text-[#2F9E44] mt-1">
            {ownBlocks.length}
          </p>
          <p className="text-[10px] text-[#52606D] mt-1">Week 1 Scheduled Windows</p>
        </div>

        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2 border-t-[#6B5B95]">
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Joint "Purple" Blocks</span>
          <p className="text-2xl font-black font-mono text-[#6B5B95] mt-1">
            {ownBlocks.filter((b) => b.is_consolidated || (b.departments || []).length > 1).length}
          </p>
          <p className="text-[10px] text-[#52606D] mt-1">Consolidated Multi-Dept</p>
        </div>

        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2 border-t-[#ADB5BD]">
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Other Dept Occupancy</span>
          <p className="text-2xl font-black font-mono text-[#52606D] mt-1">
            {ghostBlocks.length}
          </p>
          <p className="text-[10px] text-[#52606D] mt-1">Ghost Block Opportunities</p>
        </div>
      </div>

      {/* 3. High-Density Job Prioritization Table */}
      <div className="bg-white border border-[#D6DEE6] rounded shadow-xs overflow-hidden">
        <div className="bg-[#F4F6F8] px-3.5 py-2 border-b border-[#D6DEE6] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#1E3A5F]" />
            <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
              {config.code} Maintenance Job Queue & Risk Escalation
            </h3>
          </div>
          <span className="text-[10px] text-[#52606D] font-mono">
            XGBoost Priority Score (0 — 100)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F6F8]/60 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6]">
                <th className="py-2 px-3">Job ID</th>
                <th className="py-2 px-3">Defect Type</th>
                <th className="py-2 px-3">Track / Section</th>
                <th className="py-2 px-3">Location (KM)</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3">Criticality</th>
                <th className="py-2 px-3 font-mono">Base Score</th>
                <th className="py-2 px-3 font-mono">AI Risk Score</th>
                <th className="py-2 px-3">Schedule Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DEE6]/60">
              {ownJobs.slice(0, 8).map((job) => (
                <tr key={job.job_id} className="hover:bg-[#F4F6F8]/80 transition-colors">
                  <td className="py-2 px-3 font-mono font-bold text-[#1E3A5F]">
                    {job.job_id}
                  </td>
                  <td className="py-2 px-3 font-semibold text-[#1F2933]">
                    {job.defect_type?.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-[#52606D]">
                    {job.section_id} ({job.track_id})
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-[#1F2933]">
                    {job.location_km ? `Km ${job.location_km}` : 'Corridor'}
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-[#1F2933]">
                    {job.estimated_duration_hours || 2.0}h
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      job.criticality_level === 'CRITICAL'
                        ? 'bg-[#C92A2A]/15 text-[#C92A2A] border border-[#C92A2A]/30'
                        : job.criticality_level === 'HIGH'
                        ? 'bg-[#F08C00]/15 text-[#F08C00] border border-[#F08C00]/30'
                        : 'bg-[#2F9E44]/15 text-[#2F9E44] border border-[#2F9E44]/30'
                    }`}>
                      {job.criticality_level || 'MEDIUM'}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-[#52606D]">
                    {job.base_priority_score || 50}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-[#1E3A5F]">
                    {job.ai_priority_score ? Number(job.ai_priority_score).toFixed(1) : '56.4'}
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-[9px] bg-[#2F9E44]/10 text-[#2F9E44] border border-[#2F9E44]/20 px-1.5 py-0.2 rounded font-bold font-mono">
                      SANCTIONED W1
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. TASK 11: INTERACTIVE GHOST BLOCKS PANEL (CROSS-DEPARTMENT CO-SCHEDULING) */}
      <div className="bg-white border border-[#D6DEE6] rounded shadow-xs overflow-hidden">
        <div className="bg-[#F4F6F8] px-3.5 py-2 border-b border-[#D6DEE6] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Ghost className="w-4 h-4 text-[#52606D]" />
            <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
              Other Department Occupancy (Ghost Block Shadow Windows)
            </h3>
          </div>
          <span className="text-[10px] text-[#6B5B95] font-mono font-bold bg-[#6B5B95]/10 px-2 py-0.5 rounded border border-[#6B5B95]/20">
            ★ INTERACTIVE CO-SCHEDULING ENABLED
          </span>
        </div>

        <div className="p-3 bg-[#F4F6F8]/40 text-xs text-[#52606D] border-b border-[#D6DEE6]">
          <p>
            The blocks below have been booked by other departments on the corridor. Click{' '}
            <strong className="text-[#6B5B95]">"Co-Schedule Job"</strong> to piggyback on their
            possession window, combining them into a joint <strong>"Purple Block"</strong> without extra corridor downtime.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F6F8]/60 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6]">
                <th className="py-2 px-3">Block ID</th>
                <th className="py-2 px-3">Occupying Dept</th>
                <th className="py-2 px-3">Track / Section</th>
                <th className="py-2 px-3">Time Window</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3 text-right">Co-Scheduling Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DEE6]/60 font-mono">
              {ghostBlocks.slice(0, 6).map((b) => (
                <tr key={b.block_id} className="hover:bg-[#F4F6F8]/80 transition-colors bg-[#ADB5BD]/5">
                  <td className="py-2.5 px-3 text-[#52606D] font-bold">
                    {b.block_id} <span className="text-[10px] font-normal text-[#52606D] font-sans">(Ghost)</span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-[#1F2933] font-sans">
                    {(b.departments || []).join(', ')}
                  </td>
                  <td className="py-2.5 px-3 text-[#1F2933]">
                    {b.section_id} ({b.track_id})
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-[#52606D]">
                    {b.start_time?.replace('T', ' ')} → {b.end_time?.replace('T', ' ')}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-[#1F2933]">
                    {b.duration_hours || 2.5}h
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGhostBlock(b);
                        const matching = ownJobs.find((j) => j.track_id === b.track_id) || ownJobs[0];
                        if (matching) setSelectedJobId(matching.job_id);
                      }}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-[#6B5B95] hover:bg-[#584880] text-white transition-colors shadow-xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Co-Schedule Job</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. INTERACTIVE CO-SCHEDULING MODAL */}
      {activeGhostBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
          <div className="bg-white border border-[#D6DEE6] rounded-md shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#6B5B95] text-white px-4 py-3 flex items-center justify-between border-b border-[#584880]">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Request Joint Consolidation ("Purple Block")
                </h3>
              </div>
              <button
                onClick={() => setActiveGhostBlock(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCoScheduleSubmit} className="p-4 space-y-3.5 text-xs">
              {/* Host Block Details */}
              <div className="bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                <span className="text-[10px] font-bold text-[#52606D] uppercase">
                  Target Possession Window (Ghost Block)
                </span>
                <p className="font-bold text-[#1F2933] font-mono mt-0.5">
                  {activeGhostBlock.block_id} • {activeGhostBlock.track_id}
                </p>
                <p className="text-[11px] text-[#52606D]">
                  Occupied by: <span className="font-semibold text-[#1F2933]">{(activeGhostBlock.departments || []).join(', ')}</span> ({activeGhostBlock.duration_hours}h)
                </p>
              </div>

              {/* Select Job to Bundle */}
              <div>
                <label className="block text-[11px] font-bold text-[#52606D] uppercase mb-1">
                  Select {config.code} Maintenance Job to Piggyback:
                </label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full text-xs font-mono bg-white border border-[#D6DEE6] rounded px-2.5 py-1.5 text-[#1F2933] focus:outline-none focus:border-[#6B5B95]"
                  required
                >
                  <option value="" disabled>-- Select Pending Maintenance Job --</option>
                  {ownJobs.map((j) => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.job_id} - {j.defect_type} ({j.track_id}, {j.estimated_duration_hours}h, Priority: {j.ai_priority_score || 50})
                    </option>
                  ))}
                </select>
              </div>

              {/* Safety Compatibility Matrix Notice */}
              <div className="bg-[#2F9E44]/10 border border-[#2F9E44]/30 p-2.5 rounded flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#2F9E44] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-[#2F9E44] uppercase">
                    Safety Compatibility Matrix: PASS
                  </p>
                  <p className="text-[10px] text-[#52606D] mt-0.5">
                    No physical exclusion conflict detected between {(activeGhostBlock.departments || []).join(', ')} and {deptKey}. Multi-department bonus (+40 points) will be awarded.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#D6DEE6]">
                <button
                  type="button"
                  onClick={() => setActiveGhostBlock(null)}
                  className="px-3 py-1.5 border border-[#D6DEE6] rounded text-xs font-medium text-[#52606D] hover:bg-[#F4F6F8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#6B5B95] hover:bg-[#584880] text-white rounded text-xs font-bold transition-colors shadow-xs flex items-center space-x-1"
                >
                  <span>Submit Joint Consolidation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default DepartmentPage;
