import { useEffect, useMemo, useState } from 'react'
import './planner-gantt.css'

type Job = Record<string, any>
type Train = Record<string, any>

type Props = { jobs: Job[]; trains: Train[]; onBack?: () => void }

const fmt = (value: any, fallback = '—') => value === undefined || value === null || value === '' ? fallback : String(value)

function parseDate(value: any) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}
function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - (day === 0 ? 6 : day - 1)); x.setHours(0, 0, 0, 0); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function parseTime(value: any) { const m = String(value || '').match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
function trainDate(t: Train) { const raw = t.schedule_date || t.date || t.scheduled_date; return raw ? String(raw).slice(0, 10) : null }
function durationMinutes(a: Date, b: Date) { return Math.max(1, Math.round((b.getTime() - a.getTime()) / 60000)) }
function departmentKey(value: any) { const v = String(value || '').toLowerCase(); return v.includes('s&t') || v.includes('signal') ? 'S&T' : v.includes('traction') || v.includes('ohe') ? 'Traction' : 'Engineering' }

export default function PlannerGantt({ jobs, trains, onBack }: Props) {
  const scheduled = useMemo(() => jobs.filter(j => String(j.plan_status || '').toUpperCase() === 'SCHEDULED' && j.scheduled_start), [jobs])
  const firstDate = useMemo(() => {
    const dates = scheduled.map(j => parseDate(j.scheduled_start)).filter(Boolean) as Date[]
    dates.sort((a, b) => a.getTime() - b.getTime())
    return dates[0] || new Date()
  }, [scheduled])
  const [mode, setMode] = useState<'DAY' | 'WEEK'>('DAY')
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [initialized, setInitialized] = useState(false)
  const [showTrains, setShowTrains] = useState(true)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(true)

  useEffect(() => { if (!initialized && scheduled.length) { setSelectedDate(dateKey(firstDate)); setInitialized(true) } }, [initialized, firstDate, scheduled.length])

  const anchor = useMemo(() => parseDate(selectedDate) || firstDate, [selectedDate, firstDate])
  const range = useMemo(() => mode === 'DAY' ? (() => { const s = new Date(anchor); s.setHours(0, 0, 0, 0); return { start: s, days: 1 } })() : { start: startOfWeek(anchor), days: 7 }, [anchor, mode])
  const rangeEnd = addDays(range.start, range.days)

  const visibleJobs = useMemo(() => scheduled.filter(j => {
    const s = parseDate(j.scheduled_start), e = parseDate(j.scheduled_end) || s
    if (!s || !e || e < range.start || s >= rangeEnd) return false
    const text = [j.job_id, j.department, j.section_id, j.block_id, j.work_type, j.description].join(' ').toLowerCase()
    return !query || text.includes(query.toLowerCase())
  }), [scheduled, range.start, rangeEnd, query])

  const visibleTrains = useMemo(() => showTrains ? trains.filter(t => {
    const d = trainDate(t)
    return d ? d >= dateKey(range.start) && d < dateKey(rangeEnd) : mode === 'DAY'
  }).slice(0, 100) : [], [showTrains, trains, range.start, rangeEnd, mode])

  const bounds = useMemo(() => {
    if (mode !== 'DAY' || !focused) return { start: 0, end: 24 * 60 }
    const times: number[] = []
    visibleJobs.forEach(j => { const s = parseDate(j.scheduled_start), e = parseDate(j.scheduled_end); if (s) times.push(s.getHours() * 60 + s.getMinutes()); if (e) times.push(e.getHours() * 60 + e.getMinutes()) })
    visibleTrains.forEach(t => { const m = parseTime(t.arrival || t.arrival_time || t.start_time); if (m !== null) times.push(m) })
    if (!times.length) return { start: 6 * 60, end: 22 * 60 }
    const min = Math.max(0, Math.floor((Math.min(...times) - 60) / 60) * 60)
    const max = Math.min(24 * 60, Math.ceil((Math.max(...times) + 60) / 60) * 60)
    return { start: min, end: Math.max(max, min + 4 * 60) }
  }, [mode, focused, visibleJobs, visibleTrains])

  const totalMinutes = mode === 'DAY' ? bounds.end - bounds.start : range.days * 1440
  const columns = mode === 'DAY' ? Array.from({ length: Math.max(1, (bounds.end - bounds.start) / 60) }, (_, i) => bounds.start / 60 + i) : Array.from({ length: 7 }, (_, i) => i)
  const title = mode === 'DAY' ? anchor.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : `${range.start.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${addDays(range.start, 6).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`

  const position = (s: Date, e: Date) => {
    if (mode === 'DAY') {
      const a = s.getHours() * 60 + s.getMinutes(), b = e.getHours() * 60 + e.getMinutes()
      return { left: ((Math.max(a, bounds.start) - bounds.start) / totalMinutes) * 100, width: Math.max(1.8, ((Math.min(b, bounds.end) - Math.max(a, bounds.start)) / totalMinutes) * 100) }
    }
    const cs = s < range.start ? range.start : s, ce = e > rangeEnd ? rangeEnd : e
    return { left: ((cs.getTime() - range.start.getTime()) / 60000) / totalMinutes * 100, width: Math.max(1.5, durationMinutes(cs, ce) / totalMinutes * 100) }
  }
  const trainPosition = (t: Train) => {
    const time = parseTime(t.arrival || t.arrival_time || t.start_time), d = trainDate(t)
    if (mode === 'DAY') return time === null ? null : ((time - bounds.start) / totalMinutes) * 100
    if (!d) return null
    const day = Math.round((new Date(`${d}T00:00:00`).getTime() - range.start.getTime()) / 86400000)
    return day < 0 || day >= 7 ? null : ((day * 1440 + (time ?? 720)) / totalMinutes) * 100
  }

  const grouped = ['Engineering', 'S&T', 'Traction'].map(dept => ({ dept, jobs: visibleJobs.filter(j => departmentKey(j.department) === dept) })).filter(g => g.jobs.length)
  const conflicts = visibleJobs.filter(j => String(j.conflict_status || j.has_conflict || '').toLowerCase() === 'true' || String(j.status || '').toLowerCase().includes('conflict')).length
  const moveDate = (n: number) => setSelectedDate(dateKey(mode === 'WEEK' ? addDays(anchor, n * 7) : addDays(anchor, n)))

  return <section className="pg-card">
    <div className="pg-header">
      <div><div className="pg-eyebrow">MARS / PLANNER CONTROL CENTRE</div><h2>Maintenance Schedule Gantt</h2><p>At-a-glance view of maintenance work, block windows and train movements.</p></div>
      {onBack && <button className="pg-link" onClick={onBack}>← Proposed Plan</button>}
    </div>

    <div className="pg-kpis">
      <div><span className="kpi-icon jobs">J</span><b>{visibleJobs.length}</b><small>Scheduled jobs</small></div>
      <div><span className="kpi-icon uns">!</span><b>{jobs.length - scheduled.length}</b><small>Unscheduled</small></div>
      <div><span className="kpi-icon trains">T</span><b>{visibleTrains.length}</b><small>Train movements</small></div>
      <div className={conflicts ? 'risk' : ''}><span className="kpi-icon conflicts">!</span><b>{conflicts}</b><small>Conflicts</small></div>
    </div>

    <div className="pg-toolbar">
      <div className="pg-view-switch">{(['DAY', 'WEEK'] as const).map(v => <button key={v} className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{v === 'DAY' ? 'Day' : 'Week'}</button>)}</div>
      <button onClick={() => moveDate(-1)}>‹</button><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /><button onClick={() => setSelectedDate(dateKey(firstDate))}>Plan date</button><button onClick={() => moveDate(1)}>›</button>
      {mode === 'DAY' && <button className={focused ? 'pg-toggle active' : 'pg-toggle'} onClick={() => setFocused(v => !v)}>{focused ? 'Focus schedule' : 'Full day'}</button>}
      <input className="pg-search" placeholder="Find job, section or block…" value={query} onChange={e => setQuery(e.target.value)} />
      <label className="pg-check"><input type="checkbox" checked={showTrains} onChange={e => setShowTrains(e.target.checked)} /> Train layer</label>
    </div>

    <div className="pg-datebar"><strong>{title}</strong><span><i className="legend-job" />Maintenance <i className="legend-eng" />Engineering <i className="legend-st" />S&amp;T <i className="legend-tr" />Traction <i className="legend-train" />Train</span></div>

    <div className="pg-scroll">
      <div className="pg-grid" style={{ ['--pg-columns' as any]: columns.length }}>
        <div className="pg-corner">WORK / MOVEMENT</div>
        <div className="pg-scale">{columns.map((column, index) => <div key={column} className="pg-scale-cell">{mode === 'DAY' ? `${String(column).padStart(2, '0')}:00` : addDays(range.start, index).toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })}</div>)}</div>

        {grouped.map(group => <div className="pg-group" key={group.dept}><div className={`pg-group-label ${group.dept.toLowerCase().replace('&', '')}`}><span>{group.dept === 'Engineering' ? 'ENG' : group.dept === 'S&T' ? 'S&T' : 'TRC'}</span><strong>{group.dept}</strong><small>{group.jobs.length} jobs</small></div><div className="pg-group-track"><div className="pg-lane-grid" style={{ ['--pg-columns' as any]: columns.length }} />{group.jobs.map((job, index) => { const s = parseDate(job.scheduled_start)!, e = parseDate(job.scheduled_end) || s; const p = position(s, e); return <div className="pg-job" key={`${job.job_id}-${index}`} style={{ top: `${index * 31 + 5}px`, height: '25px' }}><div className={`pg-bar ${group.dept.toLowerCase().replace('&', '')}`} style={{ left: `${Math.max(0, p.left)}%`, width: `${p.width}%` }} title={`${fmt(job.job_id)} · ${fmt(job.scheduled_start)} → ${fmt(job.scheduled_end)}`}><b>{fmt(job.job_id)}</b><span>{fmt(job.section_id || job.section)} · {fmt(job.block_id || job.block)}</span></div></div>})}</div></div>)}

        {showTrains && <div className="pg-train-lane"><div className="pg-train-label"><span className="train-symbol">T</span><strong>TRAIN MOVEMENTS</strong><small>{visibleTrains.length} movements</small></div><div className="pg-train-track"><div className="pg-lane-grid" style={{ ['--pg-columns' as any]: columns.length }} />{visibleTrains.map((train, index) => { const left = trainPosition(train); if (left === null || left < 0 || left > 100) return null; return <button type="button" className="pg-train-marker" style={{ left: `${left}%` }} key={`train-${train.train_no || train.train_id || index}`} title={`Train ${fmt(train.train_no || train.train_id)} · ${fmt(train.arrival || train.arrival_time || train.start_time)}`}><span>{fmt(train.train_no || train.train_id)}</span></button> })}</div></div>}

        {!grouped.length && <div className="pg-empty">No scheduled maintenance work matches this date or search.</div>}
      </div>
    </div>

    <div className="pg-footer"><span><b>Reading the chart:</b> each horizontal bar is a maintenance job; its position is the planned start/end window. Department lanes make ownership immediately visible.</span><button onClick={() => setShowTrains(v => !v)}>{showTrains ? 'Hide train layer' : 'Show train layer'}</button></div>
  </section>
}
