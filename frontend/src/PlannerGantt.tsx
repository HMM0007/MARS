import { useMemo, useState } from 'react'
import './planner-gantt.css'

type Job = Record<string, any>
type Train = Record<string, any>

type Props = {
  jobs: Job[]
  trains: Train[]
  onBack?: () => void
}

const text = (value: any, fallback = '—') => value === undefined || value === null || value === '' ? fallback : String(value)

function parseDate(value: any) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function minutes(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

function fmtTime(value: any) {
  const d = parseDate(value)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : text(value)
}

function fmtDate(value: any) {
  const d = parseDate(value)
  return d ? d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : text(value)
}

function trainTime(t: Train) {
  return t.arrival || t.arrival_time || t.start_time || ''
}

export default function PlannerGantt({ jobs, trains, onBack }: Props) {
  const scheduled = useMemo(() => jobs.filter(j => String(j.plan_status || '').toUpperCase() === 'SCHEDULED' && j.scheduled_start), [jobs])
  const firstScheduled = useMemo(() => scheduled.map(j => parseDate(j.scheduled_start)).filter(Boolean).sort((a: any, b: any) => a.getTime() - b.getTime())[0] as Date | undefined, [scheduled])
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = firstScheduled || new Date()
    return d.toISOString().slice(0, 10)
  })
  const [department, setDepartment] = useState('ALL')
  const [showTrains, setShowTrains] = useState(true)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const dayJobs = useMemo(() => scheduled.filter(j => {
    const d = parseDate(j.scheduled_start)
    if (!d || d.toISOString().slice(0, 10) !== selectedDate) return false
    return department === 'ALL' || String(j.department || '') === department
  }).sort((a, b) => (parseDate(a.scheduled_start)?.getTime() || 0) - (parseDate(b.scheduled_start)?.getTime() || 0)), [scheduled, selectedDate, department])

  const departments = useMemo(() => Array.from(new Set(scheduled.map(j => String(j.department || '')).filter(Boolean))), [scheduled])
  const dayTrains = useMemo(() => trains.filter(t => {
    const raw = t.schedule_date || t.date || t.scheduled_date
    return !raw || String(raw).slice(0, 10) === selectedDate
  }).slice(0, 30), [trains, selectedDate])

  const dayStart = 6 * 60
  const dayEnd = 22 * 60
  const total = dayEnd - dayStart

  const position = (job: Job) => {
    const start = parseDate(job.scheduled_start)!
    const end = parseDate(job.scheduled_end) || new Date(start.getTime() + 30 * 60000)
    const left = Math.max(0, Math.min(100, ((minutes(start) - dayStart) / total) * 100))
    const right = Math.max(left + 3, Math.min(100, ((minutes(end) - dayStart) / total) * 100))
    return { left, width: right - left }
  }

  const trainPosition = (train: Train) => {
    const raw = trainTime(train)
    const match = String(raw).match(/(\d{1,2}):(\d{2})/)
    if (!match) return null
    const value = Number(match[1]) * 60 + Number(match[2])
    return Math.max(0, Math.min(100, ((value - dayStart) / total) * 100))
  }

  return <section className="pg-card">
    <header className="pg-header">
      <div>
        <div className="pg-eyebrow">MARS / PLANNER</div>
        <h2>Maintenance Schedule</h2>
        <p>See exactly when each maintenance job is planned and which block it uses.</p>
      </div>
      {onBack && <button className="pg-back" onClick={onBack}>← Proposed Plan</button>}
    </header>

    <div className="pg-kpis">
      <div><b>{dayJobs.length}</b><span>Jobs scheduled today</span></div>
      <div><b>{jobs.filter(j => String(j.plan_status || '').toUpperCase() !== 'SCHEDULED').length}</b><span>Jobs still unscheduled</span></div>
      <div><b>{dayTrains.length}</b><span>Train movements</span></div>
      <div><b>{departments.length}</b><span>Departments</span></div>
    </div>

    <div className="pg-controls">
      <label>Date <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedJob(null) }} /></label>
      <label>Department <select value={department} onChange={e => setDepartment(e.target.value)}><option value="ALL">All departments</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label>
      <button className={showTrains ? 'active' : ''} onClick={() => setShowTrains(v => !v)}>{showTrains ? 'Hide trains' : 'Show trains'}</button>
      <button onClick={() => { const d = firstScheduled || new Date(); setSelectedDate(d.toISOString().slice(0, 10)); setDepartment('ALL') }}>Plan date</button>
    </div>

    <div className="pg-help"><span>Maintenance jobs</span><span className="job-key" /> <span className="train-key" /> Train arrival <em>Click a job for details</em></div>

    <div className="pg-timeline">
      <div className="pg-time-header">
        <div className="pg-label-head">JOB</div>
        <div className="pg-hours">{Array.from({ length: 17 }, (_, i) => <span key={i}>{String(i + 6).padStart(2, '0')}:00</span>)}</div>
      </div>

      {dayJobs.length === 0 && <div className="pg-empty"><strong>No scheduled jobs for this date.</strong><span>Try another date or select “All departments”.</span></div>}

      {dayJobs.map((job, index) => {
        const p = position(job)
        const dept = String(job.department || '').toLowerCase().replace('&', 'and').replace(/[^a-z]/g, '')
        return <button className={`pg-job-row ${selectedJob === job ? 'selected' : ''}`} key={`${job.job_id}-${index}`} onClick={() => setSelectedJob(job)}>
          <div className="pg-job-label"><strong>{text(job.job_id)}</strong><span>{text(job.department)} · {text(job.section_id || job.section)} · {text(job.block_id || job.block)}</span></div>
          <div className="pg-track">
            <div className="pg-grid-lines">{Array.from({ length: 17 }, (_, i) => <i key={i} />)}</div>
            <div className={`pg-job-bar ${dept}`} style={{ left: `${p.left}%`, width: `${p.width}%` }}><strong>{text(job.job_id)}</strong><small>{fmtTime(job.scheduled_start)}–{fmtTime(job.scheduled_end)}</small></div>
          </div>
        </button>
      })}

      {showTrains && dayTrains.length > 0 && <div className="pg-trains">
        <div className="pg-train-label"><strong>TRAINS</strong><span>{dayTrains.length} movements</span></div>
        <div className="pg-train-track">
          <div className="pg-grid-lines">{Array.from({ length: 17 }, (_, i) => <i key={i} />)}</div>
          {dayTrains.map((train, index) => { const left = trainPosition(train); return left === null ? null : <button className="pg-train-dot" key={index} style={{ left: `${left}%` }} title={`Train ${text(train.train_no || train.train_id)} at ${text(trainTime(train))}`}><span>{text(train.train_no || train.train_id)}</span></button> })}
        </div>
      </div>}
    </div>

    {selectedJob && <aside className="pg-details">
      <div><div className="pg-eyebrow">SELECTED JOB</div><h3>{text(selectedJob.job_id)}</h3></div>
      <button onClick={() => setSelectedJob(null)} aria-label="Close details">×</button>
      <div className="pg-detail-grid">
        <span>Department <b>{text(selectedJob.department)}</b></span>
        <span>Work type <b>{text(selectedJob.work_type || selectedJob.description)}</b></span>
        <span>Section <b>{text(selectedJob.section_id || selectedJob.section)}</b></span>
        <span>Block <b>{text(selectedJob.block_id || selectedJob.block)}</b></span>
        <span>Start <b>{fmtDate(selectedJob.scheduled_start)} · {fmtTime(selectedJob.scheduled_start)}</b></span>
        <span>End <b>{fmtTime(selectedJob.scheduled_end)}</b></span>
      </div>
    </aside>}
  </section>
}
