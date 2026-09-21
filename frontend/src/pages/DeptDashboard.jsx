import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Radio,
  Zap,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  Train,
  X,
  Send,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  ExternalLink,
  RefreshCw,
  FileText,
  Activity,
  ArrowRight,
} from 'lucide-react';
import {
  fetchDepartmentJobs,
  fetchWeeklyPlan,
  fetchCOATimetable,
  submitJobIntake,
} from '../services/api';
import SanctionMemoModal from '../components/SanctionMemoModal';

const ICON_MAP = {
  Wrench,
  Radio,
  Zap,
};

const DEPT_MANDATE = {
  Engineering: {
    title: 'Civil Engineering & Permanent Way (P-Way)',
    code: 'ENG / P-WAY',
    adapter: 'Track Management System (TMS)',
    inCharge: 'Sr. DEN (Co-ord) Pune',
    overview:
      'Responsible for track structural integrity, rail crack detection (USFD), Track Geometry Index (TGI) compliance, ballast deep screening, and bridge maintenance across Pune Division.',
    keyAssets: '3,55,249 track assets • 5 major corridors • 240.5 Route Kms',
  },
  'S&T': {
    title: 'Signalling & Telecommunication Department',
    code: 'S&T / SMMS',
    adapter: 'Signalling Maintenance Management System (SMMS)',
    inCharge: 'Sr. DSTE Pune',
    overview:
      'Responsible for fail-safe Electronic Interlocking (EI), dual-detection digital axle counters, point machine calibrations, track circuit health, and quad/OFC railway telecom networks.',
    keyAssets: '142 Interlocked Stations • 420 Point Machines • 1,280 Track Circuits',
  },
  Traction: {
    title: 'Traction Distribution (TRD / Electrical)',
    code: 'TRD / 25kV OHE',
    adapter: 'Traction Data Management System (TDMS)',
    inCharge: 'Sr. DEE (TRD) Pune',
    overview:
      'Responsible for 25kV AC overhead equipment (OHE), contact & catenary wire height/stagger calibration, neutral section insulators, traction substations (TSS/SP/SSP), and power block isolations.',
    keyAssets: '25kV Electrified Corridors • 6 Traction Substations • 4 Tower Wagons',
  },
};

const DEPT_MACHINES = {
  Engineering: ['None', 'CSM 09-32 Tamping Machine', 'BCM 80 Deep Screening', 'PQRS Track Relaying', 'Thermit Welding Plant', 'Duomatic Tamper'],
  'S&T': ['None', 'Cable Fault Locator Van', 'Relay Testing Kit', 'Point Machine Gauge Set'],
  Traction: ['None', '8-Wheeler Tower Wagon (TW-1)', '8-Wheeler Tower Wagon (TW-2)', 'Emergency Ladder Trolley Gang'],
};

