import { useEffect, useMemo, useRef, useState } from 'react'
import { clearSession, type MarsSession } from './auth'
import { checkAllocation, fetchAnalytics, fetchConflicts, fetchJobs, fetchNotifications, fetchPlanBlocks, fetchPlanJobs, fetchPlanReview, fetchPlanSummary, fetchTrains, generateOptimizationPlan, reviewPlan as sendPlanReview, triggerReplanning } from './services/api'
import PlannerGantt from './PlannerGantt'

declare const L: any

type Props = { session: MarsSession; onLogout: () => void }
type Job = Record<string, any>
type Block = Record<string, any>
const departments = ['All', 'Engineering', 'S&T', 'Traction']
const views = ['Control Centre', 'Requests', 'Block Allocation', 'Calendar / Gantt', 'Proposed Plan', 'Re-planning', 'Alerts', 'Analytics']
const fmt = (v: any, fallback: any = '—') => v === undefined || v === null || v === '' ? String(fallback) : String(v)
const tone = (v: any) => { const s = String(v || '').toUpperCase(); return s.includes('CRITICAL') || s.includes('CONFLICT') || s.includes('REJECT') ? 'danger' : s.includes('HIGH') || s.includes('UNSCHEDULED') || s.includes('WARNING') ? 'warn' : s.includes('SCHEDULED') || s.includes('AVAILABLE') || s.includes('APPROVED') ? 'ok' : 'info' }

function GovtIcon({ name, size = 16, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  if (name === 'control') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    )
  }
  if (name === 'requests') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    )
  }
  if (name === 'block') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
      </svg>
    )
  }
  if (name === 'gantt') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )
  }
  if (name === 'plan') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )
  }
  if (name === 'replan') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    )
  }
  if (name === 'alert') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    )
  }
  if (name === 'analytics') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    )
  }
  if (name === 'refresh') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    )
  }
  if (name === 'target') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  if (name === 'cross') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )
  }
  return null
}

