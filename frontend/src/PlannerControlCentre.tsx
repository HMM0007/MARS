import { useEffect, useMemo, useState } from 'react'
import { clearSession, type MarsSession } from './auth'
import {
  fetchConflicts,
  fetchJobs,
  fetchNotifications,
  fetchPlanBlocks,
  fetchPlanJobs,
  fetchPlanSummary,
  fetchPlans,
  fetchTrains,
  generateOptimizationPlan,
  triggerReplanning,
} from './services/api'

type PlannerControlCentreProps = {
  session: MarsSession
  onLogout: () => void
}

type Job = Record<string, any>
type Block = Record<string, any>

const departments = ['All', 'Engineering', 'S&T', 'Traction']
const views = ['Control Centre', 'Requests', 'Block Allocation', 'Proposed Plan', 'Re-planning', 'Alerts']

function statusTone(value: string) {
  const v = String(value || '').toUpperCase()
  if (v.includes('CONFLICT') || v.includes('CRITICAL') || v.includes('UNAVAILABLE')) return 'danger'
  if (v.includes('HIGH') || v.includes('ATTENTION') || v.includes('UNSCHEDULED')) return 'warning'
  if (v.includes('SCHEDULED') || v.includes('APPROVED') || v.includes('AVAILABLE')) return 'success'
  return 'neutral'
}

function fmt(value: any, fallback = '—') {
  return value === undefined || value === null || value === '' ? fallback : String(value)
}

