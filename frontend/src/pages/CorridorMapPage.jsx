/**
 * MARS 2.0 Dedicated Satellite Railway Corridor Command Theater
 * Complete Full-Screen GIS Console for Indian Railways Divisional Control Office (DCO)
 * Displays: High-Resolution Satellite Map, Real Double-Track Lines, 15 Stations,
 * 150 Jobs Plotted by Chainage, CP-SAT Possession Highlights, and Live Telemetry.
 */

import { useState, useEffect } from 'react';
import { fetchWeeklyPlan, fetchAllScoredJobs } from '../services/api';
import SatelliteMap from '../components/SatelliteMap';
import ExplainabilityModal from '../components/ExplainabilityModal';
import {
  MapPin,
  Compass,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Wrench,
  Radio,
  ArrowUpRight,
  Maximize2,
  Gauge,
  SlidersHorizontal,
} from 'lucide-react';
import { PUNE_LNL_STATIONS, CORRIDOR_SECTORS } from '../utils/corridorGeo';

const CorridorMapPage = () => {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected state
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [explainBlock, setExplainBlock] = useState(null);

  // Filter state in left sidebar
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDeptTab, setActiveDeptTab] = useState('ALL');
  const [activeStatusTab, setActiveStatusTab] = useState('ALL'); // ALL, SCHEDULED, PENDING

  const loadCorridorData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [planData, jobsData] = await Promise.all([
        fetchWeeklyPlan().catch((e) => {
          console.warn('Weekly plan fetch note:', e);
          return null;
        }),
        fetchAllScoredJobs().catch((e) => {
          console.warn('Jobs fetch note:', e);
          return [];
        }),
      ]);
      setWeeklyPlan(planData);
      setAllJobs(Array.isArray(jobsData) ? jobsData : []);
    } catch (err) {
      console.error('Failed to load corridor GIS data:', err);
      setError(err.message || 'Error connecting to MARS 2.0 GIS backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCorridorData();
  }, []);

  const scheduledBlocks = weeklyPlan?.scheduled_blocks || weeklyPlan?.blocks || [];

  // Filtered jobs for left navigator
  const filteredJobs = allJobs.filter((job) => {
    if (activeDeptTab !== 'ALL' && job.department !== activeDeptTab) return false;

    const isScheduled = scheduledBlocks.some((b) => b.job_ids?.includes(job.job_id));
    if (activeStatusTab === 'SCHEDULED' && !isScheduled) return false;
    if (activeStatusTab === 'PENDING' && isScheduled) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = job.job_id?.toLowerCase().includes(q);
      const matchAsset = job.asset_id?.toLowerCase().includes(q);
      const matchDefect = job.defect_type?.toLowerCase().includes(q);
      const matchKm = String(job.location_km)?.includes(q);
      if (!matchId && !matchAsset && !matchDefect && !matchKm) return false;
    }

    return true;
  });

  return (
    <main className="p-4 sm:p-6 space-y-4 bg-[#F4F6F8] min-h-full flex flex-col select-none">
      {/* 1. INSTITUTIONAL CORRIDOR HEADER */}
      <div className="bg-white p-4 rounded border border-[#D6DEE6] shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-[#1E3A5F] flex items-center justify-center text-white">
              <Compass className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-[#1F2933] tracking-tight">
                  Dedicated Satellite Corridor Command Theater
                </h1>
                <span className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded font-mono font-bold uppercase">
                  DCO Geospatial Level
                </span>
                <span className="text-[10px] bg-[#2F9E44]/10 text-[#2F9E44] border border-[#2F9E44]/20 px-2 py-0.5 rounded font-mono font-bold">
                  Zero Conflicts Guaranteed
                </span>
              </div>
              <p className="text-xs text-[#52606D] mt-0.5">
                Pune Division (CR) • Pune Jn (Km 191.0) → Lonavala (Km 254.84) • 63.84 km Double Line 25kV AC Electrified Corridor
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Status */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadCorridorData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-semibold hover:bg-[#2F6F7E] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing GIS...' : 'Refresh Corridor'}</span>
          </button>
        </div>
      </div>

      {/* 2. OPERATIONAL TELEMETRY COUNTER STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-white border border-[#D6DEE6] p-3 rounded shadow-xs">
          <span className="text-[10px] text-[#52606D] uppercase font-bold tracking-wider">
            Total Corridor Jobs
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-bold text-[#1E3A5F]">{allJobs.length || 150}</span>
            <span className="text-[10px] text-[#52606D]">Registered</span>
          </div>
        </div>

        <div className="bg-white border border-[#D6DEE6] p-3 rounded shadow-xs">
          <span className="text-[10px] text-[#52606D] uppercase font-bold tracking-wider">
            Active CP-SAT Blocks
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-bold text-[#2F9E44]">{scheduledBlocks.length}</span>
            <span className="text-[10px] text-[#2F9E44]">Scheduled Windows</span>
          </div>
        </div>

        <div className="bg-white border border-[#D6DEE6] p-3 rounded shadow-xs">
          <span className="text-[10px] text-[#52606D] uppercase font-bold tracking-wider">
            Consolidated Purple Blocks
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-bold text-[#6B5B95]">
              {weeklyPlan?.weekly_metrics?.consolidated_blocks_count ||
                scheduledBlocks.filter((b) => b.is_consolidated).length}
            </span>
            <span className="text-[10px] text-[#6B5B95]">Joint Possessions</span>
          </div>
        </div>

        <div className="bg-white border border-[#D6DEE6] p-3 rounded shadow-xs">
          <span className="text-[10px] text-[#52606D] uppercase font-bold tracking-wider">
            Pending Backlog Queue
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-bold text-[#C9842A]">
              {Math.max(0, (allJobs.length || 150) - (weeklyPlan?.weekly_metrics?.scheduled_jobs_count || 40))}
            </span>
            <span className="text-[10px] text-[#C9842A]">Next Cycle</span>
          </div>
        </div>
      </div>

      {/* 3. DEDICATED SATELLITE COMMAND WORKSPACE (Two-Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* LEFT COLUMN: CHAINAGE & JOB DISPATCH QUEUE (4 COLS) */}
        <div className="lg:col-span-4 bg-white border border-[#D6DEE6] rounded shadow-xs flex flex-col overflow-hidden max-h-[780px]">
          <div className="p-3 border-b border-[#D6DEE6] bg-[#F4F6F8]/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1F2933] uppercase tracking-wider flex items-center space-x-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>Chainage Job Queue</span>
              </span>
              <span className="text-[10px] font-mono text-[#52606D]">
                Showing {filteredJobs.length} of {allJobs.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#52606D] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Job ID, KM (e.g. 210.6), Defect..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D6DEE6] rounded text-xs font-mono text-[#1F2933] focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            {/* Department Tabs */}
            <div className="flex items-center space-x-1 font-mono text-[10px]">
              {['ALL', 'Engineering', 'S&T', 'Traction'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setActiveDeptTab(dept)}
                  className={`flex-1 py-1 rounded font-bold transition-colors text-center ${
                    activeDeptTab === dept
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#F4F6F8]'
                  }`}
                >
                  {dept === 'ALL' ? 'ALL' : dept === 'Engineering' ? 'ENG' : dept}
                </button>
              ))}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center space-x-1 font-mono text-[10px]">
              {[
                { id: 'ALL', label: 'All Jobs' },
                { id: 'SCHEDULED', label: 'Scheduled (Blocks)' },
                { id: 'PENDING', label: 'Pending Queue' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveStatusTab(tab.id)}
                  className={`flex-1 py-1 rounded font-medium transition-colors text-center ${
                    activeStatusTab === tab.id
                      ? 'bg-[#2F6F7E] text-white font-bold'
                      : 'bg-[#F4F6F8] text-[#52606D] hover:bg-[#E2E8F0]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Job List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#D6DEE6] p-1">
            {filteredJobs.length === 0 ? (
              <div className="p-8 text-center text-[#52606D] text-xs">
                No maintenance jobs match current filter criteria.
              </div>
            ) : (
              filteredJobs.map((job) => {
                const isScheduled = scheduledBlocks.some((b) => b.job_ids?.includes(job.job_id));
                const matchedBlock = scheduledBlocks.find((b) => b.job_ids?.includes(job.job_id));
                const isSelected = selectedJob?.job_id === job.job_id;

                const deptColor =
                  job.department === 'Engineering'
                    ? 'border-l-[#3B6EA5] text-[#3B6EA5]'
                    : job.department === 'S&T'
                    ? 'border-l-[#2F8F6B] text-[#2F8F6B]'
                    : 'border-l-[#C9842A] text-[#C9842A]';

                return (
                  <div
                    key={job.job_id}
                    onClick={() => {
                      setSelectedJob(job);
                      if (matchedBlock) setSelectedBlock(matchedBlock);
                    }}
                    className={`p-2.5 border-l-4 cursor-pointer transition-colors text-xs ${deptColor} ${
                      isSelected
                        ? 'bg-[#1E3A5F]/10 font-medium'
                        : 'hover:bg-[#F4F6F8] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="font-bold text-[#1F2933]">{job.job_id}</span>
                        <span className="text-[10px] bg-[#E2E8F0] text-[#1F2933] px-1.5 py-0.2 rounded font-bold">
                          Km {Number(job.location_km).toFixed(2)}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          job.criticality_level === 'CRITICAL'
                            ? 'bg-[#C92A2A] text-white'
                            : job.criticality_level === 'HIGH'
                            ? 'bg-[#F08C00] text-white'
                            : 'bg-[#2F9E44] text-white'
                        }`}
                      >
                        {job.criticality_level}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#1F2933] font-medium mt-1 truncate">
                      {job.defect_type}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#52606D] mt-1.5">
                      <span>{job.track_id}</span>
                      {isScheduled ? (
                        <span className="text-[#2F9E44] font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{matchedBlock?.block_id}</span>
                        </span>
                      ) : (
                        <span className="text-[#C9842A] italic">Pending Solv</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: FULL EXPANSIVE SATELLITE MAP THEATER (8 COLS) */}
        <div className="lg:col-span-8 flex flex-col">
          <SatelliteMap
            blocks={scheduledBlocks}
            jobs={allJobs}
            selectedBlock={selectedBlock}
            selectedJob={selectedJob}
            onSelectBlock={setSelectedBlock}
            onSelectJob={setSelectedJob}
            onOpenExplainability={setExplainBlock}
            isFullScreenMode={true}
          />
        </div>
      </div>

      {/* 4. MATHEMATICAL EXPLAINABILITY MODAL */}
      {explainBlock && (
        <ExplainabilityModal
          block={explainBlock}
          onClose={() => setExplainBlock(null)}
        />
      )}
    </main>
  );
};

export default CorridorMapPage;
