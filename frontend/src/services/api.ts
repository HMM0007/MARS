import { getSession, type Department } from '../auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders(): Record<string, string> {
  const session = getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }
  return headers
}

async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status})`
    if (response.status === 401) {
      throw new Error('Your MARS session has expired. Please log in again.')
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to perform this MARS operation.')
    }
    throw new Error(detail)
  }

  if (response.status === 204) return undefined as T
  return response.json()
}

/* -------------------------------------------------------------------------- */
/* Maintenance Jobs API                                                       */
/* -------------------------------------------------------------------------- */
export async function fetchJobs(filters?: {
  department?: string
  status?: string
  section?: string
  priority?: string
}) {
  const params = new URLSearchParams()
  if (filters?.department && filters.department !== 'All') params.set('department', filters.department)
  if (filters?.status && filters.status !== 'All') params.set('status', filters.status)
  if (filters?.section) params.set('section', filters.section)
  if (filters?.priority && filters.priority !== 'All') params.set('priority', filters.priority)

  return apiRequest(`/api/jobs${params.toString() ? `?${params.toString()}` : ''}`)
}

export async function createJob(jobData: Record<string, any>) {
  return apiRequest('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(jobData),
  })
}

export async function updateJob(jobId: string, updates: Record<string, any>) {
  return apiRequest(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function deleteJob(jobId: string) {
  return apiRequest(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  })
}

/* -------------------------------------------------------------------------- */
/* Conflicts, Notifications & Analytics                                       */
/* -------------------------------------------------------------------------- */
export async function fetchConflicts() {
  return apiRequest('/api/conflicts')
}

export async function fetchNotifications(department?: Department | string) {
  const params = department ? `?department=${encodeURIComponent(department)}` : ''
  return apiRequest(`/api/notifications${params}`)
}

export async function fetchAnalytics() {
  return apiRequest('/api/analytics')
}

/* -------------------------------------------------------------------------- */
/* Railway operational data                                                    */
/* -------------------------------------------------------------------------- */
export async function fetchSections() {
  return apiRequest('/api/sections')
}

export async function fetchBlocks() {
  return apiRequest('/api/blocks')
}

export async function fetchTrains() {
  return apiRequest('/api/trains')
}

export async function fetchAssets() {
  return apiRequest('/api/assets')
}

/* -------------------------------------------------------------------------- */
/* Plans & Optimization                                                        */
/* -------------------------------------------------------------------------- */
export async function fetchPlans() {
  return apiRequest('/api/plans')
}

export async function fetchPlan(planId: string) {
  return apiRequest(`/api/plans/${encodeURIComponent(planId)}`)
}

export async function generateOptimizationPlan() {
  return apiRequest('/api/plans/generate', { method: 'POST' })
}

export async function approvePlan(planId: string) {
  return apiRequest(`/api/plans/${encodeURIComponent(planId)}/approve`, { method: 'POST' })
}

export async function rejectPlan(planId: string) {
  return apiRequest(`/api/plans/${encodeURIComponent(planId)}/reject`, { method: 'POST' })
}

/* -------------------------------------------------------------------------- */
/* Re-planning                                                                 */
/* -------------------------------------------------------------------------- */
export async function triggerReplanning(constraint: Record<string, any>) {
  return apiRequest('/api/replanning', {
    method: 'POST',
    body: JSON.stringify(constraint),
  })
}

export { API_BASE_URL }