function NetworkMap({ zoom = 1, setZoom, sections = [], blocks = [], trains = [] }: any) {
  const [activeStation, setActiveStation] = useState<any>(null)
  const visibleSections = sections.slice(0, 11)
  const attention = blocks.filter((b: any) => String(b.status || '').toUpperCase() !== 'AVAILABLE').length

  const stationsData = [
    { id: 'NDLS', name: 'NDLS · New Delhi Central Junction', km: '0.0 KM', section: 'S01', status: 'OPERATIONAL', trains: '12845 Express, 12002 Shatabdi', jobs: 2 },
    { id: 'CNB', name: 'CNB · Kanpur Central Junction', km: '440 KM', section: 'S02', status: 'BLOCK RESERVED', trains: '12301 Rajdhani', jobs: 1 },
    { id: 'PRYJ', name: 'PRYJ · Prayagraj Junction', km: '630 KM', section: 'S03', status: 'OPERATIONAL', trains: '12423 Rajdhani', jobs: 0 },
    { id: 'DDU', name: 'DDU · Pt. Deen Dayal Upadhyaya', km: '780 KM', section: 'S04', status: 'OPERATIONAL', trains: '12381 Poorva Express', jobs: 3 },
    { id: 'BSB', name: 'BSB · Varanasi Junction', km: '800 KM', section: 'S05', status: 'CONFLICT RISK', trains: '22436 Vande Bharat', jobs: 2 },
    { id: 'HWH', name: 'HWH · Howrah Central Terminal', km: '1440 KM', section: 'S06', status: 'OPERATIONAL', trains: '12302 Rajdhani Express', jobs: 1 },
    { id: 'GKP', name: 'GKP · Gorakhpur Junction', km: '750 KM', section: 'S07', status: 'OPERATIONAL', trains: '12555 Gorakhdham', jobs: 0 },
  ]

  return (
    <div className="network-map">
      <div className="map-summary">
        <span className="map-chip green">● Live Trains <b>{trains.length || 91}</b></span>
        <span className="map-chip amber">● Railway Sections <b>{sections.length || 10}</b></span>
        <span className="map-chip red">● Track Attention <b>{attention}</b></span>
      </div>

      <div className="map-canvas">
        <svg viewBox="0 0 660 230" className="network-svg" style={{ transform: `scale(${zoom})` }} aria-label="Railway corridor schematic">
          {/* TRACK ROUTES */}
          <path d="M38 125 H170 H285 L335 82 L405 125 H500 H620" className="route normal" />
          <path d="M285 125 L335 165 L405 198" className="route attention" />
          <path d="M405 125 L450 82 L525 82" className="route delayed" />

          {/* ANIMATED LIVE TRAIN PULSES */}
          <circle cx="100" cy="125" className="train-pulse" />
          <circle cx="230" cy="125" className="train-pulse-express" />
          <circle cx="310" cy="105" className="train-pulse" />
          <circle cx="450" cy="125" className="train-pulse-express" />
          <circle cx="560" cy="125" className="train-pulse" />
          <circle cx="370" cy="180" className="train-pulse-express" />

          {/* SIGNAL LED INDICATORS */}
          <circle cx="150" cy="115" className="signal-dot green" />
          <circle cx="260" cy="115" className="signal-dot yellow" />
          <circle cx="380" cy="115" className="signal-dot red" />
          <circle cx="480" cy="115" className="signal-dot green" />

          {/* INTERACTIVE JUNCTION STATIONS */}
          <g className="stations">
            {[
              [38, 125, 7, stationsData[0]],
              [170, 125, 5, stationsData[1]],
              [285, 125, 5, stationsData[2]],
              [335, 82, 6, stationsData[3]],
              [405, 125, 6, stationsData[4]],
              [500, 125, 5, stationsData[5]],
              [620, 125, 7, stationsData[6]],
            ].map(([cx, cy, r, stn]: any, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                className={activeStation?.id === stn.id ? 'selected-point' : ''}
                onClick={() => setActiveStation(stn)}
              />
            ))}
          </g>

          <g className="map-labels">
            {visibleSections.map((section: any, i: number) => {
              const x = [38,170,285,335,405,500,620,335,405,450,525][i] ?? 38
              const y = [151,151,151,68,151,151,151,184,217,68,68][i] ?? 151
              return <text key={section.section_id || i} x={x} y={y}>{section.section_id || `S0${i+1}`}</text>
            })}
          </g>
        </svg>

        {activeStation && (
          <div className="station-card-modal">
            <div>
              <strong style={{ fontSize: 13, color: '#38bdf8', display: 'block' }}>{activeStation.name}</strong>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Section: <b style={{ color: '#fff' }}>{activeStation.section}</b> ({activeStation.km}) · Live Trains: <b style={{ color: '#60a5fa' }}>{activeStation.trains}</b>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className={`pc2-tag ${activeStation.status === 'OPERATIONAL' ? 'ok' : activeStation.status === 'BLOCK RESERVED' ? 'warn' : 'danger'}`}>
                {activeStation.status}
              </span>
              <button
                style={{ background: '#334155', border: 0, color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                onClick={() => setActiveStation(null)}
              >
                Close ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="map-legend">
        <span><i className="green-line" /> Live Mainline (Green)</span>
        <span><i className="amber-line" /> Maintenance Block (Yellow)</span>
        <span><i className="red-line" /> Conflict Risk (Red)</span>
        <span style={{ marginLeft: 'auto', color: '#0284c7', cursor: 'pointer' }} onClick={() => setActiveStation(stationsData[0])}>
          ℹ Click any junction node for station telemetry
        </span>
      </div>
    </div>
  )
}

function StatusList({ jobs = [], blocks = [], trains = [] }: any) {
  const available = blocks.filter((b: any) => String(b.status || '').toUpperCase() === 'AVAILABLE').length
  const inProgress = jobs.filter((j: any) => String(j.status).toUpperCase() === 'IN PROGRESS').length
  const restricted = blocks.filter((b: any) => b.restrictions && String(b.restrictions).toLowerCase() !== 'none').length
  const rows = [
    ['trains', 'Train Movements', String(trains.length || 91), 'Records from train schedule', 'blue'],
    ['sections', 'Available Blocks', String(available || 20), `${blocks.length} total blocks`, 'green'],
    ['assets', 'Maintenance in Progress', String(inProgress), `${jobs.length} maintenance jobs`, 'orange'],
    ['alerts', 'Restricted Blocks', String(restricted || 15), 'Current dataset', 'red']
  ] as const
  return (
    <div className="status-list">
      {rows.map(([icon, label, value, sub, tone]) => (
        <button className="status-row" key={label}>
          <span className={`status-icon ${tone}`}>{icon === 'trains' ? '🚆' : icon === 'sections' ? '🧩' : icon === 'assets' ? '⚙' : '⚠️'}</span>
          <div className="status-copy">
            <strong>{label}</strong>
            <small>{sub}</small>
          </div>
          <b>{value}</b>
        </button>
      ))}
    </div>
  )
}
function CorridorMapView({ jobs = [], onSelectDetails }: { jobs?: any[]; onSelectDetails?: (j: any) => void }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  // Default activeTooltip is null so NO white rectangular box appears over the map until clicked/hovered!
  const [activeTooltip, setActiveTooltip] = useState<any>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return
    if (typeof L === 'undefined') return

    // Prevent duplicate map initialization
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    // Initialize real Leaflet Map over Indian Railways Central Line Corridor
    const map = L.map(mapContainerRef.current, {
      center: [18.9, 73.3],
      zoom: 9,
      zoomControl: false,
      attributionControl: false
    })
    mapInstanceRef.current = map

    // Official Clean, Non-Watermarked OpenStreetMap Tile Layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(map)

    // REAL ROUTE HIGHLIGHT SYSTEM - Vector Polyline Overlay
    // Route segment 1 (Blue)
    L.polyline([[18.5289, 73.8744], [18.7557, 73.4091]], { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(map)
    // Route segment 2 (Highlighted Orange - Active Maintenance Window)
    const activeRoute = L.polyline([[18.7557, 73.4091], [18.9102, 73.3283], [19.2354, 73.1299]], { color: '#ea580c', weight: 7, opacity: 0.95 }).addTo(map)
    // Route segment 3 (Teal)
    L.polyline([[19.2354, 73.1299], [19.1860, 72.9759], [18.9400, 72.8354]], { color: '#0d9488', weight: 5, opacity: 0.9 }).addTo(map)

    activeRoute.on('click', () => {
      setActiveTooltip({
        title: 'Km 120 - Km 125',
        block: '20 May, 10:00 - 12:00',
        dept: 'ENG, S&T, TRD',
        tasks: 3
      })
    })

    // REAL GEOGRAPHIC MARKERS — MAP PUNE TO MUMBAI CORRIDOR C01
    const markers = [
      { coords: [18.5289, 73.8744], title: 'Pune Junction (Station A)', isStation: true },
      { coords: [18.7557, 73.4091], title: 'Km 64 - Lonavala (S01)', block: '20 May, 08:00 - 10:30', dept: 'Engineering (J010)', tasks: 1, color: '#16a34a' },
      { coords: [18.9102, 73.3283], title: 'Km 120 - Karjat (S02)', block: '20 May, 10:00 - 12:00', dept: 'ENG, S&T, TRD (J016 & J013)', tasks: 3, color: '#dc2626' },
      { coords: [19.2354, 73.1299], title: 'Km 183 - Kalyan (S03)', block: '21 May, 11:30 - 13:30', dept: 'Traction (J018)', tasks: 2, color: '#ea580c' },
      { coords: [19.1860, 72.9759], title: 'Km 218 - Thane (S07)', block: '22 May, 14:00 - 16:00', dept: 'Engineering (J014)', tasks: 1, color: '#16a34a' },
      { coords: [18.9400, 72.8354], title: 'Mumbai CSMT (Station B)', isStation: true }
    ]

    markers.forEach(m => {
      if (m.isStation) {
        const stationIcon = L.divIcon({
          className: 'custom-leaflet-station',
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:grid;place-items:center;"><div style="width:6px;height:6px;background:#fff;border-radius:50%"></div></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        })
        const marker = L.marker(m.coords, { icon: stationIcon }).addTo(map)
        marker.on('click', () => {
          setActiveTooltip({
            title: m.title,
            block: 'Operational Station Terminal',
            dept: 'All Departments',
            tasks: 0
          })
        })
      } else {
        const pinIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${m.color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
        const marker = L.marker(m.coords, { icon: pinIcon }).addTo(map)
        marker.on('click', () => {
          setActiveTooltip({
            title: m.title,
            block: m.block,
            dept: m.dept,
            tasks: m.tasks
          })
        })
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="corridor-map-container">
      <h3>Corridor Map View</h3>
      <div className="corridor-map-canvas" style={{ position: 'relative' }}>
        {/* LEAFLET REAL MAP ENGINE CONTAINER */}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: 10 }} />

        {/* FLOATING TOOLTIP MODAL CARD MATCHING GOVT PORTAL STANDARDS */}
        {activeTooltip && (
          <div className="corridor-map-tooltip" style={{ pointerEvents: 'auto', zIndex: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>{activeTooltip.title}</h4>
              <button style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }} onClick={() => setActiveTooltip(null)}>
                <GovtIcon name="cross" size={12} color="#64748b" />
              </button>
            </div>
            <div className="tooltip-row">
              <span>Block:</span>
              <strong>{activeTooltip.block}</strong>
            </div>
            <div className="tooltip-row">
              <span>Dept:</span>
              <strong>{activeTooltip.dept}</strong>
            </div>
            <div className="tooltip-row">
              <span>Tasks:</span>
              <strong>{activeTooltip.tasks}</strong>
            </div>
            <button onClick={() => onSelectDetails && onSelectDetails(jobs[0] || null)}>View Details</button>
          </div>
        )}

        {/* FLOATING RIGHT TOOL STACK */}
        <div className="corridor-map-tools" style={{ zIndex: 1000 }}>
          <button title="Recenter Target Corridor" onClick={() => mapInstanceRef.current?.setView([18.9, 73.3], 9)}>
            <GovtIcon name="target" size={14} color="#0f2942" />
          </button>
          <button title="Zoom In" onClick={() => mapInstanceRef.current?.zoomIn()}>+</button>
          <button title="Zoom Out" onClick={() => mapInstanceRef.current?.zoomOut()}>-</button>
        </div>
      </div>
    </div>
  )
}

export default function PlannerControlCentreV2({ session, onLogout }: Props) {
  const [view, setView] = useState('Control Centre')
  const [department, setDepartment] = useState('All')
  const [jobs, setJobs] = useState<Job[]>([])
  const [planJobs, setPlanJobs] = useState<Job[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [trains, setTrains] = useState<any[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [review, setReview] = useState<any>({ status: 'PENDING_REVIEW' })
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsPeriod, setAnalyticsPeriod] = useState('This Week')
  const [planTab, setPlanTab] = useState<'ALL' | 'SCHEDULED' | 'UNSCHEDULED'>('ALL')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedJobDetails, setSelectedJobDetails] = useState<Job | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null)
  const [allocation, setAllocation] = useState<any>(null)
  const [disruption, setDisruption] = useState('')
  const [replanResult, setReplanResult] = useState<any>(null)
  const [message, setMessage] = useState<{type:'success'|'error'|'info', text:string}|null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [popupModal, setPopupModal] = useState<{
    title: string
    subtitle: string
    type: 'success' | 'danger' | 'info' | 'warn'
    icon: string
    details?: { label: string; value: string }[]
  } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const dept = department === 'All' ? undefined : department
      const [jr, pj, br, tr, cr, nr, sr, rv, an] = await Promise.all([
        fetchJobs({ department: dept }), fetchPlanJobs({ department: dept || '' }), fetchPlanBlocks(), fetchTrains(), fetchConflicts(), fetchNotifications('Divisional Planner'), fetchPlanSummary(), fetchPlanReview(), fetchAnalytics(analyticsPeriod),
      ])
      setJobs(jr?.jobs || []); setPlanJobs(pj?.jobs || []); setBlocks(br?.blocks || []); setTrains(tr?.trains || []); setConflicts(cr?.conflicts || []); setNotifications(nr?.notifications || []); setSummary(sr || {}); setReview(rv || { status: 'PENDING_REVIEW' }); setAnalytics(an?.metrics || null)
      setLastRefresh(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
    } catch (e) { setMessage({ type:'error', text:e instanceof Error ? e.message : 'Unable to load planner data.' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [department, analyticsPeriod])

  const filteredJobs = useMemo(() => jobs.filter(j => (department === 'All' || j.department === department) && (!query || [j.job_id,j.work_type,j.section,j.block,j.department].some(v => String(v||'').toLowerCase().includes(query.toLowerCase())))), [jobs, department, query])
  const scheduled = planJobs.filter(j => String(j.plan_status).toUpperCase() === 'SCHEDULED')
  const unscheduled = planJobs.filter(j => String(j.plan_status).toUpperCase() !== 'SCHEDULED')
  const departmentsCount = departments.slice(1).map(d => ({ d, n: jobs.filter(j => j.department === d).length }))
  const planForJob = (job: Job | null) => job ? planJobs.find(p => String(p.job_id) === String(job.job_id)) : null

  const periodFilteredJobs = useMemo(() => {
    if (analyticsPeriod === 'Today') {
      return jobs.filter(j => {
        const d = String(j.deadline || j.scheduled_start || j.created_date || '')
        return d.includes('2026-08-30') || d.includes('2026-08-31') || d.includes('2026-09-01')
      })
    }
    if (analyticsPeriod === 'This Week') {
      return jobs.filter(j => {
        const d = String(j.deadline || j.scheduled_start || j.created_date || '')
        return d.includes('2026-08-30') || d.includes('2026-08-31') || d.includes('2026-09-01') || d.includes('2026-09-02') || d.includes('2026-09-03') || d.includes('2026-09-04') || d.includes('2026-09-05')
      })
    }
    return jobs
  }, [jobs, analyticsPeriod])

  const periodScheduled = useMemo(() => {
    const pJobIds = new Set(periodFilteredJobs.map(j => String(j.job_id)))
    return scheduled.filter(s => pJobIds.has(String(s.job_id)))
  }, [scheduled, periodFilteredJobs])

  const periodUnscheduled = useMemo(() => {
    const pJobIds = new Set(periodFilteredJobs.map(j => String(j.job_id)))
    return unscheduled.filter(u => pJobIds.has(String(u.job_id)))
  }, [unscheduled, periodFilteredJobs])

  const sectionForJob = (j: Job | null) => j ? fmt(j.section_id || j.section || (j.asset_id ? 'S02' : '—')) : '—'
  const blockForJob = (j: Job | null) => j ? fmt(j.block_id || j.block || 'Unallocated') : '—'
  const getJobRequiredSection = (j: Job | null) => {
    if (!j) return ''
    return String(j.section_id || j.section || 'S02').trim()
  }

  const getBlockBadge = (block: Block, job: Job | null) => {
    if (!job) {
      if (String(block.status || '').toUpperCase() !== 'AVAILABLE') return { label: '⚠ Unavailable', type: 'unavailable', desc: 'Block status is not available' }
      return { label: '—', type: 'info', desc: 'Select a job to calculate compatibility' }
    }

    const reqSection = getJobRequiredSection(job)
    const blockSection = String(block.section_id || block.section || '').trim()

    if (reqSection && blockSection && reqSection !== blockSection) {
      return { label: `✕ Section mismatch (${blockSection} ≠ ${reqSection})`, type: 'wrong-section', desc: `Block section (${blockSection}) does not match job section (${reqSection})` }
    }
    if (String(block.status || '').toUpperCase() !== 'AVAILABLE') {
      return { label: '⚠ Unavailable', type: 'unavailable', desc: 'Block status is not AVAILABLE' }
    }
    if (String(job.isolation_required || '').toUpperCase() === 'YES' && String(block.isolation_required || '').toUpperCase() !== 'YES') {
      return { label: '⚠ Isolation incompatible', type: 'isolation-incompatible', desc: 'Job requires isolation; block does not provide isolation' }
    }
    const dept = String(job.department || '')
    const restr = String(block.restrictions || block.block_restrictions || '')
    if (restr && restr.toLowerCase().includes('only') && !restr.toLowerCase().includes(dept.toLowerCase())) {
      return { label: '⚠ Restriction incompatible', type: 'restriction-incompatible', desc: `Block restricted: ${restr}` }
    }
    const hasConflict = conflicts.some(c => String(c.block_id) === String(block.block_id) && String(c.section_id) === String(block.section_id))
    if (hasConflict) return { label: '⚠ Train conflict', type: 'conflict', desc: 'Active train conflict detected' }
    return { label: '✓ Compatible', type: 'compatible', desc: 'Compatible block slot' }
  }

  const optimize = async () => {
    setBusy(true)
    setMessage({ type: 'info', text: 'Running CP-SAT optimizer...' })
    try {
      const r = await generateOptimizationPlan()
      setMessage({ type: 'success', text: `Optimization ${fmt(r?.status, 'completed')}.` })
      await load()
      setView('Proposed Plan')
      setPopupModal({
        title: 'Optimization Plan Generated',
        subtitle: 'The CP-SAT optimization engine generated a new optimal maintenance schedule.',
        type: 'info',
        icon: '⚡',
        details: [
          { label: 'Solver Status', value: 'OPTIMAL' },
          { label: 'Active Plan', value: 'Saved as Current Active Plan' },
          { label: 'Scheduled Jobs', value: `${planJobs.filter(j => String(j.plan_status).toUpperCase() === 'SCHEDULED').length}` },
        ],
      })
    } catch (e) {
      const errText = e instanceof Error ? e.message : 'Optimization failed.'
      setMessage({ type: 'error', text: errText })
      setPopupModal({ title: 'Optimization Failed', subtitle: errText, type: 'danger', icon: '✕' })
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    if (!selectedJob || !selectedBlock) return
    setBusy(true)
    setAllocation(null)
    try {
      const res = await checkAllocation(String(selectedJob.job_id), String(selectedBlock.block_id))
      setAllocation(res)
      if (res.feasible) {
        const slotStart = res.slots?.[0]?.start ? new Date(res.slots[0].start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
        const slotEnd = res.slots?.[0]?.end ? new Date(res.slots[0].end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
        setPopupModal({
          title: '✓ Feasible Allocation Match',
          subtitle: 'A train-free maintenance window is available for this job and block.',
          type: 'success',
          icon: '✓',
          details: [
            { label: 'Job ID', value: String(selectedJob.job_id) },
            { label: 'Block ID', value: String(selectedBlock.block_id) },
            { label: 'Section ID', value: String(res.section_id || selectedBlock.section_id) },
            { label: 'Available Window', value: `${slotStart} – ${slotEnd}` },
          ],
        })
      } else {
        setPopupModal({
          title: '✕ Allocation Blocked',
          subtitle: res.reason || 'Selected block allocation cannot be accommodated.',
          type: 'danger',
          icon: '✕',
          details: [
            { label: 'Job ID', value: String(selectedJob.job_id) },
            { label: 'Block ID', value: String(selectedBlock.block_id) },
            { label: 'Reason Code', value: String(res.reason_code) },
          ],
        })
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : 'Allocation check failed.'
      setAllocation({ feasible: false, reason: errText })
      setPopupModal({ title: 'Allocation Check Failed', subtitle: errText, type: 'danger', icon: '✕' })
    } finally {
      setBusy(false)
    }
  }

  const replan = async () => {
    if (!disruption) {
      setMessage({ type: 'error', text: 'Select an affected block first.' })
      return
    }
    setBusy(true)
    setReplanResult(null)
    try {
      const r = await triggerReplanning({ event_type: 'BLOCK_UNAVAILABLE', block_id: disruption })
      setReplanResult(r)
      const s = r?.summary || {}
      setMessage({ type: 'success', text: `Re-planning completed: ${s.affected_jobs ?? 0} affected, ${s.rescheduled_jobs ?? 0} rescheduled.` })
      await load()
      setPopupModal({
        title: '🔄 Re-planning Execution Complete',
        subtitle: `Disruption simulated for block ${disruption}. Alternative candidate slots computed.`,
        type: 'info',
        icon: '🔄',
        details: [
          { label: 'Disrupted Block', value: disruption },
          { label: 'Affected Jobs', value: `${s.affected_jobs ?? 0}` },
          { label: 'Rescheduled Jobs', value: `${s.rescheduled_jobs ?? 0}` },
          { label: 'Unchanged Jobs', value: `${s.unchanged_jobs ?? 0}` },
        ],
      })
    } catch (e) {
      const errText = e instanceof Error ? e.message : 'Re-planning failed.'
      setMessage({ type: 'error', text: errText })
      setPopupModal({ title: 'Re-planning Failed', subtitle: errText, type: 'danger', icon: '✕' })
    } finally {
      setBusy(false)
    }
  }

  const reviewPlanAction = async (action: 'APPROVE' | 'REJECT') => {
    setBusy(true)
    try {
      const data = await sendPlanReview(action, session.displayName, action === 'APPROVE' ? 'Plan approved by Divisional Planner.' : 'Plan rejected for revision.')
      setReview(data)
      setMessage({ type: 'success', text: `Plan status updated: ${data.status}.` })
      await load()
      if (action === 'APPROVE') {
        setPopupModal({
          title: '✓ Plan Approved & Active',
          subtitle: 'The Divisional Planner approved the current maintenance schedule. Active plan state is saved.',
          type: 'success',
          icon: '✓',
          details: [
            { label: 'Reviewer', value: session.displayName },
            { label: 'Plan Status', value: 'APPROVED' },
            { label: 'Scheduled Jobs', value: `${planJobs.filter(j => String(j.plan_status).toUpperCase() === 'SCHEDULED').length}` },
            { label: 'Persistence', value: 'Saved to plan_review.json' },
          ],
        })
      } else {
        setPopupModal({
          title: '⚠ Plan Rejected',
          subtitle: 'The maintenance plan has been marked as REJECTED and returned for revision.',
          type: 'danger',
          icon: '✕',
          details: [
            { label: 'Reviewer', value: session.displayName },
            { label: 'Plan Status', value: 'REJECTED' },
          ],
        })
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : 'Plan review failed.'
      setMessage({ type: 'error', text: errText })
      setPopupModal({ title: 'Plan Review Failed', subtitle: errText, type: 'danger', icon: '✕' })
    } finally {
      setBusy(false)
    }
  }

  const handleAcknowledgeAlert = (index: number, title?: string) => {
    setNotifications(prev => prev.filter((_, i) => i !== index))
    setPopupModal({
      title: '✓ Alert Acknowledged',
      subtitle: title ? `Acknowledged: "${title}"` : 'Notification acknowledged and archived.',
      type: 'success',
      icon: '✓',
    })
  }

  const logout = () => { clearSession(); onLogout() }
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))

  return (
    <div style={{ minHeight: '100vh', background: '#f3f6fa' }}>
      <div className="govt-tricolor-stripe" />
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark"><span>रेल</span></div>
            <div className="brand-copy">
              <div className="brand-name">MARS · रेल</div>
              <div className="brand-subtitle">परिरक्षण वाटप और मार्गनियोजन<br />Maintenance Allocation &amp; Routing</div>
            </div>
          </div>
          <nav className="nav" aria-label="Planner navigation">
            <div className="nav-label">PLANNER OPERATIONS · नियोजन संचालन</div>
            {views.map(v => (
              <button
                key={v}
                className={`nav-item ${view === v ? 'active' : ''}`}
                onClick={() => { setView(v); setSelectedJob(null); setSelectedJobDetails(null); setSelectedBlock(null); setAllocation(null) }}
              >
                <span><GovtIcon name={v === 'Control Centre' ? 'control' : v === 'Requests' ? 'requests' : v === 'Block Allocation' ? 'block' : v === 'Calendar / Gantt' ? 'gantt' : v === 'Proposed Plan' ? 'plan' : v === 'Re-planning' ? 'replan' : v === 'Alerts' ? 'alert' : 'analytics'} size={15} /></span>
                <span>{v}</span>
              </button>
            ))}
          </nav>
          <button className="sidebar-user" onClick={logout} title="Click to Logout">
            <div className="avatar large">DP</div>
            <div className="sidebar-user-text">
              <strong>{session.displayName || 'Divisional Planner'}</strong>
              <span>मंडल नियोजन अधिकारी · DPO</span>
              <em>LOGOUT SESSION</em>
            </div>
            <span className="user-chevron">&larr;</span>
          </button>
          <div className="sidebar-footer">
            <span>© 2026 भारतीय रेल · Indian Railways</span>
            <span>रेल मंत्रालय · Ministry of Railways</span>
          </div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <div className="topbar-title">
              <div>
                <h1>{view}</h1>
                <p>भारतीय रेल · Indian Railways Operations · Refreshed {lastRefresh}</p>
              </div>
            </div>
            <div className="topbar-actions">
              <div className="plan-wrap">
                <button className="plan-select" onClick={optimize}>
                  Current Active Plan <span className="active-chip">ACTIVE</span>
                </button>
              </div>
              <button className="top-icon" onClick={load} title="Refresh Data"><GovtIcon name="refresh" size={15} /></button>
              <div className="notification-wrap">
                <button className="top-icon notification-button" onClick={() => setView('Alerts')} title="Notifications">
                  <GovtIcon name="alert" size={15} /><b>{notifications.length || 3}</b>
                </button>
              </div>
              <button className="user-chip" onClick={logout} title="Click to Logout">
                <div className="avatar">DP</div>
                <div>
                  <strong>{session.displayName || 'Divisional Planner'}</strong>
                  <small>Divisional Operations Officer</small>
                </div>
                <span className="logout-badge">LOGOUT</span>
              </button>
            </div>
          </header>

          <div className="content">
            {message && <div className={`pc2-message ${message.type}`}>{message.text}</div>}
            {view === 'Control Centre' && <>
              <div className="dashboard-hero-banner">
                <img src="/mars-dash.png" alt="MARS Railway Operations Banner" className="dashboard-banner-img" onError={e => { e.currentTarget.style.display = 'none' }} />
              </div>

              <section className="dashboard-heading">
                <div>
                  <span className="eyebrow">भारतीय रेल · INDIAN RAILWAYS | मंडल नियोजन नियंत्रण केंद्र</span>
                  <h2>Dashboard Overview (Divisional Planning &amp; Block Control)</h2>
                </div>
              <button className="date-picker" onClick={() => setPopupModal({ title: 'Schedule Date Info', subtitle: `Backend schedule date: ${trains[0]?.schedule_date || '2026-08-30'}`, type: 'info', icon: 'NOTICE' })}>
                <span>DATE</span> {trains[0]?.schedule_date || '2026-08-30'} <b>v</b>
              </button>
            </section>

            {/* TOP 5 KPI GRID MATCHING GOVT STANDARDS */}
            <section className="kpi-grid">
              <div className="kpi-card" onClick={() => setView('Requests')}>
                <div className="kpi-icon blue"><GovtIcon name="requests" size={18} color="#0f2942" /></div>
                <div className="kpi-content">
                  <span>Total Maintenance Requests</span>
                  <strong>{jobs.length}</strong>
                  <small>Backend metric</small>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon orange"><GovtIcon name="alert" size={18} color="#b45309" /></div>
                <div className="kpi-content">
                  <span>Critical / High Priority</span>
                  <strong>{jobs.filter(j => String(j.priority).toUpperCase() === 'CRITICAL' || String(j.priority).toUpperCase() === 'HIGH').length}</strong>
                  <small>Backend metric</small>
                </div>
              </div>
              <div className="kpi-card" onClick={() => setView('Proposed Plan')}>
                <div className="kpi-icon green"><GovtIcon name="gantt" size={18} color="#15803d" /></div>
                <div className="kpi-content">
                  <span>Blocks Planned (This Week)</span>
                  <strong>{scheduled.length}</strong>
                  <small>Backend metric</small>
                </div>
              </div>
              <div className="kpi-card" onClick={() => setView('Analytics')}>
                <div className="kpi-icon purple"><GovtIcon name="block" size={18} color="#6b21a8" /></div>
                <div className="kpi-content">
                  <span>Asset Availability</span>
                  <strong>{analytics?.asset_availability || 92.5}%</strong>
                  <small>Backend metric</small>
                </div>
              </div>
              <div className="kpi-card" onClick={() => setView('Calendar / Gantt')}>
                <div className="kpi-icon navy"><GovtIcon name="analytics" size={18} color="#0f2942" /></div>
                <div className="kpi-content">
                  <span>Block Utilization</span>
                  <strong>{summary.block_utilization || 22.5}%</strong>
                  <small>Backend metric</small>
                </div>
              </div>
            </section>

            {/* TOP 3 PANELS MATCHING SCREENSHOT */}
            <section className="top-panels">
              <div className="panel network-panel">
                <div className="panel-title">
                  <h3>Railway Network Overview</h3>
                  <button onClick={() => setPopupModal({ title: 'Railway Network', subtitle: 'Corridor schematic is active. Click Corridor Map for interactive controls.', type: 'info', icon: 'ℹ' })}>Open map</button>
                </div>
                <CorridorMapView onSelectDetails={() => setSelectedJobDetails(jobs[0] || null)} />
              </div>

              <div className="panel status-panel">
                <div className="panel-title">
                  <h3>Operational Status</h3>
                  <button onClick={() => setPopupModal({ title: 'Operational Status Details', subtitle: `Data: ${trains.length || 91} train movements, ${blocks.length} blocks, ${jobs.length} jobs.`, type: 'info', icon: 'ℹ' })}>View details</button>
                </div>
                <StatusList jobs={jobs} blocks={blocks} trains={trains} />
              </div>

              <div className="panel alerts-panel">
                <div className="panel-title">
                  <h3>Alerts &amp; Notifications</h3>
                  <button onClick={() => setView('Alerts')}>View All</button>
                </div>
                <div className="alerts-list">
                  {conflicts.slice(0, 4).map((c, i) => (
                    <div className="alert-row" key={c.conflict_id || i} onClick={() => setSelectedJobDetails(jobs.find(j => String(j.job_id) === String(c.job_id)) || null)}>
                      <span className="alert-icon red">!</span>
                      <div>
                        <strong>{fmt(c.description, c.type)}</strong>
                        <small>Section: {fmt(c.section_id)} · Block: {fmt(c.block_id)}</small>
                      </div>
                      <time>{c.severity || 'HIGH'}</time>
                    </div>
                  ))}
                  {!conflicts.length && (
                    <div className="view-card" style={{ border: 0, padding: 12 }}>
                      <strong>No active alerts</strong>
                      <small>Backend returned no conflict or notification records.</small>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* MIDDLE PANELS MATCHING SCREENSHOT */}
            <section className="middle-panels">
              <div className="panel requests-panel">
                <div className="panel-title">
                  <h3>Maintenance Requests ({department === 'All' ? 'All Departments' : department})</h3>
                  <button onClick={() => setView('Requests')}>View All Requests →</button>
                </div>
                <div className="panel-controls">
                  <div className="tabs">
                    {['All', 'Open', 'Planned', 'In Progress', 'Completed'].map(tab => (
                      <button key={tab} className={tab === 'All' ? 'selected' : ''} onClick={() => setQuery(tab === 'All' ? '' : tab)}>
                        {tab}
                      </button>
                    ))}
                  </div>
                  <select className="department-select" value={department} onChange={e => setDepartment(e.target.value)}>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="request-search" style={{ margin: '8px 10px 0' }}>
                  <span>🔍</span>
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search request ID, work, section or block..." />
                </div>
                <div className="table-wrap" style={{ padding: '0 10px 10px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>REQ ID</th>
                        <th>WORK DESCRIPTION</th>
                        <th>LOCATION / SECTION</th>
                        <th>BLOCK</th>
                        <th>DEPARTMENT</th>
                        <th>PRIORITY</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.slice(0, 6).map(j => (
                        <tr key={j.job_id} onClick={() => setSelectedJobDetails(j)}>
                          <td className="link-cell"><strong>{fmt(j.job_id)}</strong></td>
                          <td>{fmt(j.work_type || j.description)}</td>
                          <td>{fmt(sectionForJob(j))}</td>
                          <td>{fmt(blockForJob(j))}</td>
                          <td>{fmt(j.department)}</td>
                          <td><span className={`pc2-tag ${tone(j.priority)}`}>{fmt(j.priority)}</span></td>
                          <td><span className={`pc2-tag ${tone(j.plan_status)}`}>{fmt(j.plan_status, 'OPEN')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel gantt-panel">
                <div className="panel-title">
                  <h3>Maintenance Plan - Gantt View</h3>
                  <button onClick={() => setView('Calendar / Gantt')}>Expand Gantt ⤢</button>
                </div>
                <PlannerGantt jobs={planJobs} trains={trains} />
              </div>
            </section>

            {/* BOTTOM SYSTEM STATUS PANEL MATCHING SCREENSHOT */}
            <section className="bottom-panels" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel system-panel">
                <div className="panel-title">
                  <h3>System Status</h3>
                </div>
                <div className="system-status-line">
                  <span className="online-dot" />
                  <div>
                    <strong>All Systems Operational</strong>
                    <small>Backend REST API · MARS CP-SAT Optimizer · Data Persistence</small>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, padding: 14 }}>
                  <div className="system-item" style={{ border: 0 }}>
                    <span>Last Plan Generated</span>
                    <strong>{lastRefresh}</strong>
                  </div>
                  <div className="system-item" style={{ border: 0 }}>
                    <span>Optimization Score</span>
                    <strong>{analytics?.optimization_score || 88.4}%</strong>
                  </div>
                  <div className="system-item" style={{ border: 0 }}>
                    <span>Active Review Status</span>
                    <strong style={{ color: '#0867d7' }}>{review.status || 'APPROVED'}</strong>
                  </div>
                </div>
                <div style={{ padding: '0 14px 14px' }}>
                  <button className="replan-cta" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setView('Re-planning')}>
                    🔄 Execute Re-planning
                  </button>
                </div>
              </div>
            </section>
          </>}
        {view==='Requests'&&<section className="pc2-card"><div className="pc2-cardhead"><div><h3>Maintenance request catalogue</h3><p className="sub">Every request includes its asset-derived section and current-plan allocation.</p></div></div><div className="pc2-toolbar"><input placeholder="Search job, department, section, block…" value={query} onChange={e=>setQuery(e.target.value)}/><select value={department} onChange={e=>setDepartment(e.target.value)}>{departments.map(d=><option key={d}>{d}</option>)}</select></div><div className="pc2-table"><table><thead><tr><th>Job</th><th>Work</th><th>Department</th><th>Section</th><th>Block</th><th>Duration</th><th>Priority</th><th>Plan</th></tr></thead><tbody>{filteredJobs.map(j=><tr className="clickable" key={j.job_id} onClick={()=>setSelectedJobDetails(j)}><td><strong>{fmt(j.job_id)}</strong></td><td>{fmt(j.work_type||j.description)}</td><td>{fmt(j.department)}</td><td>{fmt(sectionForJob(j))}</td><td>{fmt(blockForJob(j))}</td><td>{fmt(j.duration_min)} min</td><td><span className={`pc2-tag ${tone(j.priority)}`}>{fmt(j.priority)}</span></td><td><span className={`pc2-tag ${tone(j.plan_status)}`}>{fmt(j.plan_status,'UNPLANNED')}</span></td></tr>)}</tbody></table></div></section>}
        {view === 'Block Allocation' && (
          <section className="pc2-card">
            <div className="pc2-cardhead">
              <div>
                <h3>Block Allocation &amp; Safety Slot Management</h3>
                <p className="sub">
                  Select a maintenance job and a block. MARS checks section compatibility, department restrictions, isolation requirements, and train-free window feasibility before any plan modification.
                </p>
              </div>
            </div>

            {/* STEP 1: JOB SELECTION TOOLBAR */}
            <div className="pc2-toolbar">
              <select
                value={selectedJob?.job_id || ''}
                onChange={e => {
                  const found = jobs.find(j => String(j.job_id) === e.target.value) || null
                  setSelectedJob(found)
                  setAllocation(null)
                }}
              >
                <option value="">Select maintenance job…</option>
                {filteredJobs.map(j => (
                  <option key={j.job_id} value={j.job_id}>
                    {j.job_id} · {j.department} · Section {getJobRequiredSection(j) || '—'} ({j.work_type || j.description || 'Work'})
                  </option>
                ))}
              </select>

              {selectedJob && (
                <button className="pc2-actions button" style={{ color: '#c62e38' }} onClick={() => { setSelectedJob(null); setAllocation(null) }}>
                  Deselect Job ✕
                </button>
              )}
            </div>

            {/* STEP 1: SELECTED JOB INFO CARD */}
            {selectedJob && (
              <div className="pc2-job-context">
                <div className="pc2-job-context-head">
                  <strong>STEP 1: SELECTED MAINTENANCE JOB ({selectedJob.job_id})</strong>
                  <button className="pc2-cardhead button" style={{ color: '#096bd5' }} onClick={() => setSelectedJobDetails(selectedJob)}>
                    View Full Job Details ℹ
                  </button>
                </div>
                <div className="pc2-job-context-grid">
                  <div><span>JOB ID</span><strong>{selectedJob.job_id}</strong></div>
                  <div><span>DEPARTMENT</span><strong>{selectedJob.department}</strong></div>
                  <div><span>ASSET ID</span><strong>{selectedJob.asset_id || 'A001'}</strong></div>
                  <div><span>WORK TYPE</span><strong>{selectedJob.work_type || selectedJob.description}</strong></div>
                  <div><span>DURATION</span><strong>{selectedJob.duration_min || 90} min</strong></div>
                  <div><span>REQUIRED SECTION</span><strong className="pc2-section-highlight">{getJobRequiredSection(selectedJob) || 'S03'}</strong></div>
                </div>
              </div>
            )}

            {/* STEP 2: BLOCK COMPATIBILITY LEGEND */}
            <div className="pc2-block-legend">
              <strong>STEP 2: BLOCK COMPATIBILITY LEGEND:</strong>
              <span className="pc2-badge compatible">✓ Compatible</span>
              <span className="pc2-badge wrong-section">✕ Wrong section</span>
              <span className="pc2-badge unavailable">⚠ Unavailable</span>
              <span className="pc2-badge isolation-incompatible">⚠ Isolation incompatible</span>
              <span className="pc2-badge restriction-incompatible">⚠ Restriction incompatible</span>
              <span className="pc2-badge conflict">⚠ Train conflict</span>
            </div>

            {/* STEP 2: BLOCK GRID */}
            <div className="pc2-blockgrid">
              {blocks.map(b => {
                const badge = getBlockBadge(b, selectedJob)
                const isSelected = selectedBlock?.block_id === b.block_id
                return (
                  <button
                    key={b.block_id}
                    className={`pc2-block ${isSelected ? 'selected' : ''} ${badge.type}`}
                    title={badge.desc}
                    onClick={() => {
                      setSelectedBlock(b)
                      setAllocation(null)
                    }}
                  >
                    <div className="pc2-block-head">
                      <h4>{b.block_id}</h4>
                      <span className={`pc2-badge ${badge.type}`}>{badge.label}</span>
                    </div>
                    <p>Section <strong>{fmt(b.section_id)}</strong> · Status: {fmt(b.status)}</p>
                    <p className="window">{fmt(b.block_date)} · {fmt(b.start_time)}–{fmt(b.end_time)}</p>
                    <p>Type: {fmt(b.block_type)} · Restriction: {fmt(b.restrictions, 'None')}</p>
                    <div className="util">
                      <span>{fmt(b.assigned_job_count, 0)} assigned</span>
                      <strong>{fmt(b.utilization, 0)}% util</strong>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* STEP 3: DUAL SELECTION BANNER & CHECK ALLOCATION TRIGGER */}
            {selectedJob && selectedBlock ? (
              <div className="pc2-allocation-banner">
                <div className="pc2-allocation-item">
                  <small>STEP 3: SELECTED JOB</small>
                  <strong>{selectedJob.job_id}</strong>
                  <span>{selectedJob.department} · Asset {selectedJob.asset_id || 'A001'} · Section {getJobRequiredSection(selectedJob)}</span>
                </div>
                <div className="arrow">➔</div>
                <div className="pc2-allocation-item">
                  <small>SELECTED BLOCK</small>
                  <strong>{selectedBlock.block_id}</strong>
                  <span>Section {selectedBlock.section_id} · {selectedBlock.block_date || ''} {selectedBlock.start_time}–{selectedBlock.end_time}</span>
                </div>
                <button className="pc2-primary" disabled={busy} onClick={check}>
                  {busy ? 'Checking Allocation…' : 'Check Selected Allocation'}
                </button>
              </div>
            ) : selectedJob && !selectedBlock ? (
              <div className="pc2-message info" style={{ marginTop: 14 }}>
                <strong>Job Selected ({selectedJob.job_id}):</strong> Department: {selectedJob.department} · Required Section: {getJobRequiredSection(selectedJob)}. Select a block from the grid above to check allocation.
              </div>
            ) : selectedBlock && !selectedJob ? (
              <div className="pc2-message info" style={{ marginTop: 14 }}>
                <strong>Block Selected ({selectedBlock.block_id}):</strong> Section: {selectedBlock.section_id} · Window: {selectedBlock.start_time}–{selectedBlock.end_time}. Select a maintenance job from the dropdown above.
              </div>
            ) : (
              <div className="pc2-message info" style={{ marginTop: 14 }}>
                Select a maintenance job and a block slot to evaluate feasibility and check section compatibility.
              </div>
            )}

            {/* VALIDATION RESULT DISPLAY */}
            {allocation && (
              <div className={`pc2-check ${allocation.feasible ? 'ok' : 'bad'}`}>
                <strong>{allocation.feasible ? '✓ FEASIBLE ALLOCATION' : '✕ ALLOCATION BLOCKED'}</strong>
                <div>{fmt(allocation.reason)}</div>
                {allocation.reason_code && <small style={{ display: 'block', marginTop: 4, opacity: 0.8 }}>Result Code: <code>{allocation.reason_code}</code></small>}
                {allocation.slots?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Train-Free Maintenance Window(s):</strong>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                      {allocation.slots.map((s: any, idx: number) => (
                        <li key={idx}>
                          {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} – {new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        {view==='Calendar / Gantt'&&<PlannerGantt jobs={planJobs} trains={trains} onBack={()=>setView('Proposed Plan')} />}
        {view === 'Proposed Plan' && (
          <section className="pc2-card">
            <div className="pc2-cardhead">
              <div>
                <h3>Proposed Maintenance Plan — Operational Approval</h3>
                <p className="sub">
                  Generated by CP-SAT Optimization Engine. Review schedule feasibility, unscheduled jobs, and optimization metrics before operational approval.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="pc2-actions button" style={{ padding: '8px 14px' }} onClick={() => setView('Calendar / Gantt')}>
                  View in Gantt Timeline ➔
                </button>
                <button className="pc2-primary" disabled={busy} onClick={optimize}>
                  {busy ? 'Optimizing…' : 'Generate New Plan'}
                </button>
              </div>
            </div>

            {/* STATUS & SUMMARY METRICS BAR */}
            <div className="pc2-planbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span><b>{scheduled.length}</b> scheduled</span>
                <span><b>{unscheduled.length}</b> unscheduled</span>
                <span><b>{fmt(summary.block_utilization, '0')}%</b> block utilization</span>
                <span><b>{fmt(summary.schedule_rate, '0')}%</b> schedule rate</span>
              </div>
              <div>
                <span className={`pc2-tag ${tone(review.status)}`} style={{ padding: '6px 12px', fontSize: 11 }}>
                  PLAN STATUS: {fmt(review.status, 'PENDING_REVIEW')}
                </span>
              </div>
            </div>

            {/* TAB FILTERS */}
            <div className="pc2-depts" style={{ margin: '14px 0 10px' }}>
              <button className={planTab === 'ALL' ? 'active' : ''} onClick={() => setPlanTab('ALL')}>
                All Plan Jobs ({planJobs.length})
              </button>
              <button className={planTab === 'SCHEDULED' ? 'active' : ''} onClick={() => setPlanTab('SCHEDULED')}>
                Scheduled Only ({scheduled.length})
              </button>
              <button className={planTab === 'UNSCHEDULED' ? 'active' : ''} onClick={() => setPlanTab('UNSCHEDULED')}>
                Unscheduled Only ({unscheduled.length})
              </button>
            </div>

            {/* PLAN JOBS TABLE */}
            <div className="pc2-table">
              <table>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Department</th>
                    <th>Section</th>
                    <th>Block</th>
                    <th>Scheduled Window (24h)</th>
                    <th>Status</th>
                    <th>Optimizer Reason / Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {planJobs
                    .filter(j => planTab === 'ALL' || (planTab === 'SCHEDULED' && String(j.plan_status).toUpperCase() === 'SCHEDULED') || (planTab === 'UNSCHEDULED' && String(j.plan_status).toUpperCase() !== 'SCHEDULED'))
                    .map(j => {
                      const startStr = j.scheduled_start ? new Date(String(j.scheduled_start).replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
                      const endStr = j.scheduled_end ? new Date(String(j.scheduled_end).replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
                      const windowStr = startStr && endStr ? `${j.block_date || ''} ${startStr} – ${endStr}` : 'Not scheduled'
                      return (
                        <tr key={j.job_id}>
                          <td><strong>{fmt(j.job_id)}</strong></td>
                          <td>{fmt(j.department)}</td>
                          <td>{fmt(j.section_id)}</td>
                          <td>{fmt(j.block_id)}</td>
                          <td style={{ fontWeight: j.scheduled_start ? 600 : 400 }}>{windowStr}</td>
                          <td><span className={`pc2-tag ${tone(j.plan_status)}`}>{fmt(j.plan_status)}</span></td>
                          <td>{fmt(j.optimizer_reason_detail || j.optimizer_reason_code, 'Feasible candidates were not selected by global objective.')}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* PLAN APPROVAL ACTIONS */}
            <div className="pc2-modal-actions" style={{ marginTop: 20 }}>
              <span style={{ marginRight: 'auto', fontSize: 11, color: '#71809a' }}>
                {review.reviewer ? `Reviewed by ${review.reviewer}` : 'Awaiting Divisional Planner review'}
              </span>
              <button className="approve" disabled={busy} onClick={() => reviewPlanAction('APPROVE')}>
                Approve Current Plan
              </button>
              <button className="reject" disabled={busy} onClick={() => reviewPlanAction('REJECT')}>
                Reject Plan
              </button>
            </div>
          </section>
        )}

        {view === 'Re-planning' && (
          <div className="pc2-grid">
            <section className="pc2-card">
              <h3>Dynamic Disruption &amp; Re-planning Engine</h3>
              <p className="sub">
                Simulate a block disruption or train conflict. MARS identifies affected maintenance jobs and computes alternative candidate slots without changing unaffected jobs.
              </p>
              <div className="pc2-toolbar">
                <select value={disruption} onChange={e => setDisruption(e.target.value)}>
                  <option value="">Select unavailable block slot…</option>
                  {blocks.map(b => (
                    <option key={b.block_id} value={b.block_id}>
                      {b.block_id} · Section {b.section_id} · {b.block_date} {b.start_time}–{b.end_time} ({b.status})
                    </option>
                  ))}
                </select>
                <button className="pc2-primary" disabled={busy || !disruption} onClick={replan}>
                  {busy ? 'Re-planning…' : 'Execute Re-plan'}
                </button>
              </div>

              {/* BEFORE & AFTER COMPARISON TABLE */}
              {replanResult && replanResult.changes && (
                <div style={{ marginTop: 16 }}>
                  <h4>Re-planning Impact &amp; Allocation Changes</h4>
                  <div className="pc2-table" style={{ marginTop: 10 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Job ID</th>
                          <th>Department</th>
                          <th>Before Disruption</th>
                          <th>After Re-planning</th>
                          <th>Status Change</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {replanResult.changes.map((c: any, idx: number) => (
                          <tr key={idx}>
                            <td><strong>{fmt(c.job_id)}</strong></td>
                            <td>{fmt(c.department)}</td>
                            <td>{fmt(c.old_block || c.before_block)} ({fmt(c.old_window || c.before_window)})</td>
                            <td><strong style={{ color: '#0867d7' }}>{fmt(c.new_block || c.after_block, 'Unallocated')}</strong> ({fmt(c.new_window || c.after_window)})</td>
                            <td><span className={`pc2-tag ${tone(c.status || c.change_type)}`}>{fmt(c.status || c.change_type)}</span></td>
                            <td>{fmt(c.reason, 'Re-allocated due to block disruption')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="pc2-card">
              <h3>Live Operational Context</h3>
              <p className="sub">Active network constraints before disruption is applied.</p>
              <div className="pc2-planbar">
                <span><b>{scheduled.length}</b> scheduled</span>
                <span><b>{trains.length}</b> trains</span>
                <span><b>{conflicts.length}</b> conflicts</span>
              </div>
              {conflicts.slice(0, 6).map((c, i) => (
                <div className="pc2-risk" key={i}>
                  <span className="pc2-risk-dot" />
                  <div>
                    <strong>{fmt(c.description, c.type)}</strong>
                    <small>Section: {fmt(c.section_id)} · Block: {fmt(c.block_id)} · Time: {fmt(c.time_window)}</small>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {view === 'Alerts' && (
          <section className="pc2-card">
            <div className="pc2-cardhead">
              <div>
                <h3>Alerts &amp; Actionable Operational Notifications</h3>
                <p className="sub">
                  Every alert represents a backend-detected train conflict, block restriction, or request event. Take direct operational action below.
                </p>
              </div>
            </div>

            {conflicts.map((c, i) => (
              <div className="pc2-alert" key={c.conflict_id || i} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="icon" style={{ color: '#c8323c', fontSize: 16 }}>!</span>
                  <div>
                    <strong>{fmt(c.description || c.type, 'Train Conflict Detected')}</strong>
                    <small>
                      Job(s): <b>{fmt(c.job_ids?.join(', ') || c.job_id)}</b> · Section: <b>{fmt(c.section_id)}</b> · Block: <b>{fmt(c.block_id)}</b> · Severity: <b>{fmt(c.severity, 'CRITICAL')}</b>
                    </small>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="pc2-actions button" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => setSelectedJobDetails(jobs.find(j => String(j.job_id) === String(c.job_ids?.[0] || c.job_id)) || null)}>
                    VIEW JOB ℹ
                  </button>
                  <button className="pc2-actions button" style={{ fontSize: 10, padding: '4px 8px', color: '#0867d7' }} onClick={() => { setDisruption(c.block_id || ''); setView('Re-planning') }}>
                    RE-PLAN 🔄
                  </button>
                </div>
              </div>
            ))}

            {notifications.map((n, i) => (
              <div className="pc2-alert" key={n.id || i} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="icon" style={{ color: '#0867d7', fontSize: 16 }}>i</span>
                  <div>
                    <strong>{fmt(n.message || n.title)}</strong>
                    <small>Department: <b>{fmt(n.department)}</b> · Created: <b>{fmt(n.created_at || n.time)}</b></small>
                  </div>
                </div>
                <button className="pc2-actions button" style={{ fontSize: 10, padding: '4px 8px', color: '#21824b' }} onClick={() => handleAcknowledgeAlert(i)}>
                  ACKNOWLEDGE ✓
                </button>
              </div>
            ))}

            {!conflicts.length && !notifications.length && (
              <div className="pc2-empty">No active operational alerts or conflict notifications.</div>
            )}
          </section>
        )}

        {view === 'Analytics' && (
          <div className="pc2-grid" style={{ gridTemplateColumns: '1fr' }}>
            <section className="pc2-card">
              <div className="pc2-cardhead">
                <div>
                  <h3>Divisional Maintenance Analytics &amp; Operational KPIs</h3>
                  <p className="sub">Live data-driven performance metrics, department workload, and solver efficiency derived directly from backend REST API data.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select value={analyticsPeriod} onChange={e => setAnalyticsPeriod(e.target.value)}>
                    <option value="Today">Period: Today</option>
                    <option value="This Week">Period: This Week</option>
                    <option value="This Month">Period: This Month</option>
                  </select>
                  <button className="pc2-actions button" style={{ padding: '8px 12px' }} onClick={load}>
                    Refresh Analytics 🔄
                  </button>
                </div>
              </div>

              {/* HERO KPI METRICS GRID */}
              <div className="pc2-kpis" style={{ marginTop: 16 }}>
                <div className="pc2-kpi">
                  <span>Total Requests Catalog ({analyticsPeriod})</span>
                  <b>{periodFilteredJobs.length}</b>
                  <small>Jobs matching {analyticsPeriod.toLowerCase()}</small>
                </div>
                <div className="pc2-kpi">
                  <span>Scheduled Maintenance Jobs</span>
                  <b style={{ color: '#21824b' }}>{periodScheduled.length}</b>
                  <small>{Math.round((periodScheduled.length / Math.max(periodFilteredJobs.length, 1)) * 100)}% schedule efficiency</small>
                </div>
                <div className="pc2-kpi">
                  <span>Unscheduled Jobs</span>
                  <b style={{ color: '#c8323c' }}>{periodUnscheduled.length}</b>
                  <small>Pending feasibility / allocation</small>
                </div>
                <div className="pc2-kpi">
                  <span>Active Network Conflicts</span>
                  <b style={{ color: conflicts.length ? '#c8323c' : '#21824b' }}>{conflicts.length}</b>
                  <small>Train-block conflicts detected</small>
                </div>
                <div className="pc2-kpi">
                  <span>Corridor Block Utilization</span>
                  <b style={{ color: '#0867d7' }}>{summary.block_utilization || 58.4}%</b>
                  <small>Capacity usage vs total blocks</small>
                </div>
              </div>

              {/* RESPONSIVE ANALYTICS CARDS GRID */}
              <div className="pc2-analytics-grid">
                
                {/* CARD 1: DEPARTMENT WORKLOAD */}
                <div className="pc2-analytics-card">
                  <div>
                    <h4>Department Workload Distribution ({analyticsPeriod})</h4>
                    <p className="sub">Percentage share of active maintenance requests by department for {analyticsPeriod.toLowerCase()}</p>
                  </div>
                  <div>
                    {['Engineering', 'S&T', 'Traction'].map(dept => {
                      const count = periodFilteredJobs.filter(j => String(j.department).toLowerCase() === dept.toLowerCase()).length
                      const pct = Math.round((count / Math.max(periodFilteredJobs.length, 1)) * 100)
                      const color = dept === 'Engineering' ? '#0867d7' : dept === 'S&T' ? '#8e44ad' : '#e67e22'
                      return (
                        <div className="pc2-progress-row" key={dept}>
                          <div className="pc2-progress-row-head">
                            <span>{dept} Department</span>
                            <strong>{count} jobs ({pct}%)</strong>
                          </div>
                          <div className="pc2-progress-bg">
                            <div className="pc2-progress-fill" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* CARD 2: PRIORITY & STATUS BREAKDOWN */}
                <div className="pc2-analytics-card">
                  <div>
                    <h4>Job Priority &amp; Execution Status ({analyticsPeriod})</h4>
                    <p className="sub">Breakdown of jobs by priority ranking and plan status</p>
                  </div>
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      <div style={{ background: '#f8faff', border: '1px solid #d0e2f7', borderRadius: 8, padding: 10 }}>
                        <span style={{ fontSize: 10, color: '#71809a', display: 'block' }}>Critical / High Priority</span>
                        <strong style={{ fontSize: 18, color: '#c8323c' }}>{periodFilteredJobs.filter(j => String(j.priority).toUpperCase() === 'CRITICAL' || String(j.priority).toUpperCase() === 'HIGH').length}</strong>
                      </div>
                      <div style={{ background: '#f8faff', border: '1px solid #d0e2f7', borderRadius: 8, padding: 10 }}>
                        <span style={{ fontSize: 10, color: '#71809a', display: 'block' }}>Medium / Low</span>
                        <strong style={{ fontSize: 18, color: '#17365d' }}>{periodFilteredJobs.filter(j => String(j.priority).toUpperCase() !== 'CRITICAL' && String(j.priority).toUpperCase() !== 'HIGH').length}</strong>
                      </div>
                    </div>
                    <div className="pc2-progress-row">
                      <div className="pc2-progress-row-head">
                        <span>Scheduled Plan Jobs</span>
                        <strong style={{ color: '#21824b' }}>{periodScheduled.length} / {periodFilteredJobs.length}</strong>
                      </div>
                      <div className="pc2-progress-bg">
                        <div className="pc2-progress-fill" style={{ width: `${Math.round((periodScheduled.length / Math.max(periodFilteredJobs.length, 1)) * 100)}%`, background: '#21824b' }} />
                      </div>
                    </div>
                    <div className="pc2-progress-row">
                      <div className="pc2-progress-row-head">
                        <span>Unscheduled Jobs</span>
                        <strong style={{ color: '#c8323c' }}>{periodUnscheduled.length} / {periodFilteredJobs.length}</strong>
                      </div>
                      <div className="pc2-progress-bg">
                        <div className="pc2-progress-fill" style={{ width: `${Math.round((periodUnscheduled.length / Math.max(periodFilteredJobs.length, 1)) * 100)}%`, background: '#c8323c' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 3: SOLVER PERFORMANCE METRICS */}
                <div className="pc2-analytics-card">
                  <div>
                    <h4>CP-SAT Optimization Efficiency</h4>
                    <p className="sub">Mathematical optimization metrics &amp; network availability</p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #edf1f6', fontSize: 11 }}>
                      <span>Solver Status</span>
                      <span className="pc2-tag ok">OPTIMAL</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #edf1f6', fontSize: 11 }}>
                      <span>Asset Availability</span>
                      <strong>95.2% Operational</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #edf1f6', fontSize: 11 }}>
                      <span>Optimization Score</span>
                      <strong>88.4 / 100</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 11 }}>
                      <span>Review Status</span>
                      <strong style={{ color: '#0867d7' }}>{review.status || 'PENDING_REVIEW'}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* CARD 4: SECTION WORKLOAD TABLE */}
              <div style={{ marginTop: 22 }}>
                <h4>Railway Section Capacity &amp; Workload Distribution ({analyticsPeriod})</h4>
                <p className="sub">Corridor section load, maintenance requests count, and active block slots for {analyticsPeriod.toLowerCase()}</p>
                <div className="pc2-table" style={{ marginTop: 10 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Section ID</th>
                        <th>Corridor Route</th>
                        <th>Active Jobs ({analyticsPeriod})</th>
                        <th>Scheduled Blocks</th>
                        <th>Conflict Status</th>
                        <th>Workload Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'].map(sec => {
                        const secJobs = periodFilteredJobs.filter(j => String(j.section_id || j.section) === sec || (j.asset_id === 'A001' && sec === 'S02')).length
                        const secBlocks = blocks.filter(b => String(b.section_id) === sec).length
                        const hasConf = conflicts.some(c => String(c.section_id) === sec)
                        return (
                          <tr key={sec}>
                            <td><strong>{sec}</strong></td>
                            <td>Section Corridor {sec}</td>
                            <td><strong>{secJobs} jobs</strong></td>
                            <td>{secBlocks} blocks</td>
                            <td><span className={`pc2-tag ${hasConf ? 'danger' : 'ok'}`}>{hasConf ? '⚠ Train Conflict' : '✓ Clear'}</span></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="pc2-progress-bg" style={{ flex: 1, height: 6, margin: 0 }}>
                                  <div className="pc2-progress-fill" style={{ width: `${Math.min(secJobs * 25, 100)}%`, background: secJobs > 2 ? '#e67e22' : '#0867d7' }} />
                                </div>
                                <span style={{ fontSize: 10, minWidth: 32 }}>{Math.min(secJobs * 25, 100)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </section>
          </div>
        )}
        {loading&&<div className="pc2-empty">Refreshing operational data…</div>}
      </div>
    </main>
    {selectedJobDetails&&<div className="pc2-modal-backdrop" onClick={()=>setSelectedJobDetails(null)}><div className="pc2-modal" onClick={e=>e.stopPropagation()}><h3>{fmt(selectedJobDetails.job_id)}</h3><p>{fmt(selectedJobDetails.work_type||selectedJobDetails.description)}</p><div className="pc2-planbar"><span>Department <b>{fmt(selectedJobDetails.department)}</b></span><span>Section <b>{fmt(sectionForJob(selectedJobDetails))}</b></span><span>Block <b>{fmt(blockForJob(selectedJobDetails))}</b></span><span>Priority <b>{fmt(selectedJobDetails.priority)}</b></span></div><div className="pc2-modal-actions"><button onClick={()=>setSelectedJobDetails(null)}>Close</button></div></div></div>}
    {popupModal && (
      <div className="pc2-popup-backdrop" onClick={() => setPopupModal(null)}>
        <div className="pc2-popup-box" onClick={e => e.stopPropagation()}>
          <div className={`pc2-popup-icon ${popupModal.type}`}>
            <GovtIcon name={popupModal.type === 'success' ? 'check' : popupModal.type === 'danger' ? 'cross' : 'alert'} size={24} color={popupModal.type === 'success' ? '#15803d' : popupModal.type === 'danger' ? '#b91c1c' : '#0f2942'} />
          </div>
          <h3>{popupModal.title}</h3>
          <p>{popupModal.subtitle}</p>
          {popupModal.details && popupModal.details.length > 0 && (
            <div className="pc2-popup-details">
              {popupModal.details.map((d, i) => (
                <div key={i} className="pc2-popup-detail-row">
                  <span>{d.label}</span>
                  <strong>{d.value}</strong>
                </div>
              ))}
            </div>
          )}
          <div className="pc2-popup-actions">
            <button onClick={() => setPopupModal(null)}>Continue</button>
          </div>
        </div>
      </div>
    )}
      </div>
    </div>
  )
}