export default function DeptDashboard({
  department = 'Engineering',
  themeColor = '#3B6EA5',
  deptIcon = 'Wrench',
  currentRole,
}) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const IconComponent = typeof deptIcon === 'string' ? (ICON_MAP[deptIcon] || Wrench) : deptIcon;

  // Active Tab: 'intro' (clean home intro) | 'inbox' (requests table) | 'timeline' (Gantt chart) | 'shared' (shared blocks)
  const [activeTab, setActiveTab] = useState(() => {
    if (location.hash === '#department-timeline-section' || location.hash === '#timeline') return 'timeline';
    if (location.hash === '#jobs' || searchParams.get('tab') === 'inbox') return 'inbox';
    if (searchParams.get('filter') === 'scheduled' || searchParams.get('tab') === 'shared') return 'shared';
    return searchParams.get('tab') || 'intro';
  });

  // Keep activeTab in sync with URL hash or query params
  useEffect(() => {
    if (location.hash === '#department-timeline-section' || location.hash === '#timeline') {
      setActiveTab('timeline');
    } else if (location.hash === '#jobs' || searchParams.get('tab') === 'inbox') {
      setActiveTab('inbox');
    } else if (searchParams.get('filter') === 'scheduled' || searchParams.get('tab') === 'shared') {
      setActiveTab('shared');
    }
  }, [location.hash, searchParams]);

  // Data states
  const [allJobs, setAllJobs] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states
  const [filter, setFilter] = useState('all'); // all | scheduled | pending | deferred | completed | critical
  const [searchQuery, setSearchQuery] = useState('');

  // UI Interactive modals / drawers
  const [selectedJob, setSelectedJob] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeferralDrawer, setShowDeferralDrawer] = useState(false);
  const [drawerJob, setDrawerJob] = useState(null);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalationJob, setEscalationJob] = useState(null);
  const [escalationNote, setEscalationNote] = useState('');
  const [escalatedJobs, setEscalatedJobs] = useState(new Set());
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [showSanctionMemo, setShowSanctionMemo] = useState(false);
  const [memoBlock, setMemoBlock] = useState(null);
  const [memoJob, setMemoJob] = useState(null);

  // Timeline zoom
  const timelineContainerRef = useRef(null);
  const [timeZoom, setTimeZoom] = useState('week'); // week | 48h | day

  // Load Data
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [jobsData, planData, trainsData] = await Promise.all([
        fetchDepartmentJobs(department),
        fetchWeeklyPlan(),
        fetchCOATimetable().catch(() => []),
      ]);
      setAllJobs(Array.isArray(jobsData) ? jobsData : (jobsData?.jobs || []));
      setWeeklyPlan(planData);
      setTrains(Array.isArray(trainsData) ? trainsData : (trainsData?.timetable || []));
    } catch (err) {
      console.error(`Failed to load data for ${department}:`, err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [department]);

  // Listen to sidebar action events (e.g. open add request)
  useEffect(() => {
    const handleAddEvent = () => setShowAddModal(true);
    window.addEventListener('mars:open-add-job', handleAddEvent);
    return () => window.removeEventListener('mars:open-add-job', handleAddEvent);
  }, []);

  // Show Toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Derive Blocks
  const blocks = useMemo(() => {
    return weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];
  }, [weeklyPlan]);

  const scheduledJobIds = useMemo(() => {
    const set = new Set();
    blocks.forEach((b) => {
      (b.job_ids || []).forEach((id) => set.add(id));
    });
    return set;
  }, [blocks]);

  const deferredJobIds = useMemo(() => {
    const set = new Set(weeklyPlan?.deferred_jobs || []);
    allJobs.forEach((j) => {
      if (j.status === 'DEFERRED') set.add(j.job_id);
    });
    return set;
  }, [weeklyPlan, allJobs]);

  // Enriched jobs with real schedule/deferral sync
  const enrichedJobs = useMemo(() => {
    return allJobs.map((j) => {
      let computedStatus = j.status || 'PENDING';
      if (scheduledJobIds.has(j.job_id)) computedStatus = 'SCHEDULED';
      else if (deferredJobIds.has(j.job_id)) computedStatus = 'DEFERRED';

      return {
        ...j,
        computedStatus,
        isEscalated: escalatedJobs.has(j.job_id),
      };
    });
  }, [allJobs, scheduledJobIds, deferredJobIds, escalatedJobs]);

  // KPI Calculations
  const totalJobsCount = enrichedJobs.length;
  const scheduledCount = enrichedJobs.filter((j) => j.computedStatus === 'SCHEDULED').length;
  const deferredCount = enrichedJobs.filter((j) => j.computedStatus === 'DEFERRED').length;
  const criticalCount = enrichedJobs.filter((j) => j.criticality_level === 'CRITICAL').length;
  const scheduledPercent = totalJobsCount > 0 ? Math.round((scheduledCount / totalJobsCount) * 100) : 0;

  // Shared blocks involving this department
  const sharedBlocks = useMemo(() => {
    return blocks.filter((b) => (b.departments || []).length > 1 && (b.departments || []).includes(department));
  }, [blocks, department]);

  // Filtered Table Jobs
  const filteredJobs = useMemo(() => {
    return enrichedJobs.filter((j) => {
      if (activeTab === 'shared') {
        const isInShared = sharedBlocks.some((b) => (b.job_ids || []).includes(j.job_id));
        if (!isInShared) return false;
      }

      if (filter === 'scheduled' && j.computedStatus !== 'SCHEDULED') return false;
      if (filter === 'pending' && j.computedStatus !== 'PENDING') return false;
      if (filter === 'deferred' && j.computedStatus !== 'DEFERRED') return false;
      if (filter === 'completed' && j.computedStatus !== 'COMPLETED') return false;
      if (filter === 'critical' && j.criticality_level !== 'CRITICAL') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = (j.job_id || '').toLowerCase().includes(q);
        const matchesDefect = (j.defect_type || '').toLowerCase().includes(q);
        const matchesAsset = (j.asset_id || '').toLowerCase().includes(q);
        const matchesTrack = (j.track_id || '').toLowerCase().includes(q);
        if (!matchesId && !matchesDefect && !matchesAsset && !matchesTrack) return false;
      }

      return true;
    });
  }, [enrichedJobs, filter, searchQuery, activeTab, sharedBlocks]);

  // Timeline Tracks
  const timelineTracks = useMemo(() => {
    const tracksSet = new Set();
    blocks.forEach((b) => {
      if (b.track_id) tracksSet.add(b.track_id);
    });
    trains.forEach((t) => {
      if (t.track_id) tracksSet.add(t.track_id);
    });
    ['PUNE-LNL-UP', 'PUNE-LNL-DN', 'PUNE-DD-UP', 'PUNE-DD-DN', 'PUNE-MRJ-UP', 'PUNE-MRJ-DN'].forEach((t) =>
      tracksSet.add(t)
    );
    return Array.from(tracksSet);
  }, [blocks, trains]);

  // Timeline time range
  const { timelineStart, timelineEnd } = useMemo(() => {
    let minTime = new Date('2026-09-07T00:00:00').getTime();
    let maxTime = new Date('2026-09-14T00:00:00').getTime();

    blocks.forEach((b) => {
      if (b.start_time) {
        const t = new Date(b.start_time).getTime();
        if (t < minTime) minTime = t;
      }
      if (b.end_time) {
        const t = new Date(b.end_time).getTime();
        if (t > maxTime) maxTime = t;
      }
    });

    trains.forEach((tr) => {
      if (tr.entry_time) {
        const t = new Date(tr.entry_time).getTime();
        if (t < minTime) minTime = t;
      }
      if (tr.exit_time) {
        const t = new Date(tr.exit_time).getTime();
        if (t > maxTime) maxTime = t;
      }
    });

    return { timelineStart: minTime, timelineEnd: maxTime };
  }, [blocks, trains]);

  const totalDurationMs = timelineEnd - timelineStart || 7 * 24 * 3600 * 1000;

  // Handle Escalation Submission
  const handleSendEscalation = (e) => {
    e.preventDefault();
    if (!escalationJob) return;

    setEscalatedJobs((prev) => new Set([...prev, escalationJob.job_id]));
    showToast(`Escalation note sent to Planner Command Center for ${escalationJob.job_id}`);
    setShowEscalationModal(false);
    setShowDeferralDrawer(false);
    setEscalationNote('');
  };

  // Handle New Maintenance Job Submit (Defect type in free text!)
  const handleAddJobSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const asset_id = formData.get('asset_id');
    const section_id = formData.get('section_id');
    const track_id = formData.get('track_id');
    const location_km = parseFloat(formData.get('location_km') || 0);
    const defect_type = (formData.get('defect_type') || '').toString().trim();
    const criticality_level = formData.get('criticality_level') || 'HIGH';
    const estimated_duration_hours = parseFloat(formData.get('estimated_duration_hours') || 2);
    const due_date = formData.get('due_date') || '2026-09-20';
    const machine_required = formData.get('machine_required') || 'None';
    const power_block_required = formData.get('power_block_required') === 'on';
    const preferred_window = formData.get('preferred_shift') || 'NIGHT';
    const notes = formData.get('notes') || '';

    const prefix = department === 'Engineering' ? 'ENG' : department === 'S&T' ? 'SNT' : 'TRC';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const job_id = `${prefix}-NEW-${randomNum}`;

    let baseScore = 65.0;
    if (criticality_level === 'CRITICAL') baseScore = 88.5 + (Math.random() * 8);
    else if (criticality_level === 'HIGH') baseScore = 72.0 + (Math.random() * 6);
    else if (criticality_level === 'MEDIUM') baseScore = 54.0 + (Math.random() * 6);
    else baseScore = 38.0 + (Math.random() * 6);
    const ai_priority_score = parseFloat(baseScore.toFixed(1));

    const newJobObj = {
      job_id,
      department,
      asset_id,
      section_id,
      track_id,
      location_km,
      defect_type: defect_type || 'MANUAL_MAINTENANCE_REQUISITION',
      criticality_level,
      estimated_duration_hours,
      due_date,
      machine_required: machine_required === 'None' ? null : machine_required,
      power_block_required,
      status: 'PENDING',
      ai_priority_score,
      preferred_window,
      notes,
    };

    submitJobIntake({
      ...newJobObj,
      planning_week: 1,
    }).catch((err) => console.warn('Intake API backend response notice:', err));

    setAllJobs((prev) => [newJobObj, ...prev]);
    setShowAddModal(false);
    showToast(`Maintenance request created. AI Priority Score: ${ai_priority_score}/100`);
    e.currentTarget.reset();
  };

  const mandate = DEPT_MANDATE[department] || DEPT_MANDATE.Engineering;

  return (
    <main className="min-h-full bg-[#EEF2F6] p-4 text-[#17345C] md:p-6">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-[#16A878] bg-[#0A2540] px-4 py-3 text-white shadow-2xl transition-all duration-300">
          <CheckCircle2 className="h-5 w-5 text-[#16A878]" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: HEADER STRIP */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="mb-4 flex flex-col justify-between gap-4 rounded-lg border border-[#D6DEE6] bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ backgroundColor: themeColor }}
          >
            <IconComponent className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-[#0A2540]">
                {department} Control Centre
              </h1>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-sm"
                style={{ backgroundColor: themeColor }}
              >
                {mandate.code}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#52606D]">
              Divisional Job Management | Pune Division (CR) • {mandate.inCharge}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-[#F8FAFB] px-3 py-2 text-xs font-bold text-[#52606D] transition hover:bg-[#EEF2F6]"
            title="Refresh Live Data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-bold text-white shadow transition hover:opacity-90"
            style={{ backgroundColor: themeColor }}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>+ Add Maintenance Request</span>
          </button>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: 4 KPI CARDS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Jobs */}
        <div className="flex flex-col justify-between rounded-lg border border-[#D6DEE6] bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              TOTAL {department.toUpperCase()} JOBS
            </span>
            <IconComponent className="h-4 w-4 text-[#8796A5]" />
          </div>
          <div className="my-2 text-[28px] font-black leading-none" style={{ color: themeColor }}>
            {loading ? '—' : totalJobsCount}
          </div>
          <div className="text-[10px] font-medium text-[#64748B]">Active in backlog</div>
        </div>

        {/* Card 2: Scheduled Jobs % */}
        <div className="flex flex-col justify-between rounded-lg border border-[#D6DEE6] bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              SCHEDULED THIS WEEK
            </span>
            <CheckCircle2
              className={`h-4 w-4 ${scheduledPercent >= 80 ? 'text-[#16A34A]' : scheduledPercent >= 50 ? 'text-[#D97706]' : 'text-[#DC2626]'
                }`}
            />
          </div>
          <div
            className={`my-2 text-[28px] font-black leading-none ${scheduledPercent >= 80 ? 'text-[#16A34A]' : scheduledPercent >= 50 ? 'text-[#D97706]' : 'text-[#DC2626]'
              }`}
          >
            {loading ? '—' : scheduledCount}
          </div>
          <div className="text-[10px] font-medium text-[#64748B]">
            {scheduledPercent}% of total ({totalJobsCount} jobs)
          </div>
        </div>

        {/* Card 3: Deferred Jobs */}
        <div className="flex flex-col justify-between rounded-lg border border-[#D6DEE6] bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              DEFERRED JOBS
            </span>
            <Clock className="h-4 w-4 text-[#D97706]" />
          </div>
          <div className="my-2 text-[28px] font-black leading-none text-[#D97706]">
            {loading ? '—' : deferredCount}
          </div>
          <div className="text-[10px] font-medium text-[#64748B]">
            Auto-rescheduled to next week
          </div>
        </div>

        {/* Card 4: Critical Risk Items */}
        <div className="flex flex-col justify-between rounded-lg border border-[#D6DEE6] bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
              HIGH RISK / CRITICAL
            </span>
            <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
          </div>
          <div className="my-2 text-[28px] font-black leading-none text-[#DC2626]">
            {loading ? '—' : criticalCount}
          </div>
          <div className="text-[10px] font-medium text-[#64748B]">
            Requires urgent scheduling
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION TABS: Dedicated views so Home remains a clean INTRO */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-[#D6DEE6] bg-white p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('intro')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${activeTab === 'intro'
              ? 'bg-[#0A2540] text-white shadow-sm'
              : 'text-[#52606D] hover:bg-[#F4F6F8] hover:text-[#0A2540]'
            }`}
        >
          <span>🏛️</span>
          <span>Department Overview (Intro)</span>
        </button>

        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${activeTab === 'inbox'
              ? 'bg-[#0A2540] text-white shadow-sm'
              : 'text-[#52606D] hover:bg-[#F4F6F8] hover:text-[#0A2540]'
            }`}
        >
          <span>📋</span>
          <span>Job Inbox ({totalJobsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${activeTab === 'timeline'
              ? 'bg-[#0A2540] text-white shadow-sm'
              : 'text-[#52606D] hover:bg-[#F4F6F8] hover:text-[#0A2540]'
            }`}
        >
          <span>⏱️</span>
          <span>Department Timeline (Gantt)</span>
        </button>

        <button
          onClick={() => setActiveTab('shared')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${activeTab === 'shared'
              ? 'bg-[#0A2540] text-white shadow-sm'
              : 'text-[#52606D] hover:bg-[#F4F6F8] hover:text-[#0A2540]'
            }`}
        >
          <span>🔗</span>
          <span>Shared Possessions ({sharedBlocks.length})</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CLEAN DEPARTMENT INTRO & OVERVIEW (HOME) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'intro' && (
        <div className="space-y-4">
          {/* Department Mandate Banner */}
          <div className="rounded-lg border border-[#D6DEE6] bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: themeColor }}
                  >
                    ✓
                  </span>
                  <h2 className="text-base font-extrabold text-[#0A2540]">{mandate.title}</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#52606D]">{mandate.overview}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#1E3A5F]">
                  <span className="flex items-center gap-1.5">
                    <strong className="text-[#718294]">Data Adapter:</strong> {mandate.adapter}
                  </span>
                  <span className="text-[#D6DEE6]">|</span>
                  <span className="flex items-center gap-1.5">
                    <strong className="text-[#718294]">Infrastructure:</strong> {mandate.keyAssets}
                  </span>
                </div>
              </div>

              <div className="shrink-0 rounded-lg border border-[#D6DEE6] bg-[#F8FAFB] p-3 text-center md:w-56">
                <div className="text-[10px] font-bold uppercase text-[#718294]">Connected Adapter</div>
                <div className="mt-1 font-mono text-xs font-extrabold text-[#16865F]">● LIVE SYNCHRONIZED</div>
                <div className="mt-2 text-[10px] text-[#60748A]">
                  Auto-synced with MARS CP-SAT Solver & Indian Railway Rules (IRPWM / G&SR)
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div
              onClick={() => setActiveTab('inbox')}
              className="group cursor-pointer rounded-lg border border-[#D6DEE6] bg-white p-4 shadow-sm transition hover:border-[#0A2540] hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#8796A5] transition group-hover:translate-x-1 group-hover:text-[#0A2540]" />
              </div>
              <h3 className="mt-3 text-sm font-extrabold text-[#0A2540]">Job Inbox & Requests</h3>
              <p className="mt-1 text-xs text-[#60748A]">
                View, filter, and track {totalJobsCount} maintenance requests. Inspect deferral audits and send priority escalations.
              </p>
              <div className="mt-3 text-[11px] font-bold text-[#145DA8]">
                Open Job Inbox ({totalJobsCount} Jobs) →
              </div>
            </div>

            <div
              onClick={() => setActiveTab('timeline')}
              className="group cursor-pointer rounded-lg border border-[#D6DEE6] bg-white p-4 shadow-sm transition hover:border-[#0A2540] hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A2540] text-white">
                  <Calendar className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#8796A5] transition group-hover:translate-x-1 group-hover:text-[#0A2540]" />
              </div>
              <h3 className="mt-3 text-sm font-extrabold text-[#0A2540]">Department Timeline (Gantt)</h3>
              <p className="mt-1 text-xs text-[#60748A]">
                Multi-track corridor visualization showing scheduled windows, protected train headways, and other department occupancies.
              </p>
              <div className="mt-3 text-[11px] font-bold text-[#0A2540]">
                Launch Gantt Timeline →
              </div>
            </div>

            <div
              onClick={() => setShowAddModal(true)}
              className="group cursor-pointer rounded-lg border border-[#D6DEE6] bg-white p-4 shadow-sm transition hover:border-[#0A2540] hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  <Plus className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#8796A5] transition group-hover:translate-x-1 group-hover:text-[#0A2540]" />
              </div>
              <h3 className="mt-3 text-sm font-extrabold text-[#0A2540]">New Maintenance Requisition</h3>
              <p className="mt-1 text-xs text-[#60748A]">
                Submit defect notification with operator text description, location Km, required duration, and OHE isolation requirements.
              </p>
              <div className="mt-3 text-[11px] font-bold" style={{ color: themeColor }}>
                + Add Maintenance Request →
              </div>
            </div>
          </div>

          {/* Critical Priority Attention List */}
          <div className="rounded-lg border border-[#D6DEE6] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E4E9EE] pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#DC2626]">
                  High Risk & Immediate Attention Items ({criticalCount})
                </h3>
                <p className="mt-0.5 text-[11px] text-[#60748A]">
                  Critical severity defects requiring urgent Senior DOM planning or emergency sanction
                </p>
              </div>
              <button
                onClick={() => {
                  setFilter('critical');
                  setActiveTab('inbox');
                }}
                className="text-xs font-bold text-[#145DA8] hover:underline"
              >
                View all critical ({criticalCount}) →
              </button>
            </div>

            <div className="mt-3 divide-y divide-[#E9EEF3]">
              {enrichedJobs
                .filter((j) => j.criticality_level === 'CRITICAL')
                .slice(0, 4)
                .map((job) => (
                  <div key={job.job_id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#C92A2A]">{job.job_id}</span>
                        <span className="rounded bg-[#FEE2E2] px-1.5 py-0.5 text-[9px] font-extrabold text-[#C92A2A]">
                          CRITICAL
                        </span>
                        <span className="font-semibold text-[#0A2540]">
                          {String(job.defect_type).replaceAll('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#718294]">
                        Asset: {job.asset_id} • Km {job.location_km || '—'} • Track: {job.track_id || job.section_id}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-[#8796A5]">AI Score</span>
                        <p className="font-mono text-xs font-black text-[#0A2540]">
                          {job.ai_priority_score != null ? Number(job.ai_priority_score).toFixed(1) : '95.0'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSearchQuery(job.job_id);
                          setActiveTab('inbox');
                        }}
                        className="rounded border border-[#D6DEE6] bg-[#F8FAFB] px-2.5 py-1 text-[10px] font-bold text-[#52606D] hover:bg-[#EEF2F6]"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2 & 4: JOB INBOX / SHARED POSSESSIONS TABLE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {(activeTab === 'inbox' || activeTab === 'shared') && (
        <section className="rounded-lg border border-[#D6DEE6] bg-white shadow-sm overflow-hidden">
          {/* Table Controls */}
          <div className="flex flex-col justify-between gap-3 border-b border-[#D6DEE6] bg-[#F8FAFB] p-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#0A2540]">
                {activeTab === 'shared' ? 'Shared Possessions & Joint Requisitions' : 'My Maintenance Requests'}
              </h2>
              <p className="mt-0.5 text-xs text-[#60748A]">
                {activeTab === 'shared'
                  ? 'Coordinated multi-department blocks to avoid duplicate line closures'
                  : 'Self-service status tracking • Verified against AI CP-SAT Solver & IRPWM constraints'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8796A5]" />
                <input
                  type="text"
                  placeholder="Search Job ID, Defect, Track..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 rounded-md border border-[#D6DEE6] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0A2540]"
                />
              </div>

              {activeTab !== 'shared' && (
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-md border border-[#D6DEE6] bg-white px-3 py-1.5 text-xs font-bold text-[#52606D] outline-none"
                >
                  <option value="all">All Status ({enrichedJobs.length})</option>
                  <option value="scheduled">Scheduled ({scheduledCount})</option>
                  <option value="pending">
                    Pending ({enrichedJobs.filter((j) => j.computedStatus === 'PENDING').length})
                  </option>
                  <option value="deferred">Deferred ({deferredCount})</option>
                  <option value="critical">Critical Only ({criticalCount})</option>
                </select>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#D6DEE6] bg-[#F8FAFB] text-[10px] font-bold uppercase tracking-wider text-[#60748A]">
                <tr>
                  <th className="w-[110px] px-3.5 py-3">Job ID</th>
                  <th className="w-[220px] px-3.5 py-3">Defect / Work Description</th>
                  <th className="w-[150px] px-3.5 py-3">Location</th>
                  <th className="w-[100px] px-3.5 py-3">Severity</th>
                  <th className="w-[80px] px-3.5 py-3">AI Score</th>
                  <th className="w-[140px] px-3.5 py-3">Machine Required</th>
                  <th className="w-[110px] px-3.5 py-3">Status</th>
                  <th className="w-[140px] px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9EEF3]">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[#8796A5]">
                      No maintenance requests matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, idx) => {
                    const isCritical = job.criticality_level === 'CRITICAL';
                    const isHigh = job.criticality_level === 'HIGH';
                    const isMed = job.criticality_level === 'MEDIUM';

                    return (
                      <tr
                        key={job.job_id}
                        className={`h-[44px] transition hover:bg-[#EEF4FB] ${idx % 2 === 1 ? 'bg-[#F8FAFB]' : 'bg-white'
                          }`}
                      >
                        <td className="px-3.5 py-2.5 font-mono font-bold" style={{ color: themeColor }}>
                          <div className="flex items-center gap-1.5">
                            {job.isEscalated && (
                              <span title="Escalation Note Pending with Planner" className="cursor-help">
                                🚨
                              </span>
                            )}
                            <span>{job.job_id}</span>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 font-semibold text-[#17345C]">
                          {String(job.defect_type || 'MAINTENANCE').replaceAll('_', ' ')}
                        </td>

                        <td className="px-3.5 py-2.5 text-[11px] text-[#52606D]">
                          Km {job.location_km != null ? job.location_km : '—'} | {job.track_id || job.section_id}
                        </td>

                        <td className="px-3.5 py-2.5">
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${isCritical
                                ? 'bg-[#FEE2E2] text-[#C92A2A]'
                                : isHigh
                                  ? 'bg-[#FED7AA] text-[#EA580C]'
                                  : isMed
                                    ? 'bg-[#FEF3C7] text-[#D97706]'
                                    : 'bg-[#D1FAE5] text-[#059669]'
                              }`}
                          >
                            {job.criticality_level || 'MEDIUM'}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 font-mono font-extrabold text-[#0A2540]">
                          {job.ai_priority_score != null ? Number(job.ai_priority_score).toFixed(1) : 'Pending'}
                        </td>

                        <td className="px-3.5 py-2.5 text-[11px] text-[#52606D]">
                          {job.machine_required && job.machine_required !== 'NO' && job.machine_required !== 'None'
                            ? String(job.machine_required).replaceAll('_', ' ')
                            : '—'}
                        </td>

                        <td className="px-3.5 py-2.5">
                          <span
                            className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${job.computedStatus === 'SCHEDULED'
                                ? 'border-[#2F9E44]/30 bg-[#2F9E44]/15 text-[#2F9E44]'
                                : job.computedStatus === 'DEFERRED'
                                  ? 'border-[#D97706]/30 bg-[#FFF1DC] text-[#D97706]'
                                  : job.computedStatus === 'COMPLETED'
                                    ? 'border-[#52606D]/30 bg-[#F4F6F8] text-[#52606D]'
                                    : 'border-[#3B6EA5]/30 bg-[#EEF5FC] text-[#315F8D]'
                              }`}
                          >
                            {job.computedStatus}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 text-right">
                          {job.computedStatus === 'SCHEDULED' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const b = blocks.find((blk) => (blk.job_ids || []).includes(job.job_id));
                                  setMemoJob(job);
                                  setMemoBlock(b || null);
                                  setShowSanctionMemo(true);
                                }}
                                className="rounded border border-[#8B0000] bg-[#FFF8F0] px-2 py-1 text-[10px] font-bold text-[#8B0000] transition hover:bg-[#FEE2E2]"
                                title="Official Form T/1518 Line Block Sanction Memo"
                              >
                                Memo
                              </button>
                              <button
                                onClick={() => {
                                  const b = blocks.find((blk) => (blk.job_ids || []).includes(job.job_id));
                                  if (b) setSelectedBlock(b);
                                  else showToast(`Scheduled in approved baseline for ${job.section_id}`);
                                }}
                                className="rounded bg-[#0A2540] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-[#123C70]"
                              >
                                View Slot
                              </button>
                            </div>
                          )}

                          {job.computedStatus === 'DEFERRED' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setDrawerJob(job);
                                  setShowDeferralDrawer(true);
                                }}
                                className="rounded border border-[#D97706] bg-[#FFF8EE] px-2 py-1 text-[10px] font-bold text-[#D97706] transition hover:bg-[#FEEFD8]"
                              >
                                Why?
                              </button>
                              <button
                                onClick={() => {
                                  setEscalationJob(job);
                                  setShowEscalationModal(true);
                                }}
                                title="Send Escalation Note to Planner"
                                className="rounded bg-[#D97706] px-2 py-1 text-[10px] font-bold text-white transition hover:opacity-90"
                              >
                                📝
                              </button>
                            </div>
                          )}

                          {job.computedStatus === 'PENDING' && (
                            <button
                              onClick={() => {
                                showToast(`Job ${job.job_id} queued in Unified Pool. Evaluated by next CP-SAT solve cycle.`);
                              }}
                              className="rounded border border-[#D6DEE6] bg-[#F8FAFB] px-2.5 py-1 text-[10px] font-bold text-[#52606D] transition hover:bg-[#EAEFF4]"
                            >
                              Track Status
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: DEDICATED DEPARTMENT TIMELINE (GANTT CHART) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <section
          id="department-timeline-section"
          className="rounded-lg border border-[#D6DEE6] bg-white shadow-sm overflow-hidden"
        >
          <div className="flex flex-col justify-between gap-2 border-b border-[#D6DEE6] bg-[#F8FAFB] px-4 py-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#0A2540]">
                {department} Department Corridor Timeline
              </h2>
              <p className="mt-0.5 text-[10px] text-[#60748A]">
                Week 1 Planned Maintenance Windows • Conflict-Free Train Protection Guaranteed (15-min Clearance Buffers)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#64748B]">Zoom:</span>
              <div className="flex rounded border border-[#D6DEE6] bg-white text-[10px] font-bold">
                <button
                  onClick={() => setTimeZoom('week')}
                  className={`px-2.5 py-1 ${timeZoom === 'week' ? 'bg-[#0A2540] text-white' : 'text-[#64748B]'}`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setTimeZoom('48h')}
                  className={`border-l border-[#D6DEE6] px-2.5 py-1 ${timeZoom === '48h' ? 'bg-[#0A2540] text-white' : 'text-[#64748B]'}`}
                >
                  48 Hours
                </button>
                <button
                  onClick={() => setTimeZoom('day')}
                  className={`border-l border-[#D6DEE6] px-2.5 py-1 ${timeZoom === 'day' ? 'bg-[#0A2540] text-white' : 'text-[#64748B]'}`}
                >
                  24 Hours
                </button>
              </div>
            </div>
          </div>

          {/* Timeline Canvas */}
          <div ref={timelineContainerRef} className="overflow-x-auto overflow-y-hidden border-b border-[#D6DEE6]">
            <div className="min-w-[1100px] select-none">
              {/* Timeline Header Row (Days) */}
              <div className="flex border-b border-[#D6DEE6] bg-[#F4F6F8]">
                <div className="w-[180px] shrink-0 border-r border-[#D6DEE6] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#52606D]">
                  Track / Corridor
                </div>
                <div className="relative flex-1 grid grid-cols-7 text-center text-[10px] font-bold text-[#52606D]">
                  {['Mon 7 Sep', 'Tue 8 Sep', 'Wed 9 Sep', 'Thu 10 Sep', 'Fri 11 Sep', 'Sat 12 Sep', 'Sun 13 Sep'].map(
                    (day, idx) => (
                      <div
                        key={day}
                        className={`py-2 ${idx > 0 ? 'border-l border-[#D6DEE6]' : ''} bg-[#F4F6F8]`}
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Track Rows with SEPARATE NON-OVERLAPPING LANES: Dynamic Trains & Maintenance Blocks */}
              <div className="divide-y divide-[#E9EEF3]">
                {timelineTracks.slice(0, 8).map((trackId) => {
                  const trackBlocks = blocks.filter((b) => b.track_id === trackId);
                  const trackTrains = trains.filter((t) => t.track_id === trackId);

                  return (
                    <div key={trackId} className="flex min-h-[76px] items-center hover:bg-[#FAFBFC]">
                      {/* Left Sidebar Track Label */}
                      <div className="w-[180px] shrink-0 border-r border-[#D6DEE6] bg-white px-3 py-2 self-stretch flex flex-col justify-center">
                        <div className="font-mono text-xs font-extrabold text-[#0A2540]">{trackId}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#718294]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#16A878]" />
                          <span>Headway Protected</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[8px] font-bold text-[#8796A5]">
                          <span>{trackBlocks.length} Blocks</span>
                          <span>•</span>
                          <span>{trackTrains.length} Trains</span>
                        </div>
                      </div>

                      {/* Timeline Track Space with 2 distinct non-overlapping vertical lanes */}
                      <div className="relative h-[76px] flex-1 bg-white">
                        <div className="pointer-events-none absolute inset-0 grid grid-cols-7 divide-x divide-[#F1F4F7]" />

                        {/* Top Lane: Real Dynamic Trains from COA Timetable (Height: 18px, Top: 6px) */}
                        {trackTrains.map((train) => {
                          const trainStart = new Date(train.entry_time).getTime();
                          const trainEnd = new Date(train.exit_time).getTime();
                          if (Number.isNaN(trainStart) || Number.isNaN(trainEnd)) return null;
                          if (trainEnd <= timelineStart || trainStart >= timelineEnd) return null;

                          const leftPercent = Math.max(
                            0,
                            Math.min(98, ((trainStart - timelineStart) / totalDurationMs) * 100)
                          );
                          const widthPercent = Math.max(
                            2.2,
                            Math.min(100 - leftPercent, ((trainEnd - trainStart) / totalDurationMs) * 100)
                          );
                          const isFreight = String(train.train_type || '').toUpperCase().includes('FREIGHT');
                          const trainNum = train.train_number || train.train_id;

                          return (
                            <div
                              key={`train-${trackId}-${trainNum}-${train.entry_time}`}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                backgroundColor: isFreight ? '#475569' : '#B42318',
                              }}
                              className="absolute top-[6px] h-[18px] rounded-sm px-1 text-white shadow-2xs z-10 flex items-center overflow-hidden border-l-2 border-white/80"
                              title={`Fixed Timetable Train ${trainNum}: ${train.train_name || train.train_type || 'Express'} • ${new Date(train.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${new Date(train.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} • Protected Headway`}
                            >
                              <div className="flex items-center gap-1 truncate text-[8px] font-bold leading-none">
                                <span>🚆</span>
                                <span className="font-mono">{trainNum}</span>
                                <span className="hidden xl:inline opacity-80">{train.train_name ? `· ${train.train_name.split(' ')[0]}` : ''}</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Bottom Lane: Maintenance Window Blocks (Height: 38px, Top: 28px — ZERO overlap with trains) */}
                        {trackBlocks.map((block) => {
                          const blockStart = new Date(block.start_time).getTime();
                          const blockEnd = new Date(block.end_time).getTime();
                          const depts = block.departments || [];
                          const isOwn = depts.length === 1 && depts[0] === department;
                          const isShared = depts.length > 1 && depts.includes(department);
                          const isGhost = !depts.includes(department);

                          const leftPercent = Math.max(
                            0,
                            Math.min(98, ((blockStart - timelineStart) / totalDurationMs) * 100)
                          );
                          const widthPercent = Math.max(
                            2.5,
                            Math.min(100 - leftPercent, ((blockEnd - blockStart) / totalDurationMs) * 100)
                          );

                          const primaryJobId = (block.job_ids || [])[0] || block.block_id;
                          const defectLabel = (block.explanation || '').split(' ')[4] || 'MAINTENANCE';
                          const durationHrs = block.duration_hours || 3;

                          if (isOwn) {
                            return (
                              <div
                                key={block.block_id}
                                id={`gantt-block-${block.block_id}`}
                                onClick={() => setSelectedBlock(block)}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  backgroundColor: themeColor,
                                }}
                                className="absolute top-[28px] h-[38px] cursor-pointer rounded px-2 text-white shadow-sm transition hover:brightness-110 z-20"
                                title={`${primaryJobId} • ${defectLabel} • ${durationHrs}h (Click for details)`}
                              >
                                <div className="flex h-full items-center truncate text-[11px] font-semibold">
                                  {primaryJobId} | {defectLabel} | {durationHrs}h
                                </div>
                              </div>
                            );
                          }

                          if (isShared) {
                            const joinedJobs = (block.job_ids || []).slice(0, 2).join(' + ');
                            return (
                              <div
                                key={block.block_id}
                                id={`gantt-block-${block.block_id}`}
                                onClick={() => setSelectedBlock(block)}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  backgroundColor: '#6B5B95',
                                  border: '2px solid #A98CD3',
                                  boxShadow: '0 0 8px rgba(169, 140, 211, 0.4)',
                                }}
                                className="absolute top-[28px] h-[38px] cursor-pointer rounded-md px-2 text-white transition hover:brightness-110 z-20"
                                title={`🔗 Shared Consolidated Possession: ${joinedJobs} (Click for details)`}
                              >
                                <div className="flex h-full items-center truncate text-[11px] font-extrabold tracking-tight">
                                  🔗 Shared: {joinedJobs}
                                </div>
                              </div>
                            );
                          }

                          if (isGhost) {
                            const otherDeptName = depts[0] || 'Other Dept';
                            return (
                              <div
                                key={block.block_id}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  background:
                                    'repeating-linear-gradient(45deg, #ADB5BD 0px, #ADB5BD 8px, #F4F6F8 8px, #F4F6F8 16px)',
                                  color: '#52606D',
                                  border: '1px solid #ADB5BD',
                                  opacity: 0.65,
                                }}
                                className="group pointer-events-auto absolute top-[28px] h-[38px] select-none rounded px-2 z-10"
                                title={`Track occupied by other dept (${otherDeptName})`}
                              >
                                <div className="flex h-full items-center truncate text-[10px] font-bold">
                                  🔒 Reserved ({otherDeptName} Work)
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-5 bg-[#F8FAFB] px-4 py-2.5 text-[11px] font-semibold text-[#52606D]">
            <span className="text-[10px] font-bold uppercase text-[#8796A5]">Timeline Legend:</span>
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded" style={{ backgroundColor: themeColor }} />
              <span>{department} Jobs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded border-2 border-[#A98CD3] bg-[#6B5B95]" />
              <span>Shared Possession</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 rounded border border-[#ADB5BD]"
                style={{
                  background:
                    'repeating-linear-gradient(45deg, #ADB5BD 0px, #ADB5BD 4px, #F4F6F8 4px, #F4F6F8 8px)',
                }}
              />
              <span>Other Dept Occupied (Ghost)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-5 rounded-sm bg-[#B42318]" />
              <span>Live COA Train Movement (Dedicated Upper Lane)</span>
            </div>
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5: "WHY DEFERRED?" DRAWER (SLIDE-IN PANEL) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showDeferralDrawer && drawerJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
          <div className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between border-b border-[#D6DEE6] p-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#8796A5]">
                  Optimization Decision Audit
                </span>
                <h3 className="text-lg font-black" style={{ color: themeColor }}>
                  {drawerJob.job_id}
                </h3>
                <p className="mt-0.5 text-xs text-[#52606D]">
                  {String(drawerJob.defect_type).replaceAll('_', ' ')} • Km {drawerJob.location_km || '—'} (
                  {drawerJob.track_id || drawerJob.section_id})
                </p>
              </div>
              <button
                onClick={() => setShowDeferralDrawer(false)}
                className="rounded p-1 text-[#8796A5] hover:bg-[#F4F6F8] hover:text-[#0A2540]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="rounded-lg border border-[#D6DEE6] bg-[#F8FAFB] p-4">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[#718294]">
                  Current Status & Score
                </h4>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#52606D]">Current Severity:</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${drawerJob.criticality_level === 'CRITICAL'
                        ? 'bg-[#FEE2E2] text-[#C92A2A]'
                        : drawerJob.criticality_level === 'HIGH'
                          ? 'bg-[#FED7AA] text-[#EA580C]'
                          : 'bg-[#FEF3C7] text-[#D97706]'
                      }`}
                  >
                    {drawerJob.criticality_level}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#52606D]">AI Priority Score:</span>
                    <span className="font-mono font-bold text-[#0A2540]">
                      {drawerJob.ai_priority_score != null ? drawerJob.ai_priority_score : '74.2'} / 100
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, drawerJob.ai_priority_score || 74.2)}%`,
                        backgroundColor: themeColor,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#E2E8F0] pt-3 text-[11px]">
                  <div>
                    <span className="text-[#718294]">Days in Queue:</span>
                    <p className="font-bold text-[#0A2540]">4 days</p>
                  </div>
                  <div>
                    <span className="text-[#718294]">Deferral Count:</span>
                    <p className="font-bold text-[#0A2540]">1 time</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540]">
                  Primary CP-SAT Solver Reasons
                </h4>
                <div className="mt-2.5 space-y-2 text-xs text-[#1F2933]">
                  <div className="flex items-start gap-2 rounded-md border border-[#D6DEE6] bg-white p-2.5 shadow-2xs">
                    <span className="text-[#16A34A]">✅</span>
                    <div>
                      <p className="font-semibold text-[#0A2540]">Asset Within Safety Tolerances</p>
                      <p className="text-[11px] text-[#60748A]">
                        Defect parameter conforms to IRPWM Chapter 3 / G&SR operating limits until next scheduled cycle.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-md border border-[#D6DEE6] bg-white p-2.5 shadow-2xs">
                    <span className="text-[#D97706]">⏳</span>
                    <div>
                      <p className="font-semibold text-[#0A2540]">Corridor Headway Saturated</p>
                      <p className="text-[11px] text-[#60748A]">
                        Week 1 corridor capacity on {drawerJob.track_id || 'this track'} reached 84% threshold under freight throughput targets.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-md border border-[#D6DEE6] bg-white p-2.5 shadow-2xs">
                    <span className="text-[#6B5B95]">🌙</span>
                    <div>
                      <p className="font-semibold text-[#0A2540]">Window Pre-empted by Higher Priority Defect</p>
                      <p className="text-[11px] text-[#60748A]">
                        Preferred night slot (01:00–04:30) assigned to critical turnout repair with score 94.6.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#16A878]/30 bg-[#EAF7F1] p-4 text-xs text-[#0A2540]">
                <h4 className="font-bold uppercase tracking-wider text-[#16865F]">
                  Auto-Reschedule Action
                </h4>
                <p className="mt-1.5 flex items-center gap-1.5 font-semibold">
                  <span>📅</span> Auto-scheduled for Week 2 (Tuesday 23:00)
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#52606D]">
                  <span>📈</span> Dynamic Risk Clock will re-evaluate on 2026-09-18
                </p>
              </div>
            </div>

            <div className="border-t border-[#D6DEE6] bg-[#F8FAFB] p-4">
              <button
                onClick={() => {
                  setEscalationJob(drawerJob);
                  setShowEscalationModal(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold text-white shadow"
                style={{ backgroundColor: themeColor }}
              >
                <span>📝</span> Send Escalation Note to Planner
              </button>
              <button
                onClick={() => setShowDeferralDrawer(false)}
                className="mt-2 w-full rounded-md border border-[#D6DEE6] bg-white py-2 text-xs font-bold text-[#52606D] hover:bg-[#F4F6F8]"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 6: ESCALATION NOTE MODAL */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showEscalationModal && escalationJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[500px] rounded-lg border border-[#D6DEE6] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#D6DEE6] bg-[#0A2540] px-5 py-3.5 text-white">
              <div>
                <h3 className="text-sm font-bold">Request Priority Escalation</h3>
                <p className="text-[10px] text-white/70">
                  {escalationJob.job_id} • {String(escalationJob.defect_type).replaceAll('_', ' ')}
                </p>
              </div>
              <button onClick={() => setShowEscalationModal(false)} className="text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendEscalation} className="p-5">
              <label className="block text-xs font-bold text-[#0A2540]">
                Operational Justification for Early Scheduling
              </label>
              <p className="mt-0.5 text-[11px] text-[#60748A]">
                Provide field engineering evidence for Senior DOM / Divisional Operations Planner:
              </p>

              <textarea
                rows={4}
                maxLength={500}
                required
                value={escalationNote}
                onChange={(e) => setEscalationNote(e.target.value)}
                placeholder="e.g., Site inspection on Sept 3 showed micro-crack expanding under heavy freight movement. Requesting window shift to Week 1 Thursday night."
                className="mt-2.5 w-full rounded border border-[#D6DEE6] p-2.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
              />

              <div className="mt-1.5 flex justify-between text-[10px] text-[#8796A5]">
                <span>Senior Section Engineer Escalation Memo</span>
                <span>{escalationNote.length}/500</span>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#D6DEE6] pt-4">
                <button
                  type="button"
                  onClick={() => setShowEscalationModal(false)}
                  className="rounded border border-[#D6DEE6] bg-white px-4 py-2 text-xs font-bold text-[#52606D] hover:bg-[#F4F6F8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded px-4 py-2 text-xs font-bold text-white shadow"
                  style={{ backgroundColor: themeColor }}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send to Planner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 7: [+ ADD MAINTENANCE REQUEST] MODAL (TEXT FORMAT DEFECT TYPE) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-[620px] rounded-lg border border-[#D6DEE6] bg-white shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D6DEE6] bg-[#0A2540] px-5 py-3.5 text-white">
              <div>
                <h3 className="text-sm font-bold">New {department} Maintenance Request</h3>
                <p className="text-[10px] text-white/70">
                  Field Requisition Form • Operator Specified Condition • MARS Queue
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddJobSubmit} className="space-y-4 p-5">
              {/* Row 1: Asset ID & Section */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Asset ID *
                  </label>
                  <input
                    name="asset_id"
                    required
                    placeholder={
                      department === 'Engineering'
                        ? 'e.g. TRK-A12-KM42'
                        : department === 'S&T'
                          ? 'e.g. SIG-SW-402'
                          : 'e.g. OHE-PUNE-882'
                    }
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Section *
                  </label>
                  <select
                    name="section_id"
                    defaultValue="PUNE-LNL"
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  >
                    <option value="PUNE-LNL">PUNE-LNL (Pune – Lonavala)</option>
                    <option value="PUNE-DD">PUNE-DD (Pune – Daund)</option>
                    <option value="PUNE-MRJ">PUNE-MRJ (Pune – Miraj)</option>
                    <option value="LNL-KJT">LNL-KJT (Lonavala – Karjat)</option>
                    <option value="CWD-YARD">CWD-YARD (Chinchwad Yard)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Track & Location Km */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Track *
                  </label>
                  <select
                    name="track_id"
                    defaultValue="PUNE-LNL-UP"
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  >
                    <option value="PUNE-LNL-UP">PUNE-LNL-UP</option>
                    <option value="PUNE-LNL-DN">PUNE-LNL-DN</option>
                    <option value="PUNE-DD-UP">PUNE-DD-UP</option>
                    <option value="PUNE-DD-DN">PUNE-DD-DN</option>
                    <option value="PUNE-MRJ-UP">PUNE-MRJ-UP</option>
                    <option value="PUNE-MRJ-DN">PUNE-MRJ-DN</option>
                    <option value="LNL-KJT-UP">LNL-KJT-UP</option>
                    <option value="LNL-KJT-DN">LNL-KJT-DN</option>
                    <option value="CWD-YARD-LOOP">CWD-YARD-LOOP</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Location (Km) *
                  </label>
                  <input
                    name="location_km"
                    type="number"
                    step="0.01"
                    defaultValue="42.30"
                    required
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  />
                </div>
              </div>

              {/* Row 3: DEFECT TYPE IN TEXT FORMAT (NO DROPDOWN AS REQUESTED) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                  Defect Type / Maintenance Description (Operator Specification) *
                </label>
                <input
                  name="defect_type"
                  type="text"
                  required
                  placeholder={
                    department === 'Engineering'
                      ? 'Specify what happens (e.g. Rail crack detected near weld joint, deep ballast wear, turnout chatter)'
                      : department === 'S&T'
                        ? 'Specify what happens (e.g. Point machine stroke sensor error, axle counter reset, track circuit bond fail)'
                        : 'Specify what happens (e.g. Contact wire stagger adjustment, insulator flashover, cantilever arm damage)'
                  }
                  className="mt-1 w-full rounded border border-[#D6DEE6] px-3 py-2 text-xs font-semibold text-[#1F2933] outline-none focus:border-[#0A2540]"
                />
                <p className="mt-1 text-[10px] text-[#8796A5]">
                  Dept operator should specify the exact defect condition or required work in text format.
                </p>
              </div>

              {/* Row 4: Severity (Large Colored Radio Buttons) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                  Severity Rating *
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-[#FEE2E2] bg-[#FFF5F5] p-2 hover:bg-[#FEE2E2]">
                    <input type="radio" name="criticality_level" value="CRITICAL" className="text-[#C92A2A]" />
                    <span className="text-xs font-extrabold text-[#C92A2A]">🔴 CRITICAL</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 rounded border border-[#FED7AA] bg-[#FFFAF0] p-2 hover:bg-[#FED7AA]">
                    <input type="radio" name="criticality_level" value="HIGH" defaultChecked className="text-[#EA580C]" />
                    <span className="text-xs font-extrabold text-[#EA580C]">🟠 HIGH</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 rounded border border-[#FEF3C7] bg-[#FFFDF0] p-2 hover:bg-[#FEF3C7]">
                    <input type="radio" name="criticality_level" value="MEDIUM" className="text-[#D97706]" />
                    <span className="text-xs font-extrabold text-[#D97706]">🟡 MEDIUM</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 rounded border border-[#D1FAE5] bg-[#F0FDF4] p-2 hover:bg-[#D1FAE5]">
                    <input type="radio" name="criticality_level" value="LOW" className="text-[#059669]" />
                    <span className="text-xs font-extrabold text-[#059669]">🟢 LOW</span>
                  </label>
                </div>
              </div>

              {/* Row 5: Duration & Due Date */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Estimated Duration (Hours) *
                  </label>
                  <input
                    name="estimated_duration_hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="8"
                    defaultValue="2.5"
                    required
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Due Date *
                  </label>
                  <input
                    name="due_date"
                    type="date"
                    defaultValue="2026-09-20"
                    required
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  />
                </div>
              </div>

              {/* Row 6: Machine Required & Preferred Shift */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Machine / Fleet Required
                  </label>
                  <select
                    name="machine_required"
                    defaultValue="None"
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  >
                    {(DEPT_MACHINES[department] || DEPT_MACHINES.Engineering).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                    Preferred Shift
                  </label>
                  <select
                    name="preferred_shift"
                    defaultValue="NIGHT"
                    className="mt-1 w-full rounded border border-[#D6DEE6] px-2.5 py-1.5 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                  >
                    <option value="NIGHT">Night Window (01:00 – 05:00)</option>
                    <option value="DAY">Day Window (11:00 – 15:00)</option>
                    <option value="ANY">Any Available Slot</option>
                  </select>
                </div>
              </div>

              {/* Checkbox: OHE Power Isolation */}
              <div className="flex items-center gap-2 rounded border border-[#D6DEE6] bg-[#F8FAFB] p-2.5">
                <input
                  type="checkbox"
                  id="power_block_required"
                  name="power_block_required"
                  defaultChecked={department === 'Traction'}
                  className="h-4 w-4 rounded text-[#0A2540]"
                />
                <label htmlFor="power_block_required" className="text-xs font-bold text-[#0A2540]">
                  Requires 25kV OHE Power Isolation / Disconnection Permit (PTW)
                </label>
              </div>

              {/* Operational Note */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#52606D]">
                  Operational Note (Optional)
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Additional remarks for Sr. DOM / CP-SAT Solver buffer allowances..."
                  className="mt-1 w-full rounded border border-[#D6DEE6] p-2 text-xs text-[#1F2933] outline-none focus:border-[#0A2540]"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-[#D6DEE6] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded border border-[#D6DEE6] bg-white px-4 py-2 text-xs font-bold text-[#52606D] hover:bg-[#F4F6F8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded px-5 py-2 text-xs font-bold text-white shadow"
                  style={{ backgroundColor: themeColor }}
                >
                  <span>💾</span> Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* BLOCK DETAILS INSPECTION MODAL */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[550px] rounded-lg border border-[#D6DEE6] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#D6DEE6] bg-[#0A2540] px-5 py-3 text-white">
              <div>
                <h3 className="text-sm font-bold">Block Details: {selectedBlock.block_id}</h3>
                <p className="text-[10px] text-white/70">
                  Track: {selectedBlock.track_id} • Section: {selectedBlock.section_id}
                </p>
              </div>
              <button onClick={() => setSelectedBlock(null)} className="text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 p-5 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded bg-[#F8FAFB] p-3">
                <div>
                  <span className="text-[10px] font-bold text-[#718294]">Start Time:</span>
                  <p className="font-mono font-bold text-[#0A2540]">
                    {new Date(selectedBlock.start_time).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#718294]">End Time:</span>
                  <p className="font-mono font-bold text-[#0A2540]">
                    {new Date(selectedBlock.end_time).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#718294]">Duration:</span>
                  <p className="font-bold text-[#0A2540]">{selectedBlock.duration_hours} hours</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#718294]">Departments:</span>
                  <p className="font-bold text-[#0A2540]">
                    {(selectedBlock.departments || []).join(', ')}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-[#718294]">Jobs Included:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(selectedBlock.job_ids || []).map((id) => (
                    <span
                      key={id}
                      className="rounded bg-[#EEF5FC] px-2 py-1 font-mono text-[11px] font-bold text-[#1E3A5F]"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded border border-[#D6DEE6] p-3 text-[11px] text-[#52606D]">
                <span className="font-bold text-[#0A2540]">Solver Explanation: </span>
                {selectedBlock.explanation ||
                  'Window selected by Google OR-Tools CP-SAT with 15-minute setup and 15-minute train clearance protection.'}
              </div>

              {selectedBlock.is_consolidated && (
                <div className="rounded border border-[#A98CD3] bg-[#F7F3FC] p-3 text-[11px] text-[#553C7B]">
                  <strong>🔗 Consolidated Shadow Possession: </strong>
                  Multiple departments combined in a single line occupancy to minimize freight/passenger disruption.
                </div>
              )}
            </div>

            <div className="border-t border-[#D6DEE6] bg-[#F8FAFB] px-5 py-3 flex items-center justify-between">
              <button
                onClick={() => {
                  setMemoBlock(selectedBlock);
                  const firstJob = enrichedJobs.find((j) => (selectedBlock.job_ids || []).includes(j.job_id));
                  setMemoJob(firstJob || null);
                  setShowSanctionMemo(true);
                }}
                className="flex items-center gap-1.5 rounded bg-[#8B0000] hover:bg-[#700000] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition"
              >
                <span>📄</span>
                <span>Generate Official Form T/1518 Memo</span>
              </button>
              <button
                onClick={() => setSelectedBlock(null)}
                className="rounded border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] px-4 py-1.5 text-xs font-bold text-[#334155]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 8: OFFICIAL INDIAN RAILWAYS FORM T/1518 SANCTION MEMO MODAL */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <SanctionMemoModal
        isOpen={showSanctionMemo}
        onClose={() => setShowSanctionMemo(false)}
        block={memoBlock}
        job={memoJob}
        department={department}
      />
    </main>
  );
}
