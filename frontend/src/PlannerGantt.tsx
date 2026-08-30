import { useMemo, useState } from 'react'
import './planner-gantt.css'

type Job = Record<string, any>
type Train = Record<string, any>
type Props = { jobs: Job[]; trains: Train[]; onBack?: () => void }

const text = (value: any, fallback = '—') => value === undefined || value === null || value === '' ? fallback : String(value)
const dateKey = (value: any) => {
  if (!value) return ''
  const raw = String(value)
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
const parse = (value: any) => {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}
const time = (value: any) => {
  const d = parse(value)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : text(value)
}
const dateLabel = (key: string) => {
  const d = new Date(`${key}T00:00:00`)
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })
}
const deptClass = (department: any) => String(department || '').toLowerCase().includes('s&t') ? 'st' : String(department || '').toLowerCase().includes('traction') ? 'traction' : 'engineering'

export default function PlannerGantt({ jobs, trains, onBack }: Props) {
  const scheduled = useMemo(() => jobs.filter(j => String(j.plan_status || '').toUpperCase() === 'SCHEDULED' && j.scheduled_start), [jobs])
  const dates = useMemo(() => Array.from(new Set(scheduled.map(j => dateKey(j.scheduled_start)).filter(Boolean))).sort(), [scheduled])
  const [selectedDate, setSelectedDate] = useState(() => dates[0] || dateKey(new Date()))
  const [department, setDepartment] = useState('ALL')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showTrains, setShowTrains] = useState(false)

  const activeDate = dates.includes(selectedDate) ? selectedDate : dates[0] || selectedDate
  const departments = useMemo(() => Array.from(new Set(scheduled.map(j => String(j.department || '')).filter(Boolean))), [scheduled])
  const visibleJobs = useMemo(() => scheduled.filter(j => dateKey(j.scheduled_start) === activeDate && (department === 'ALL' || String(j.department || '') === department)).sort((a, b) => (parse(a.scheduled_start)?.getTime() || 0) - (parse(b.scheduled_start)?.getTime() || 0)), [scheduled, activeDate, department])
  const dateTrains = useMemo(() => trains.filter(t => { const d = t.schedule_date || t.date || t.scheduled_date; return !d || dateKey(d) === activeDate }).slice(0, 30), [trains, activeDate])

  const startHour = 6
  const endHour = 22
  const totalMinutes = (endHour - startHour) * 60
  const x = (value: any) => {
    const d = parse(value)
    if (!d) return 0
    return Math.max(0, Math.min(100, ((d.getHours() * 60 + d.getMinutes() - startHour * 60) / totalMinutes) * 100))
  }
  const width = (job: Job) => {
    const start = parse(job.scheduled_start)
    const end = parse(job.scheduled_end)
    if (!start) return 4
    const endMinutes = end ? end.getHours() * 60 + end.getMinutes() : start.getHours() * 60 + start.getMinutes() + Number(job.duration_min || 30)
    return Math.max(3, Math.min(100 - x(job.scheduled_start), ((endMinutes - (start.getHours() * 60 + start.getMinutes())) / totalMinutes) * 100))
  }
  const trainX = (train: Train) => {
    const raw = train.arrival || train.arrival_time || train.start_time || train.departure || ''
    const match = String(raw).match(/(\d{1,2}):(\d{2})/)
    if (!match) return null
    return Math.max(0, Math.min(100, (((Number(match[1]) * 60 + Number(match[2])) - startHour * 60) / totalMinutes) * 100))
  }

  return <section className="pg-card">
    <header className="pg-header">
      <div><div className="pg-eyebrow">MARS / PLANNER</div><h2>Maintenance Gantt</h2><p>One clear timeline for the active maintenance plan.</p></div>
      {onBack && <button className="pg-back" onClick={onBack}>← Proposed Plan</button>}
    </header>

    <div className="pg-kpis"><div><b>{visibleJobs.length}</b><span>Scheduled today</span></div><div><b>{jobs.filter(j => String(j.plan_status || '').toUpperCase() !== 'SCHEDULED').length}</b><span>Unscheduled</span></div><div><b>{scheduled.length}</b><span>Total scheduled</span></div><div><b>{dateTrains.length}</b><span>Train movements</span></div></div>

    <div className="pg-controls">
      <div className="pg-date-tabs">{dates.length ? dates.slice(0, 7).map(d => <button key={d} className={d === activeDate ? 'active' : ''} onClick={() => { setSelectedDate(d); setSelectedJob(null) }}>{dateLabel(d)}</button>) : <span>No scheduled plan dates</span>}</div>
      <select value={department} onChange={e => { setDepartment(e.target.value); setSelectedJob(null) }}><option value="ALL">All departments</option>{departments.map(d => <option key={d}>{d}</option>)}</select>
      <button className={showTrains ? 'active' : ''} onClick={() => setShowTrains(v => !v)}>{showTrains ? 'Hide trains' : 'Show trains'}</button>
    </div>

    <div className="pg-legend"><span><i className="eng-dot"/> Engineering</span><span><i className="st-dot"/> S&amp;T</span><span><i className="tr-dot"/> Traction</span><span className="hint">Click any job bar for details</span></div>

    <div className="pg-timeline">
      <div className="pg-time-header"><div className="pg-label-head">MAINTENANCE JOB</div><div className="pg-hours">{Array.from({ length: 17 }, (_, i) => <span key={i}>{String(i + startHour).padStart(2, '0')}:00</span>)}</div></div>
      {visibleJobs.length === 0 ? <div className="pg-empty"><strong>No scheduled jobs for {dateLabel(activeDate)}.</strong><span>{dates.length ? 'Choose another plan date above.' : 'Run the optimizer to create a schedule.'}</span></div> : visibleJobs.map(job => <button className={`pg-job-row ${selectedJob?.job_id === job.job_id ? 'selected' : ''}`} key={job.job_id} onClick={() => setSelectedJob(job)}><div className="pg-job-label"><strong>{text(job.job_id)}</strong><span>{text(job.department)} · {text(job.section_id || job.section)} · {text(job.block_id || job.block)}</span></div><div className="pg-track"><div className="pg-grid-lines">{Array.from({ length: 17 }, (_, i) => <i key={i}/>)}</div><div className={`pg-job-bar ${deptClass(job.department)}`} style={{ left: `${x(job.scheduled_start)}%`, width: `${width(job)}%` }}><strong>{text(job.job_id)}</strong><small>{time(job.scheduled_start)}–{time(job.scheduled_end)}</small></div></div></button>)}
      {showTrains && <div className="pg-trains"><div className="pg-train-label"><strong>TRAIN MOVEMENTS</strong><span>{dateTrains.length}</span></div><div className="pg-train-track"><div className="pg-grid-lines">{Array.from({ length: 17 }, (_, i) => <i key={i}/>)}</div>{dateTrains.map((train, i) => { const left = trainX(train); return left === null ? null : <span className="pg-train-dot" key={i} style={{ left: `${left}%` }} title={`Train ${text(train.train_no || train.train_id)} · ${text(train.arrival || train.arrival_time || train.start_time)}`}><b>{text(train.train_no || train.train_id, 'Train')}</b></span> })}</div></div>}
    </div>

    {/* UNSCHEDULED JOBS SUMMARY PANEL */}
    {jobs.filter(j => String(j.plan_status || '').toUpperCase() !== 'SCHEDULED').length > 0 && (
      <div style={{ marginTop: 20, padding: 16, background: '#fff9f9', border: '1px solid #f8c0c4', borderRadius: 10 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#c8323c' }}>
          Unscheduled Maintenance Jobs ({jobs.filter(j => String(j.plan_status || '').toUpperCase() !== 'SCHEDULED').length})
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {jobs.filter(j => String(j.plan_status || '').toUpperCase() !== 'SCHEDULED').slice(0, 8).map(j => (
            <div key={j.job_id} style={{ background: '#fff', border: '1px solid #e1e8f0', borderRadius: 8, padding: 10, fontSize: 11 }}>
              <strong style={{ color: '#17365d' }}>{text(j.job_id)}</strong> · {text(j.department)} · {text(j.section_id || j.section)}
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#71809a' }}>
                Reason: {text(j.optimizer_reason_detail || j.optimizer_reason_code || 'Feasible candidates were not selected by global objective.')}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}

    {selectedJob && <aside className="pg-details"><div><div className="pg-eyebrow">JOB DETAILS</div><h3>{text(selectedJob.job_id)}</h3></div><button onClick={() => setSelectedJob(null)}>×</button><div className="pg-detail-grid"><span>Department<b>{text(selectedJob.department)}</b></span><span>Work type<b>{text(selectedJob.work_type || selectedJob.description)}</b></span><span>Section<b>{text(selectedJob.section_id || selectedJob.section)}</b></span><span>Block<b>{text(selectedJob.block_id || selectedJob.block)}</b></span><span>Start<b>{dateLabel(dateKey(selectedJob.scheduled_start))} · {time(selectedJob.scheduled_start)}</b></span><span>End<b>{time(selectedJob.scheduled_end)}</b></span></div></aside>}
  </section>
}