export default function PlannerControlCentre({ session, onLogout }: PlannerControlCentreProps) {
  const [view, setView] = useState('Control Centre')
  const [department, setDepartment] = useState('All')
  const [jobs, setJobs] = useState<Job[]>([])
  const [planJobs, setPlanJobs] = useState<Job[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [trains, setTrains] = useState<any[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null)
  const [selectedDisruption, setSelectedDisruption] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const dept = department === 'All' ? undefined : department
      const [jobRes, planJobRes, blockRes, trainRes, conflictRes, notificationRes, summaryRes, planRes] = await Promise.all([
        fetchJobs({ department: dept }),
        fetchPlanJobs({ department: dept || '' }),
        fetchPlanBlocks(),
        fetchTrains(),
        fetchConflicts(),
        fetchNotifications('Divisional Planner'),
        fetchPlanSummary(),
        fetchPlans(),
      ])
      setJobs(jobRes?.jobs || [])
      setPlanJobs(planJobRes?.jobs || [])
      setBlocks(blockRes?.blocks || [])
      setTrains(trainRes?.trains || [])
      setConflicts(conflictRes?.conflicts || [])
      setNotifications(notificationRes?.notifications || [])
      setSummary(summaryRes || null)
      setPlans(planRes?.plan || [])
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Unable to load planner data.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [department])

  const filteredJobs = useMemo(() => jobs.filter(job => department === 'All' || job.department === department), [jobs, department])
  const scheduled = useMemo(() => planJobs.filter(job => String(job.plan_status || '').toUpperCase() === 'SCHEDULED'), [planJobs])
  const unscheduled = useMemo(() => planJobs.filter(job => String(job.plan_status || '').toUpperCase() !== 'SCHEDULED'), [planJobs])
  const conflictBlocks = useMemo(() => new Set(conflicts.flatMap(c => [c.block_id, c.block].filter(Boolean).map(String))), [conflicts])

  const runOptimization = async () => {
    setBusy(true)
    setMessage({ tone: 'info', text: 'Running the existing MARS CP-SAT optimizer. This may take a few seconds.' })
    try {
      const result = await generateOptimizationPlan()
      setMessage({ tone: 'success', text: `Optimization ${fmt(result?.status, 'completed')}. The generated plan has been promoted to the Current Active Plan.` })
      await load()
      setView('Proposed Plan')
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Optimization failed. Check the backend log for the exact error.' })
    } finally {
      setBusy(false)
    }
  }

  const runReplanning = async () => {
    if (!selectedDisruption) {
      setMessage({ tone: 'danger', text: 'Select a block before starting re-planning.' })
      return
    }
    setBusy(true)
    try {
      const result = await triggerReplanning({ event_type: 'BLOCK_UNAVAILABLE', block_id: selectedDisruption })
      const s = result?.summary || {}
      setMessage({ tone: 'success', text: `Re-planning completed: ${s.affected_jobs ?? 0} affected, ${s.rescheduled_jobs ?? 0} rescheduled, ${s.unchanged_jobs ?? 0} unchanged.` })
      await load()
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Re-planning failed.' })
    } finally {
      setBusy(false)
    }
  }

  const logout = () => { clearSession(); onLogout() }

  return (
    <div className="planner-shell">
      <aside className="planner-sidebar">
        <div className="planner-brand">
          <div className="planner-rail-symbol">रेल</div>
          <div><strong>MARS</strong><span>Planner Control Centre</span></div>
        </div>
        <div className="planner-role"><span>DIVISIONAL PLANNER</span><strong>{session.displayName}</strong><small>{session.employeeId}</small></div>
        <nav>
          <div className="planner-nav-label">PLANNING WORKFLOW</div>
          {views.map(item => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item}</button>)}
        </nav>
        <button className="planner-logout" onClick={logout}>Logout</button>
      </aside>

      <main className="planner-main">
        <header className="planner-header">
          <div><span className="planner-eyebrow">MARS / DIVISIONAL PLANNING</span><h1>{view}</h1><p>One operational workflow for requests, blocks, trains, optimization and re-planning.</p></div>
          <div className="planner-header-actions"><select value={department} onChange={e => setDepartment(e.target.value)}><option value="All">All Departments</option>{departments.slice(1).map(d => <option key={d}>{d}</option>)}</select><button onClick={load}>Refresh</button></div>
        </header>

        {message && <div className={`planner-message ${message.tone}`}><strong>{message.tone === 'danger' ? 'Action required' : message.tone === 'success' ? 'Completed' : 'Working'}</strong><span>{message.text}</span><button onClick={() => setMessage(null)}>×</button></div>}

        {view === 'Control Centre' && <>
          <section className="planner-kpis">
            <div><span>Maintenance Requests</span><strong>{summary?.total_jobs ?? jobs.length}</strong><small>{summary?.unscheduled_jobs ?? unscheduled.length} unscheduled</small></div>
            <div><span>Scheduled Jobs</span><strong>{summary?.scheduled_jobs ?? scheduled.length}</strong><small>{summary?.schedule_rate ?? 0}% schedule rate</small></div>
            <div><span>Available Blocks</span><strong>{summary?.available_blocks ?? blocks.filter(b => String(b.status).toUpperCase() === 'AVAILABLE').length}</strong><small>{summary?.used_blocks ?? 0} used in active plan</small></div>
            <div><span>Active Conflicts</span><strong className={conflicts.length ? 'danger-number' : ''}>{conflicts.length}</strong><small>train / department constraints</small></div>
            <div><span>Block Utilization</span><strong>{fmt(summary?.block_utilization, '0')}%</strong><small>from current active plan</small></div>
          </section>

          <section className="planner-workflow">
            <div className="workflow-step done"><b>1</b><div><strong>Collect Requests</strong><span>{jobs.length} requests loaded</span></div></div>
            <div className="workflow-line" />
            <div className={`workflow-step ${blocks.length ? 'done' : ''}`}><b>2</b><div><strong>Check Blocks</strong><span>{blocks.length} block slots</span></div></div>
            <div className="workflow-line" />
            <div className={`workflow-step ${trains.length ? 'done' : ''}`}><b>3</b><div><strong>Check Trains</strong><span>{trains.length} movements</span></div></div>
            <div className="workflow-line" />
            <div className={`workflow-step ${scheduled.length ? 'done' : ''}`}><b>4</b><div><strong>Review Plan</strong><span>{scheduled.length} scheduled</span></div></div>
            <button className="primary-action" disabled={busy} onClick={runOptimization}>{busy ? 'Running…' : 'Run Optimization'}</button>
          </section>

          <div className="planner-grid-2">
            <section className="planner-card"><div className="card-heading"><div><h2>Requests needing planning</h2><p>Jobs are grouped by department so the planner can see the whole division.</p></div><button onClick={() => setView('Requests')}>View all</button></div>
              <div className="department-strip">{departments.map(d => <button key={d} className={department === d ? 'active' : ''} onClick={() => setDepartment(d)}>{d}<b>{d === 'All' ? jobs.length : jobs.filter(j => j.department === d).length}</b></button>)}</div>
              <div className="compact-table"><table><thead><tr><th>Job</th><th>Department</th><th>Section</th><th>Priority</th><th>Status</th></tr></thead><tbody>{filteredJobs.slice(0, 8).map(job => <tr key={job.job_id} onClick={() => setSelectedJob(job)}><td><strong>{fmt(job.job_id)}</strong><small>{fmt(job.work_type || job.description)}</small></td><td>{fmt(job.department)}</td><td>{fmt(job.section || job.section_id)}</td><td><span className={`tag ${statusTone(job.priority)}`}>{fmt(job.priority)}</span></td><td><span className={`tag ${statusTone(job.status)}`}>{fmt(job.status)}</span></td></tr>)}</tbody></table></div>
            </section>
            <section className="planner-card"><div className="card-heading"><div><h2>Operational risks</h2><p>Conflicts that can block or delay maintenance.</p></div><button onClick={() => setView('Alerts')}>View alerts</button></div>
              {conflicts.slice(0, 4).map((c, i) => <button className="risk-row" key={c.id || i} onClick={() => setView('Alerts')}><span className={`risk-icon ${statusTone(c.severity || c.type)}`}>!</span><div><strong>{fmt(c.message || c.description || c.title, 'Operational conflict')}</strong><small>{fmt(c.block_id || c.block || c.section_id || c.section, 'Network constraint')} · {fmt(c.severity, 'Attention')}</small></div></button>)}
              {!conflicts.length && <div className="empty-state">No active conflicts detected.</div>}
            </section>
          </div>
        </>}

        {view === 'Requests' && <section className="planner-card full-card"><div className="card-heading"><div><h2>All maintenance requests</h2><p>Planner-wide catalogue. Select a request to inspect its planning attributes.</p></div></div><div className="compact-table"><table><thead><tr><th>Job</th><th>Work</th><th>Department</th><th>Section</th><th>Block</th><th>Duration</th><th>Priority</th><th>Status</th></tr></thead><tbody>{filteredJobs.map(job => <tr key={job.job_id} onClick={() => setSelectedJob(job)}><td><strong>{fmt(job.job_id)}</strong></td><td>{fmt(job.work_type || job.description)}</td><td>{fmt(job.department)}</td><td>{fmt(job.section || job.section_id)}</td><td>{fmt(job.block || job.block_id)}</td><td>{fmt(job.duration_min)} min</td><td><span className={`tag ${statusTone(job.priority)}`}>{fmt(job.priority)}</span></td><td><span className={`tag ${statusTone(job.status)}`}>{fmt(job.status)}</span></td></tr>)}</tbody></table></div></section>}

        {view === 'Block Allocation' && <section className="planner-card full-card"><div className="card-heading"><div><h2>Block allocation & safety slots</h2><p>Available blocks are shown with time windows, restrictions, assignments and conflict signals.</p></div><button className="primary-small" disabled={busy} onClick={runOptimization}>{busy ? 'Running…' : 'Run Optimizer'}</button></div><div className="block-grid">{blocks.map(block => <button key={block.block_id} className={`block-card ${conflictBlocks.has(String(block.block_id)) ? 'has-conflict' : ''}`} onClick={() => setSelectedBlock(block)}><div className="block-card-top"><strong>{fmt(block.block_id)}</strong><span className={`tag ${statusTone(block.status)}`}>{fmt(block.status)}</span></div><span>{fmt(block.section_id, 'Section unknown')}</span><strong>{fmt(block.start_time)} – {fmt(block.end_time)}</strong><small>{fmt(block.block_date)}</small><small>{fmt(block.block_type)} · {fmt(block.restrictions, 'No restriction')}</small><div className="block-util"><span>{fmt(block.assigned_job_count, '0')} jobs</span><b>{fmt(block.utilization, '0')}%</b></div></button>)}</div></section>}

        {view === 'Proposed Plan' && <section className="planner-card full-card"><div className="card-heading"><div><h2>Current active / proposed maintenance plan</h2><p>This is the plan produced by the backend. Review it before treating it as operationally approved.</p></div><button className="primary-small" disabled={busy} onClick={runOptimization}>{busy ? 'Running…' : 'Generate New Plan'}</button></div><div className="plan-summary-row"><span><b>{scheduled.length}</b> scheduled</span><span><b>{unscheduled.length}</b> unscheduled</span><span><b>{fmt(summary?.block_utilization, '0')}%</b> block utilization</span></div><div className="compact-table"><table><thead><tr><th>Job</th><th>Department</th><th>Section</th><th>Block</th><th>Window</th><th>Status</th><th>Reason</th></tr></thead><tbody>{planJobs.map(job => <tr key={job.job_id}><td><strong>{fmt(job.job_id)}</strong><small>{fmt(job.work_type || job.description)}</small></td><td>{fmt(job.department)}</td><td>{fmt(job.section_id || job.section)}</td><td>{fmt(job.block_id || job.block)}</td><td>{job.scheduled_start ? `${job.scheduled_start} → ${job.scheduled_end}` : 'Not scheduled'}</td><td><span className={`tag ${statusTone(job.plan_status)}`}>{fmt(job.plan_status)}</span></td><td>{fmt(job.optimizer_reason_detail || job.optimizer_reason_code, '—')}</td></tr>)}</tbody></table></div></section>}

        {view === 'Re-planning' && <section className="planner-grid-2"><section className="planner-card"><div className="card-heading"><div><h2>Operational disruption</h2><p>Mark a block unavailable and calculate the impact on the current plan.</p></div></div><label className="field-label">Affected block<select value={selectedDisruption} onChange={e => setSelectedDisruption(e.target.value)}><option value="">Select block…</option>{blocks.map(b => <option key={b.block_id} value={b.block_id}>{b.block_id} · {b.section_id} · {b.block_date} {b.start_time}–{b.end_time}</option>)}</select></label><button className="primary-action wide" disabled={busy || !selectedDisruption} onClick={runReplanning}>{busy ? 'Re-planning…' : 'Execute Re-plan'}</button></section><section className="planner-card"><div className="card-heading"><div><h2>What will change?</h2><p>The backend returns before/after planning information after execution.</p></div></div><div className="replan-metrics"><div><span>Current scheduled</span><strong>{scheduled.length}</strong></div><div><span>Affected by selected block</span><strong>{selectedDisruption ? planJobs.filter(j => String(j.block_id) === selectedDisruption).length : 0}</strong></div><div><span>Train movements</span><strong>{trains.length}</strong></div></div><div className="risk-list">{conflicts.slice(0, 5).map((c, i) => <div key={c.id || i}><strong>{fmt(c.message || c.description || c.title)}</strong><small>{fmt(c.block_id || c.block || c.section_id || c.section)}</small></div>)}{!conflicts.length && <div className="empty-state">No current conflict requires re-planning.</div>}</div></section></section>}

        {view === 'Alerts' && <section className="planner-card full-card"><div className="card-heading"><div><h2>Planner alerts & operational conflicts</h2><p>Review the affected job, section/block and severity before acting.</p></div></div><div className="alert-list">{[...conflicts, ...notifications].map((item, i) => <div className="planner-alert" key={item.id || item.notification_id || i}><span className={`risk-icon ${statusTone(item.severity || item.type)}`}>!</span><div><strong>{fmt(item.message || item.description || item.title, 'Operational notification')}</strong><small>Job: {fmt(item.job_id || item.affected_job_id)} · Block: {fmt(item.block_id || item.block)} · Section: {fmt(item.section_id || item.section)} · Severity: {fmt(item.severity, 'INFO')}</small></div></div>)}{!conflicts.length && !notifications.length && <div className="empty-state">No planner alerts.</div>}</div></section>}

        <footer className="planner-footer">MARS · Maintenance Allocation & Routing System · Planner view is backed by the live MARS REST APIs.</footer>
      </main>

      {selectedJob && <div className="planner-modal-backdrop" onClick={() => setSelectedJob(null)}><div className="planner-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelectedJob(null)}>×</button><span className="planner-eyebrow">MAINTENANCE REQUEST</span><h2>{fmt(selectedJob.job_id)}</h2><p>{fmt(selectedJob.description || selectedJob.work_type)}</p><div className="detail-grid"><span>Department<strong>{fmt(selectedJob.department)}</strong></span><span>Section<strong>{fmt(selectedJob.section || selectedJob.section_id)}</strong></span><span>Block<strong>{fmt(selectedJob.block || selectedJob.block_id)}</strong></span><span>Priority<strong>{fmt(selectedJob.priority)}</strong></span><span>Duration<strong>{fmt(selectedJob.duration_min)} min</strong></span><span>Deadline<strong>{fmt(selectedJob.deadline)}</strong></span></div></div></div>}
      {selectedBlock && <div className="planner-modal-backdrop" onClick={() => setSelectedBlock(null)}><div className="planner-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelectedBlock(null)}>×</button><span className="planner-eyebrow">BLOCK SLOT</span><h2>{fmt(selectedBlock.block_id)}</h2><p>{fmt(selectedBlock.section_id)} · {fmt(selectedBlock.block_date)} · {fmt(selectedBlock.start_time)}–{fmt(selectedBlock.end_time)}</p><div className="detail-grid"><span>Status<strong>{fmt(selectedBlock.status)}</strong></span><span>Type<strong>{fmt(selectedBlock.block_type)}</strong></span><span>Restriction<strong>{fmt(selectedBlock.restrictions, 'None')}</strong></span><span>Isolation<strong>{fmt(selectedBlock.isolation_required)}</strong></span><span>Assigned jobs<strong>{fmt(selectedBlock.assigned_job_count, '0')}</strong></span><span>Utilization<strong>{fmt(selectedBlock.utilization, '0')}%</strong></span></div></div></div>}
    </div>
  )
}
