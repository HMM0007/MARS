/**
 * MARS 2.0 API Service Client
 * Multi-department AI-based Railway Scheduling System 2.0
 * Connects to FastAPI backend at http://127.0.0.1:8000
 */

// Dynamically use origin matching or fallback to backend port 8000
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // If hostname is localhost, use http://localhost:8000 to match same-origin scheme
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:8000';
    }
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
};

const BASE_URL = getBaseUrl();

/**
 * Generic request helper with error handling and proxy fallback
 */
const requestJson = async (url, options = {}) => {
  try {
    let response = await fetch(url, options).catch(async (err) => {
      // If direct cross-origin fails (e.g. Chrome PNA restriction), try via Vite proxy
      if (url.startsWith('http://')) {
        const path = url.replace(/^http:\/\/[^/]+/, '');
        return await fetch(path, options);
      }
      throw err;
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail?.message ||
        errorData.detail ||
        `HTTP ${response.status}: ${response.statusText}`
      );
    }
    return await response.json();
  } catch (error) {
    console.error(`API Request failed for ${url}:`, error);
    throw error;
  }
};

/**
 * Normalizes backend weekly-plan payload structure so that
 * all UI components receive consistent properties.
 */
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

// ============================================================================
// CORE ENGINE ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/core/jobs/all-scored
 * Fetches all maintenance jobs with XGBoost priority scoring and risk escalation
 */
export const fetchAllScoredJobs = () =>
  requestJson(`${BASE_URL}/api/v1/core/jobs/all-scored`);

/**
 * GET /api/v1/core/plan/monthly
 * Fetches Level 1 Strategic Monthly Plan (Section clustering + bin packing)
 */
export const fetchMonthlyPlan = () =>
  requestJson(`${BASE_URL}/api/v1/core/plan/monthly`);

/**
 * GET /api/v1/core/plan/weekly
 * Fetches Level 2 Tactical Weekly Plan (Unified Google OR-Tools CP-SAT Solver)
 */
export const fetchWeeklyPlan = async () => {
  const data = await requestJson(`${BASE_URL}/api/v1/core/plan/weekly`);
  return normalizeWeeklyPlan(data);
};

// ============================================================================
// CRIS ADAPTER ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/adapters/tms/jobs
 * Track Management System (Engineering maintenance jobs)
 */
export const fetchTMSJobs = () =>
  requestJson(`${BASE_URL}/api/v1/adapters/tms/jobs`);

/**
 * GET /api/v1/adapters/smms/jobs
 * Signaling Maintenance Management System (S&T jobs)
 */
export const fetchSMMSJobs = () =>
  requestJson(`${BASE_URL}/api/v1/adapters/smms/jobs`);

/**
 * GET /api/v1/adapters/tdms/jobs
 * Traction Distribution Management System (OHE jobs)
 */
export const fetchTDMSJobs = () =>
  requestJson(`${BASE_URL}/api/v1/adapters/tdms/jobs`);

/**
 * GET /api/v1/adapters/coa/timetable
 * Control Office Application (Passenger train movements)
 */
export const fetchCOATimetable = () =>
  requestJson(`${BASE_URL}/api/v1/adapters/coa/timetable`);

/**
 * GET /api/v1/adapters/coa/freight-forecast
 * Control Office Application (Freight path predictions)
 */
export const fetchFreightForecast = () =>
  requestJson(`${BASE_URL}/api/v1/adapters/coa/freight-forecast`);

/**
 * POST /api/v1/adapters/bdms/push-sanctions
 * Block Demand Management System (Outbound sanction push)
 */
export const pushToBDMS = (schedulePayload) =>
  requestJson(`${BASE_URL}/api/v1/adapters/bdms/push-sanctions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedulePayload),
  });

// ============================================================================
// SYSTEM DIAGNOSTICS & UTILITY
// ============================================================================

export const fetchHealth = () =>
  requestJson(`${BASE_URL}/health`);

export const fetchDatasetStatus = () =>
  requestJson(`${BASE_URL}/api/v1/dataset/status`);

export const apiRequest = (endpoint, options = {}) =>
  requestJson(`${BASE_URL}${endpoint}`, options);
