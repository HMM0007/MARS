/**
 * MARS API Service Client
 * Maintenance Allocation and Resource Scheduling System
 */

const getBaseUrl = () => {
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
};
const BASE_URL = getBaseUrl();

const requestJson = async (url, options = {}) => {
  try {
    let response = await fetch(url, options).catch(async (err) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return fetch(url.replace(/^https?:\/\/[^/]+/, ''), options);
      }
      throw err;
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail?.message || errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Request failed for ${url}:`, error);
    throw error;
  }
};

const normalizeWeeklyPlan = (data) => {
  const metrics = data.weekly_metrics || data.metrics || {};
  const blocks = data.scheduled_blocks || data.blocks || [];
  return {
    ...data,
    status: data.status || data.solver_status || 'UNKNOWN',
    solver_status: data.solver_status || data.status || 'UNKNOWN',
    solve_time_seconds: Number(data.solve_time_seconds ?? metrics.solve_time_seconds ?? 0),
    metrics: {
      ...metrics,
      total_jobs_evaluated: Number(metrics.total_jobs_evaluated ?? 0),
      total_jobs_scheduled: Number(metrics.total_jobs_scheduled ?? metrics.scheduled_jobs_count ?? 0),
      total_jobs_deferred: Number(metrics.total_jobs_deferred ?? metrics.deferred_jobs_count ?? 0),
      total_blocks: Number(metrics.total_blocks ?? metrics.total_blocks_created ?? 0),
      consolidated_blocks: Number(metrics.consolidated_blocks ?? metrics.consolidated_blocks_count ?? 0),
      active_conflicts: Number(metrics.active_conflicts ?? 0),
      risk_coverage_percentage: Number(metrics.risk_coverage_percentage ?? 0),
      solve_time_seconds: Number(data.solve_time_seconds ?? metrics.solve_time_seconds ?? 0),
    },
    blocks,
    deferred_jobs: data.deferred_jobs || [],
  };
};

export const fetchAllScoredJobs = () => requestJson(`${BASE_URL}/api/v1/core/jobs/all-scored`);
export const fetchMonthlyPlan = () => requestJson(`${BASE_URL}/api/v1/core/plan/monthly`);
export const fetchWhatIfOptions = () => requestJson(`${BASE_URL}/api/v1/what-if/options`);
export const simulateWhatIf = (payload) => requestJson(`${BASE_URL}/api/v1/what-if/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const promoteWhatIfScenario = (payload) => requestJson(`${BASE_URL}/api/v1/what-if/promote-candidate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

/**
 * Weekly view is baseline-aware: once a Planner has approved a plan, normal UI
 * reads return that protected baseline. New jobs are shown through the separate
 * pending-revision workflow until the revision is explicitly approved.
 */
export const fetchWeeklyPlan = async () => {
  try {
    const approved = await requestJson(`${BASE_URL}/api/v1/core/plan/weekly/approved`);
    if (approved?.approved && approved.plan) {
      return normalizeWeeklyPlan({
        ...approved.plan,
        baseline_approved: true,
        baseline_revision: approved.revision,
        baseline_governance: {
          mode: 'APPROVED_BASELINE',
          revision: approved.revision,
          approved_at: approved.approved_at,
          approved_by: approved.approved_by,
          requires_planner_approval: false,
        },
      });
    }
  } catch (err) {
    console.warn('Approved baseline lookup failed; falling back to weekly solver:', err);
  }
  return normalizeWeeklyPlan(await requestJson(`${BASE_URL}/api/v1/core/plan/weekly`));
};

export const fetchApprovedWeeklyPlan = () => requestJson(`${BASE_URL}/api/v1/core/plan/weekly/approved`);

// Normalize the backend's empty state ({ pending: false, revision: null })
// so callers can safely use a simple truthy check for an actual pending revision.
export const fetchPendingWeeklyRevision = async () => {
  const data = await requestJson(`${BASE_URL}/api/v1/core/plan/weekly/pending-revision`);
  return data?.pending ? data : null;
};

export const fetchApprovedPlanHistory = () => requestJson(`${BASE_URL}/api/v1/core/plan/weekly/approved-history`);
export const fetchFreshWeeklyPlan = async (week = 1) => {
  const data = await requestJson(`${BASE_URL}/api/v1/core/plan/weekly?week=${week}&fresh=true`);
  return normalizeWeeklyPlan(data);
};

export const approveWeeklyPlan = (payload) => requestJson(`${BASE_URL}/api/v1/core/plan/weekly/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const submitJobIntake = (payload) => requestJson(`${BASE_URL}/api/v1/core/jobs/intake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const submitEmergencyJob = (payload) => requestJson(`${BASE_URL}/api/v1/core/jobs/emergency`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

export const fetchTMSJobs = () => requestJson(`${BASE_URL}/api/v1/adapters/tms/jobs`);
export const fetchSMMSJobs = () => requestJson(`${BASE_URL}/api/v1/adapters/smms/jobs`);
export const fetchTDMSJobs = () => requestJson(`${BASE_URL}/api/v1/adapters/tdms/jobs`);
export const fetchCOATimetable = () => requestJson(`${BASE_URL}/api/v1/adapters/coa/timetable`);
export const fetchFreightForecast = () => requestJson(`${BASE_URL}/api/v1/adapters/coa/freight-forecast`);
export const pushToBDMS = (schedulePayload) => requestJson(`${BASE_URL}/api/v1/adapters/bdms/push-sanctions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedulePayload) });
export const fetchHealth = () => requestJson(`${BASE_URL}/health`);
export const fetchDatasetStatus = () => requestJson(`${BASE_URL}/api/v1/dataset/status`);
export const apiRequest = (endpoint, options = {}) => requestJson(`${BASE_URL}${endpoint}`, options);

export const fetchDepartmentJobs = async (department) => {
  const endpoints = {
    Engineering: `${BASE_URL}/api/v1/adapters/tms/jobs`,
    'S&T': `${BASE_URL}/api/v1/adapters/smms/jobs`,
    Traction: `${BASE_URL}/api/v1/adapters/tdms/jobs`,
  };
  const url = endpoints[department] || endpoints.Engineering;
  try {
    const data = await requestJson(url);
    return Array.isArray(data) ? data : (data?.jobs || []);
  } catch (err) {
    console.warn(`Failed to fetch from ${url}, falling back to all-scored:`, err);
    const scored = await fetchAllScoredJobs().catch(() => []);
    const list = Array.isArray(scored) ? scored : (scored?.jobs || []);
    return list.filter((j) => (j.department || '').toLowerCase() === (department || '').toLowerCase());
  }
};
