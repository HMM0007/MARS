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

function trainDate(train: Train) {
  const rawDate = train.schedule_date || train.date || train.scheduled_date
  if (rawDate) return String(rawDate).slice(0, 10)
  return null
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
  const [compactTimeline, setCompactTimeline] = useState(true)

  useEffect(() => {
    if (!dateInitialized && scheduled.length) {
      setSelectedDate(dateKey(firstDate))
      setDateInitialized(true)
    }
  }, [dateInitialized, firstDate, scheduled.length])

  const anchor = useMemo(() => parseDate(selectedDate) || firstDate, [selectedDate, firstDate])

  const range = useMemo(() => {
    if (mode === 'DAY') {
      const start = new Date(anchor)
      start.setHours(0, 0, 0, 0)
      return { start, days: 1 }
    }
    if (mode === 'WEEK') return { start: startOfWeek(anchor), days: 7 }
    return { start: new Date(anchor.getFullYear(), anchor.getMonth(), 1), days: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate() }
  }, [anchor, mode])

  const rangeEnd = addDays(range.start, range.days)
  const visibleJobs = scheduled.filter(j => {
    const start = parseDate(j.scheduled_start)
    const end = parseDate(j.scheduled_end) || start
    if (!start || !end || end < range.start || start >= rangeEnd) return false
    const text = [j.job_id, j.department, j.section_id, j.block_id, j.work_type].join(' ').toLowerCase()
    return !query || text.includes(query.toLowerCase())
  })

  const visibleTrains = useMemo(() => {
    if (!showTrains) return []
    return trains.filter(t => {
      const date = trainDate(t)
      if (!date) return mode === 'DAY'
      return date >= dateKey(range.start) && date < dateKey(rangeEnd)
    }).slice(0, 100)
  }, [showTrains, trains, mode, range.start, rangeEnd])

  const dayBounds = useMemo(() => {
    if (mode !== 'DAY' || !compactTimeline) return { start: 0, end: 24 * 60 }
    const jobTimes = visibleJobs.flatMap(j => [parseDate(j.scheduled_start), parseDate(j.scheduled_end)]).filter(Boolean) as Date[]
    const trainTimes = visibleTrains.map(t => parseTime(t.arrival || t.arrival_time || t.start_time)).filter(v => v !== null) as number[]
    const starts = jobTimes.map(d => d.getHours() * 60 + d.getMinutes()).concat(trainTimes)
    const ends = jobTimes.map(d => d.getHours() * 60 + d.getMinutes())
    if (!starts.length) return { start: 6 * 60, end: 22 * 60 }
    const min = Math.max(0, Math.floor((Math.min(...starts) - 60) / 60) * 60)
    const max = Math.min(24 * 60, Math.ceil((Math.max(...ends, ...starts) + 60) / 60) * 60)
    return { start: Math.min(min, 6 * 60), end: Math.max(max, 22 * 60) }
  }, [mode, compactTimeline, visibleJobs, visibleTrains])

  const totalMinutes = mode === 'DAY' ? dayBounds.end - dayBounds.start : range.days * 24 * 60
  const columns = mode === 'DAY'
    ? Array.from({ length: Math.max(1, (dayBounds.end - dayBounds.start) / 60) }, (_, i) => dayBounds.start / 60 + i)
    : Array.from({ length: range.days }, (_, i) => i)

  const moveDate = (amount: number) => {
    const next = mode === 'MONTH' ? new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1) : addDays(anchor, mode === 'WEEK' ? amount * 7 : amount)
    setSelectedDate(dateKey(next))
  }

  const title = mode === 'DAY'
    ? anchor.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
    : mode === 'WEEK'
      ? `${range.start.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${addDays(range.start, 6).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString([], { month: 'long', year: 'numeric' })

  const positionForJob = (start: Date, end: Date) => {
    if (mode === 'DAY') {
      const startMinutes = start.getHours() * 60 + start.getMinutes()
      const endMinutes = end.getHours() * 60 + end.getMinutes()
      const left = ((Math.max(startMinutes, dayBounds.start) - dayBounds.start) / totalMinutes) * 100
      const width = Math.max(2, ((Math.min(endMinutes, dayBounds.end) - Math.max(startMinutes, dayBounds.start)) / totalMinutes) * 100)
      return { left, width }
    }
    const clippedStart = start < range.start ? range.start : start
    const clippedEnd = end > rangeEnd ? rangeEnd : end
    return {
      left: ((clippedStart.getTime() - range.start.getTime()) / 60000) / totalMinutes * 100,
      width: Math.max(1.5, durationMinutes(clippedStart, clippedEnd) / totalMinutes * 100),
    }
  }

  const trainPosition = (train: Train) => {
    const time = parseTime(train.arrival || train.arrival_time || train.start_time)
    const date = trainDate(train)
    if (mode === 'DAY') {
      if (time === null) return null
      return ((time - dayBounds.start) / totalMinutes) * 100
    }
    if (!date) return null
    const dayOffset = Math.round((new Date(`${date}T00:00:00`).getTime() - range.start.getTime()) / 86400000)
    if (dayOffset < 0 || dayOffset >= range.days) return null
    const minute = time === null ? 12 * 60 : time
    return ((dayOffset * 1440 + minute) / totalMinutes) * 100
  }

  return <section className="pg-card">
    <div className="pg-header">
      <div>
        <div className="pg-eyebrow">MARS / CALENDAR &amp; GANTT</div>
        <h2>Maintenance Schedule Timeline</h2>
        <p>Compact operational view of scheduled maintenance, block windows and train movements.</p>
      </div>
      {onBack && <button className="pg-link" onClick={onBack}>← Back to Proposed Plan</button>}
    </div>

    <div className="pg-toolbar">
      <div className="pg-view-switch">{(['DAY', 'WEEK', 'MONTH'] as const).map(v => <button key={v} className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{v[0] + v.slice(1).toLowerCase()}</button>)}</div>
      <button aria-label="Previous period" onClick={() => moveDate(-1)}>‹</button>
      <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
      <button onClick={() => setSelectedDate(dateKey(firstDate))}>Plan date</button>
      <button aria-label="Next period" onClick={() => moveDate(1)}>›</button>
      <button className={compactTimeline ? 'pg-toggle active' : 'pg-toggle'} onClick={() => setCompactTimeline(v => !v)}>{compactTimeline ? 'Focused hours' : 'Full day'}</button>
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
          const end = parseDate(job.scheduled_end) || start
          const position = positionForJob(start, end)
          return <div className="pg-row" key={`job-${job.job_id}-${index}`}>
            <div className="pg-label"><strong>{fmt(job.job_id)}</strong><span>{fmt(job.department)} · {fmt(job.section_id || job.section)} · {fmt(job.block_id || job.block)}</span></div>
            <div className="pg-track"><div className="pg-bar job" style={{ left: `${Math.max(0, position.left)}%`, width: `${position.width}%` }} title={`${fmt(job.job_id)} · ${fmt(job.scheduled_start)} → ${fmt(job.scheduled_end)}`}><b>{fmt(job.job_id)}</b><small>{fmt(job.work_type || job.description)}</small></div></div>
          </div>
        })}

        {showTrains && <div className="pg-row train-summary-row">
          <div className="pg-label train-label"><strong>TRAIN MOVEMENTS</strong><span>{visibleTrains.length} movements · red markers indicate entry/arrival time</span></div>
          <div className="pg-track train-track">{visibleTrains.map((train, index) => {
            const left = trainPosition(train)
            if (left === null || left < 0 || left > 100) return null
            return <button type="button" className="pg-train-marker" style={{ left: `${left}%` }} key={`train-${train.train_no || train.train_id || index}`} title={`Train ${fmt(train.train_no || train.train_id)} · ${fmt(train.arrival || train.arrival_time || train.start_time)}`}><span>{fmt(train.train_no || train.train_id)}</span></button>
          })}</div>
        </div>}

        {!visibleJobs.length && <div className="pg-empty">No scheduled jobs fall inside this date range. Unscheduled work remains visible in the summary above.</div>}
      </div>
    </div>

    <div className="pg-legend"><span><i className="job-dot" /> Maintenance job</span><span><i className="train-dot" /> Train movement</span><span><i className="uns-dot" /> Unscheduled work</span></div>
  </section>
}
