import { useEffect, useMemo, useState } from 'react'
import './planner-gantt.css'

type Job = Record<string, any>
type Train = Record<string, any>

type Props = {
  jobs: Job[]
  trains: Train[]
  onBack?: () => void
}

const fmt = (value: any, fallback = '—') => value === undefined || value === null || value === '' ? fallback : String(value)

function parseDate(value: any) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay()
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1))
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, amount: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function parseTime(value: any) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function durationMinutes(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
}

export default function PlannerGantt({ jobs, trains, onBack }: Props) {
  const scheduled = useMemo(() => jobs.filter(j => String(j.plan_status || '').toUpperCase() === 'SCHEDULED' && j.scheduled_start), [jobs])
  const firstDate = useMemo(() => {
    const dates = scheduled.map(j => parseDate(j.scheduled_start)).filter(Boolean) as Date[]
    dates.sort((a, b) => a.getTime() - b.getTime())
    return dates[0] || new Date()
  }, [scheduled])

  const [mode, setMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY')
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [dateInitialized, setDateInitialized] = useState(false)
  const [showTrains, setShowTrains] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!dateInitialized && scheduled.length) {
      setSelectedDate(dateKey(firstDate))
      setDateInitialized(true)
    }
  }, [dateInitialized, firstDate, scheduled.length])

  const anchor = useMemo(() => {
    const parsed = parseDate(selectedDate)
    return parsed || firstDate
  }, [selectedDate, firstDate])

  const range = useMemo(() => {
    if (mode === 'DAY') {
      const start = new Date(anchor); start.setHours(0, 0, 0, 0)
      return { start, days: 1 }
    }
    if (mode === 'WEEK') return { start: startOfWeek(anchor), days: 7 }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return { start, days: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate() }
  }, [anchor, mode])

  const totalMinutes = range.days * 24 * 60
  const rangeEnd = addDays(range.start, range.days)
  const visibleJobs = scheduled.filter(j => {
    const start = parseDate(j.scheduled_start)
    const end = parseDate(j.scheduled_end) || start
    if (!start || !end || end < range.start || start >= rangeEnd) return false
    const text = [j.job_id, j.department, j.section_id, j.block_id, j.work_type].join(' ').toLowerCase()
    return !query || text.includes(query.toLowerCase())
  })

  const visibleTrains = showTrains ? trains.filter(t => {
    const date = t.schedule_date || t.date || t.scheduled_date
    if (date) return String(date).slice(0, 10) >= dateKey(range.start) && String(date).slice(0, 10) < dateKey(rangeEnd)
    return true
  }).slice(0, 80) : []

  const moveDate = (amount: number) => {
    const next = mode === 'MONTH' ? new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1) : addDays(anchor, mode === 'WEEK' ? amount * 7 : amount)
    setSelectedDate(dateKey(next))
  }

  const title = mode === 'DAY'
    ? anchor.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
    : mode === 'WEEK'
      ? `${range.start.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${addDays(range.start, 6).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString([], { month: 'long', year: 'numeric' })

  const columns = mode === 'DAY' ? Array.from({ length: 24 }, (_, i) => i) : Array.from({ length: range.days }, (_, i) => i)

  return <section className="pg-card">
    <div className="pg-header">
      <div>
        <div className="pg-eyebrow">MARS / CALENDAR &amp; GANTT</div>
        <h2>Maintenance Schedule Timeline</h2>
        <p>Planner view of the current active plan. Scheduled jobs are positioned from their actual backend start/end timestamps.</p>
      </div>
      {onBack && <button className="pg-link" onClick={onBack}>← Back to Proposed Plan</button>}
    </div>

    <div className="pg-toolbar">
      <div className="pg-view-switch">
        {(['DAY', 'WEEK', 'MONTH'] as const).map(v => <button key={v} className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{v[0] + v.slice(1).toLowerCase()}</button>)}
      </div>
      <button onClick={() => moveDate(-1)}>‹</button>
      <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
      <button onClick={() => setSelectedDate(dateKey(firstDate))}>Plan date</button>
      <button onClick={() => moveDate(1)}>›</button>
      <input className="pg-search" placeholder="Search job / section / block…" value={query} onChange={e => setQuery(e.target.value)} />
      <label className="pg-check"><input type="checkbox" checked={showTrains} onChange={e => setShowTrains(e.target.checked)} /> Show trains</label>
    </div>

    <div className="pg-summary">
      <span><b>{visibleJobs.length}</b> scheduled jobs</span>
      <span><b>{jobs.length - scheduled.length}</b> unscheduled</span>
      <span><b>{visibleTrains.length}</b> train movements</span>
      <strong>{title}</strong>
    </div>

    <div className="pg-scroll">
      <div className="pg-grid" style={{ ['--pg-columns' as any]: columns.length }}>
        <div className="pg-corner">JOBS / MOVEMENTS</div>
        <div className="pg-scale">{columns.map((column, index) => <div key={column} className="pg-scale-cell">{mode === 'DAY' ? `${String(column).padStart(2, '0')}:00` : addDays(range.start, index).toLocaleDateString([], { day: '2-digit', month: 'short' })}</div>)}</div>

        {visibleJobs.map((job, index) => {
          const start = parseDate(job.scheduled_start)!
          const end = parseDate(job.scheduled_end) || addDays(start, 0)
          const clippedStart = start < range.start ? range.start : start
          const clippedEnd = end > rangeEnd ? rangeEnd : end
          const startOffset = ((clippedStart.getTime() - range.start.getTime()) / 60000) / totalMinutes * 100
          const width = Math.max(1.5, durationMinutes(clippedStart, clippedEnd) / totalMinutes * 100)
          return <div className="pg-row" key={`job-${job.job_id}-${index}`}>
            <div className="pg-label"><strong>{fmt(job.job_id)}</strong><span>{fmt(job.department)} · {fmt(job.section_id || job.section)} · {fmt(job.block_id || job.block)}</span></div>
            <div className="pg-track"><div className="pg-bar job" style={{ left: `${startOffset}%`, width: `${width}%` }} title={`${fmt(job.job_id)} · ${fmt(job.scheduled_start)} → ${fmt(job.scheduled_end)}`}><b>{fmt(job.job_id)}</b><small>{fmt(job.work_type || job.description)}</small></div></div>
          </div>
        })}

        {visibleTrains.map((train, index) => {
          const time = parseTime(train.arrival || train.arrival_time || train.start_time)
          if (time === null || mode !== 'DAY') return null
          const left = time / (24 * 60) * 100
          return <div className="pg-row train-row" key={`train-${train.train_no || train.train_id || index}`}>
            <div className="pg-label"><strong>TRAIN {fmt(train.train_no || train.train_id)}</strong><span>{fmt(train.type, 'Movement')} · {fmt(train.section)}</span></div>
            <div className="pg-track"><div className="pg-train-line" style={{ left: `${left}%` }}><span>{fmt(train.arrival || train.arrival_time)}</span></div></div>
          </div>
        })}

        {!visibleJobs.length && <div className="pg-empty">No scheduled jobs fall inside this date range. Unscheduled work remains visible in the summary above.</div>}
      </div>
    </div>

    <div className="pg-legend"><span><i className="job-dot" /> Maintenance job</span><span><i className="train-dot" /> Train movement</span><span><i className="uns-dot" /> Unscheduled</span></div>
  </section>
}
