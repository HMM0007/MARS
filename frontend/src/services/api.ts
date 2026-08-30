import { getSession, type Department } from '../auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders(): Record<string, string> {
  const session = getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`
  return headers
}

async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { ...getAuthHeaders(), ...(options.headers || {}) } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status})`
    if (response.status === 401) throw new Error('Your MARS session has expired. Please log in again.')
    if (response.status === 403) throw new Error('You do not have permission to perform this MARS operation.')
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export async function fetchJobs(filters?: { department?: string; status?: string; section?: string; priority?: string }) {
  const params = new URLSearchParams()
  if (filters?.department && filters.department !== 'All') params.set('department', filters.department)
  if (filters?.status && filters.status !== 'All') params.set('status', filters.status)
  if (filters?.section) params.set('section', filters.section)
  if (filters?.priority && filters.priority !== 'All') params.set('priority', filters.priority)
  return apiRequest(`/api/jobs${params.toString() ? `?${params.toString()}` : ''}`)
}
export async function createJob(jobData: Record<string, any>) { return apiRequest('/api/jobs', { method: 'POST', body: JSON.stringify(jobData) }) }
export async function updateJob(jobId: string, updates: Record<string, any>) { return apiRequest(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'PUT', body: JSON.stringify(updates) }) }
export async function deleteJob(jobId: string) { return apiRequest(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }) }

export async function fetchConflicts() { return apiRequest('/api/conflicts') }
export async function fetchNotifications(department?: Department | string) { return apiRequest(`/api/notifications${department ? `?department=${encodeURIComponent(department)}` : ''}`) }
export async function fetchAnalytics() { return apiRequest('/api/analytics') }
export async function fetchSections() { return apiRequest('/api/sections') }
export async function fetchBlocks() { return apiRequest('/api/blocks') }
export async function fetchTrains() { return apiRequest('/api/trains') }
export async function fetchAssets() { return apiRequest('/api/assets') }

export async function fetchPlans(filters?: { status?: string; section_id?: string; block_id?: string; job_id?: string }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.section_id) params.set('section_id', filters.section_id)
  if (filters?.block_id) params.set('block_id', filters.block_id)
  if (filters?.job_id) params.set('job_id', filters.job_id)
  return apiRequest(`/api/plan${params.toString() ? `?${params.toString()}` : ''}`)
}
export async function fetchPlan(planId: string) { return apiRequest(`/api/plan/jobs/${encodeURIComponent(planId)}`) }
export async function fetchPlanSummary() { return apiRequest('/api/plan/summary') }
export async function fetchPlanJobs(filters?: Record<string, string>) { const params = new URLSearchParams(); Object.entries(filters || {}).forEach(([key, value]) => { if (value) params.set(key, value) }); return apiRequest(`/api/plan/jobs${params.toString() ? `?${params.toString()}` : ''}`) }
export async function fetchPlanBlocks() { return apiRequest('/api/plan/blocks') }
export async function fetchPlanSections() { return apiRequest('/api/plan/sections') }
export async function checkAllocation(jobId: string, blockId: string) { return apiRequest('/api/plan/check-allocation', { method: 'POST', body: JSON.stringify({ job_id: jobId, block_id: blockId }) }) }
export async function generateOptimizationPlan() { return apiRequest('/api/plan/optimize', { method: 'POST' }) }

export async function triggerReplanning(constraint: Record<string, any>) { return apiRequest('/api/replanning', { method: 'POST', body: JSON.stringify(constraint) }) }

export { API_BASE_URL }
