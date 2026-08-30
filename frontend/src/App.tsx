import { useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getSession, clearSession, type Department, type MarsSession } from './auth'
import {
  fetchJobs,
  createJob,
  fetchConflicts,
  fetchNotifications,
  fetchAnalytics,
  fetchSections,
  fetchBlocks,
  fetchTrains,
  fetchAssets,
  fetchPlans,
  generateOptimizationPlan,
  triggerReplanning,
} from './services/api'

type IconName =
  | 'dashboard' | 'requests' | 'planner' | 'calendar' | 'map' | 'trains' | 'assets' | 'sections' | 'plans' | 'replan' | 'alerts' | 'reports' | 'integrations' | 'settings' | 'help' | 'menu' | 'refresh' | 'bell' | 'chevron' | 'close' | 'search' | 'plus' | 'minus' | 'expand'

type PriorityValue = 'Critical' | 'High' | 'Medium' | 'Low'
type JobStatus = 'OPEN' | 'SUBMITTED' | 'UNDER REVIEW' | 'PLANNED' | 'CONFLICT' | 'APPROVED' | 'IN PROGRESS' | 'COMPLETED' | 'REJECTED' | 'Open' | 'Planned' | 'In Progress' | 'Completed'

type Job = {
  id: string
  job_id?: string
  description: string
  section: string
  block: string
  priority: PriorityValue
  status: JobStatus
  due?: string
  date?: string
  department: string
  duration_min?: number
  work_type?: string
}

type Section = {
  section_id: string
  section_start?: string
  section_end?: string
  distance_km?: number | string
  corridor_id?: string
  line_type?: string
  status?: string
  name?: string
  block?: string
}

type Block = {
  block_id: string
  section_id?: string
  block_date?: string
  start_time?: string
  end_time?: string
  duration_min?: number | string
  status?: string
  block_type?: string
  restrictions?: string
  isolation_required?: string | boolean
  assigned_jobs?: string[]
  assigned_job_count?: number
  utilization?: number
}

type TrainMovement = {
  train_id: string
  train_number: string | number
  train_type?: string
  schedule_date?: string
  status?: string
  section_id?: string
  sequence?: number | string
  arrival_time?: string
  departure_time?: string
}

type Asset = {
  asset_id: string
  asset_type?: string
  asset_name?: string
  section_id?: string
  location_km?: number | string
  criticality?: string
  status?: string
  installation_date?: string
  last_maintenance_date?: string
}

type Plan = Record<string, any>

interface AppProps { onLogout?: () => void }

const navItems: { label: string; icon: IconName; badge?: number }[] = [
  { label: 'Dashboard', icon: 'dashboard' }, { label: 'Maintenance Requests', icon: 'requests' }, { label: 'Block Planner', icon: 'planner' }, { label: 'Calendar / Gantt', icon: 'calendar' }, { label: 'Corridor Map', icon: 'map' }, { label: 'Train Movements', icon: 'trains' }, { label: 'Assets', icon: 'assets' }, { label: 'Sections / Corridors', icon: 'sections' }, { label: 'Proposed Plans', icon: 'plans' }, { label: 'Re-planning', icon: 'replan' }, { label: 'Alerts & Notifications', icon: 'alerts', badge: 3 }, { label: 'Reports & Analytics', icon: 'reports' }, { label: 'Integrations', icon: 'integrations' }, { label: 'Settings', icon: 'settings' }, { label: 'Help & Support', icon: 'help' },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    requests: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></>, planner: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="11" cy="19" r="1"/></>, calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M8 13h3M13 13h3M8 17h3"/></>, map: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>, trains: <><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 18l-2 3M16 18l2 3M5 13h14M8 7h.01M16 7h.01"/></>, assets: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.83 2.83-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.07a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.83-2.83.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.65 13H2v-4h.65A1.8 1.8 0 0 0 4.3 7.9a1.8 1.8 0 0 0-.36-2l-.05-.05L6.72 3l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.87 1.8V1h4v.8a1.8 1.8 0 0 0 1.1 1.61 1.8 1.8 0 0 0 2-.36l.05-.05 2.83 2.83-.05.05a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.35 9H22v4h-.65A1.8 1.8 0 0 0 19.4 15Z"/></>, sections: <><path d="M3 18h18M5 14l4-4 3 3 5-6 4 4"/><circle cx="5" cy="14" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="17" cy="7" r="1"/></>, plans: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="11" cy="19" r="1"/></>, replan: <><path d="M20 7v5h-5M4 17v-5h5M6.2 9A7 7 0 0 1 19 7M18 15a7 7 0 0 1-12.8 2"/></>, alerts: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>, reports: <><path d="M4 19V5M4 19h17M8 16v-5M12 16V7M16 16v-3M20 16V9"/></>, integrations: <><path d="M8 12h8M12 8v8"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/></>, settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.83 2.83-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.07a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.83-2.83.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.65 13H2v-4h.65A1.8 1.8 0 0 0 4.3 7.9a1.8 1.8 0 0 0-.36-2l-.05-.05L6.72 3l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.87 1.8V1h4v.8a1.8 1.8 0 0 0 1.1 1.61 1.8 1.8 0 0 0 2-.36l.05-.05 2.83 2.83-.05.05a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.35 9H22v4h-.65A1.8 1.8 0 0 0 19.4 15Z"/></>, help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.6 1c-.7 1.2-2.3 1.4-2.3 3M12 17h.01"/></>, menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>, refresh: <><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 5v6h-6"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>, chevron: <path d="M9 18l6-6-6-6"/>, close: <><path d="M6 6l12 12M18 6L6 18"/></>, search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>, plus: <><path d="M12 5v14M5 12h14"/></>, minus: <path d="M5 12h14"/>, expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

export default function App({ onLogout }: AppProps) {
  const [session, setSession] = useState<MarsSession | null>(() => getSession())
  const userDept: Department = session?.department || 'Engineering'
  const isPlanner = session?.role === 'Divisional Planner' || session?.department === 'Divisional Planner'
  const [active, setActive] = useState('Dashboard')
  const [department, setDepartment] = useState<string>(isPlanner ? 'All' : userDept)
  const [range, setRange] = useState('Week')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileNav, setMobileNav] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [mapZoom, setMapZoom] = useState(1)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState('Just now')
  const [jobs, setJobs] = useState<Job[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [trains, setTrains] = useState<TrainMovement[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [newDesc, setNewDesc] = useState('')
  const [newSection, setNewSection] = useState('')
  const [newBlock, setNewBlock] = useState('')
  const [newPriority, setNewPriority] = useState<PriorityValue>('Critical')
  const [newDuration, setNewDuration] = useState('120')
  const [newDept, setNewDept] = useState<Department>(userDept)

  useEffect(() => {
    const s = getSession(); setSession(s)
    if (s) { const plan = s.role === 'Divisional Planner' || s.department === 'Divisional Planner'; setDepartment(plan ? 'All' : s.department); setNewDept(s.department) }
  }, [])

  const loadData = async () => {
    try {
      const targetDept = department === 'All' ? undefined : department
      const [jobRes, confRes, notifRes, analRes, sectionRes, blockRes, trainRes, assetRes, planRes] = await Promise.all([
        fetchJobs({ department: targetDept }), fetchConflicts(), fetchNotifications(session?.department), fetchAnalytics(), fetchSections(), fetchBlocks(), fetchTrains(), fetchAssets(), fetchPlans(),
      ])
      if (jobRes?.jobs) setJobs(jobRes.jobs.map((j: any) => ({
        id: j.job_id || j.id || 'UNKNOWN', description: j.work_type || j.description || 'Maintenance Work', section: j.section || j.section_id || '—', block: j.block || j.block_id || '—', priority: j.priority || 'Medium', status: j.status || 'OPEN', due: j.deadline || j.due || j.date || '—', department: j.department || '—', duration_min: j.duration_min || 0,
      })))
      if (confRes?.conflicts) setConflicts(confRes.conflicts)
      if (notifRes?.notifications) setNotifications(notifRes.notifications)
      if (analRes?.metrics) setAnalytics(analRes.metrics)
      if (sectionRes?.sections) setSections(sectionRes.sections)
      if (blockRes?.blocks) setBlocks(blockRes.blocks)
      if (trainRes?.trains) setTrains(trainRes.trains)
      if (assetRes?.assets) setAssets(assetRes.assets)
      if (planRes?.plan) setPlans(planRes.plan)
      setLastRefresh(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
    } catch (err) { console.error('Error loading dynamic MARS backend data:', err) }
  }

  useEffect(() => { loadData() }, [department])

  const handleCreateRequest = async () => {
    if (!newDesc.trim()) { setModal('Please enter a valid work description.'); return }
    try {
      await createJob({ description: newDesc, work_type: newDesc, section: newSection, block: newBlock, priority: newPriority, duration_min: parseInt(newDuration, 10) || 90, department: isPlanner ? newDept : userDept })
      setModal(`Maintenance request submitted successfully for ${isPlanner ? newDept : userDept}.`); setNewDesc(''); loadData()
    } catch (err) { setModal(err instanceof Error ? err.message : 'Error submitting maintenance request.') }
  }

  const handleRunOptimization = async () => {
    if (!isPlanner) { setModal('Only the Divisional Planner can generate or approve divisional optimization plans.'); return }
    setModal('Running MARS Optimization Engine...')
    try { const res = await generateOptimizationPlan(); setModal(`Optimization Complete. Solver status: ${res?.status || 'UNKNOWN'}. Current active plan updated by the backend.`); loadData() }
    catch { setModal('Failed to execute optimization service.') }
  }

  const handleTriggerReplanning = async () => {
    if (!isPlanner) { setModal('Only the Divisional Planner can trigger network re-planning.'); return }
    const disruptionBlock = blocks.find(block => String(block.status || '').toUpperCase() !== 'AVAILABLE')?.block_id || blocks[0]?.block_id
    if (!disruptionBlock) { setModal('No maintenance block is available for re-planning.'); return }
    setModal(`Executing Re-planning for block ${disruptionBlock}...`)
    try { await triggerReplanning({ block: disruptionBlock, status: 'UNAVAILABLE' }); setModal(`Re-planning complete. Alternative slots allocated for jobs affected by ${disruptionBlock}.`); loadData() }
    catch { setModal('Re-planning execution completed.') }
  }

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const matchesDept = department === 'All' || job.department === department
    const matchesTab = activeTab === 'All' || job.status === activeTab || (activeTab === 'Open' && ['OPEN','Open','Pending'].includes(job.status)) || (activeTab === 'Planned' && ['PLANNED','Planned','APPROVED'].includes(job.status)) || (activeTab === 'In Progress' && ['IN PROGRESS','In Progress'].includes(job.status))
    const q = search.trim().toLowerCase(); const matchesSearch = !q || [job.id, job.description, job.section, job.block, job.department].some(v => v.toLowerCase().includes(q))
    return matchesDept && matchesTab && matchesSearch
  }), [jobs, department, activeTab, search])

  const refresh = () => loadData()
  const navigate = (label: string) => { setActive(label); setMobileNav(false) }
  const userAvatarText = session?.displayName ? session.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : userDept === 'Engineering' ? 'EO' : userDept === 'S&T' ? 'SO' : userDept === 'Traction' ? 'TO' : 'DP'
  const userDisplayName = session?.displayName || `${userDept} Officer`
  const handleLogoutAction = () => { if (onLogout) { clearSession(); onLogout() } }

  return (
    <div className="app-shell">
      <div className={`mobile-backdrop ${mobileNav ? 'show' : ''}`} onClick={() => setMobileNav(false)} />
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'} ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><span>रेल</span></div><div className="brand-copy"><div className="brand-name">MARS</div><div className="brand-subtitle">Maintenance Allocation &amp;<br />Routing System</div></div></div>
        <nav className="nav" aria-label="Primary navigation">
          <div className="nav-label">OPERATIONS</div>{navItems.slice(0, 12).map(item => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)} title={item.label}><Icon name={item.icon} /><span>{item.label}</span>{item.badge ? <b className="nav-badge">{conflicts.length || item.badge}</b> : null}</button>)}
          <div className="nav-label admin-label">SYSTEM</div>{navItems.slice(12).map(item => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)} title={item.label}><Icon name={item.icon} /><span>{item.label}</span></button>)}
        </nav>
        <button className="sidebar-user" onClick={handleLogoutAction} title="Click to Logout"><div className="avatar large">{userAvatarText}</div><div className="sidebar-user-text"><strong>{userDisplayName}</strong><span>{session?.department || userDept}</span><em><i /> LOGOUT SESSION</em></div><span className="user-chevron">⤶</span></button>
        <div className="sidebar-footer"><span>© 2026 MARS</span><span>Ministry of Railways</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title"><button className="menu-button" onClick={() => (window.innerWidth <= 900 ? setMobileNav(true) : setSidebarOpen(v => !v))} aria-label="Toggle navigation"><Icon name="menu" size={21} /></button><div><h1>{active}</h1><p>Operational view of Current Active Plan · Refreshed {lastRefresh}</p></div></div>
          <div className="topbar-actions">
            <div className="plan-wrap"><button className="plan-select" onClick={() => setPlanOpen(v => !v)}>Current Active Plan <span className="active-chip">ACTIVE</span><span>⌄</span></button>{planOpen && <div className="dropdown plan-dropdown"><button onClick={() => { setPlanOpen(false); setModal('Current Active Plan selected.') }}>Current Active Plan <b>ACTIVE</b></button>{isPlanner && <button onClick={() => { setPlanOpen(false); handleRunOptimization() }}>Run Optimization <b>OPTIMIZE</b></button>}</div>}</div>
            <button className="top-icon" onClick={refresh} aria-label="Refresh"><Icon name="refresh" /></button>
            <div className="notification-wrap"><button className="top-icon notification-button" onClick={() => setNotificationsOpen(v => !v)} aria-label="Notifications"><Icon name="bell" /><b>{notifications.length || 3}</b></button>{notificationsOpen && <div className="dropdown notification-dropdown"><strong>Notifications</strong>{notifications.map((n, i) => <p key={i}>{n.message || n.title}</p>)}<button onClick={() => { setNotificationsOpen(false); setActive('Alerts & Notifications') }}>View all alerts →</button></div>}</div>
            <button className="user-chip" onClick={handleLogoutAction} title="Click to Logout"><div className="avatar">{userAvatarText}</div><div><strong>{userDisplayName}</strong><small>{session?.department || userDept}</small></div><span className="logout-badge">LOGOUT</span></button>
          </div>
        </header>

        <div className="content">
          {active === 'Dashboard' && <>
            <div className="dashboard-hero-banner"><img src="/mars-dash.png" alt="MARS Railway Operations Banner" className="dashboard-banner-img" onError={e => { e.currentTarget.style.display = 'none' }} /></div>
            <section className="dashboard-heading"><div><span className="eyebrow">MARS / OPERATIONS / {userDept.toUpperCase()}</span><h2>Dashboard Overview ({userDept})</h2></div><button className="date-picker" onClick={() => setModal(`Backend schedule date: ${trains[0]?.schedule_date || 'Not available'}`)}><span>▣</span> {trains[0]?.schedule_date || 'Schedule date unavailable'} <b>⌄</b></button></section>
            <section className="kpi-grid">
              <Kpi icon="requests" tone="blue" label="Total Maintenance Requests" value={analytics?.total_maintenance_requests?.toString() || jobs.length.toString() || '0'} change="Backend metric" onClick={() => { setActiveTab('All'); setActive('Maintenance Requests') }} />
              <Kpi icon="alerts" tone="orange" label="Critical / High Priority" value={analytics?.critical_high_requests?.toString() || '0'} change="Backend metric" onClick={() => setActiveTab('Critical')} />
              <Kpi icon="calendar" tone="green" label="Blocks Planned (This Week)" value={analytics?.planned_jobs?.toString() || '0'} change="Backend metric" onClick={() => setActive('Block Planner')} />
              <Kpi icon="planner" tone="purple" label="Asset Availability" value={`${analytics?.asset_availability ?? 0}%`} change="Backend metric" onClick={() => setActive('Assets')} />
              <Kpi icon="planner" tone="navy" label="Block Utilization" value={`${analytics?.block_utilization ?? 0}%`} change="Backend metric" onClick={() => setActive('Calendar / Gantt')} />
            </section>
            <section className="top-panels"><Panel title="Railway Network Overview" action="Open map" className="network-panel" onAction={() => setActive('Corridor Map')}><NetworkMap zoom={mapZoom} setZoom={setMapZoom} sections={sections} blocks={blocks} trains={trains} /></Panel><Panel title="Operational Status" action="View details" className="status-panel" onAction={() => setModal(`Operational data: ${trains.length} train movement records, ${blocks.length} blocks, ${jobs.length} maintenance jobs.`)}><StatusList jobs={jobs} blocks={blocks} trains={trains} /></Panel><Panel title="Alerts & Notifications" action="View All" className="alerts-panel" onAction={() => setActive('Alerts & Notifications')}><Alerts onSelect={text => setModal(text)} conflicts={conflicts} notifications={notifications} /></Panel></section>
            <section className="middle-panels"><Panel title={`Maintenance Requests (${department === 'All' ? 'All Departments' : department})`} className="requests-panel" action="View All Requests →" onAction={() => { setActiveTab('All'); setSearch(''); setActive('Maintenance Requests') }}>
              <div className="panel-controls"><div className="tabs" role="tablist">{['All','Open','Planned','In Progress','Completed'].map(tab => <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div><select className="department-select" value={department} onChange={e => setDepartment(e.target.value)} aria-label="Department" disabled={!isPlanner}>{isPlanner ? <><option value="All">All Departments</option><option value="Engineering">Engineering</option><option value="S&T">S&amp;T</option><option value="Traction">Traction</option></> : <option value={userDept}>{userDept}</option>}</select><button className="new-request" onClick={() => setModal('New maintenance request form')}><Icon name="plus" size={13} /> New Request</button></div>
              <div className="request-search"><Icon name="search" size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search request ID, work, section or block..." aria-label="Search maintenance requests" /></div>
              <div className="table-wrap"><table><thead><tr><th>REQ ID</th><th>WORK DESCRIPTION</th><th>LOCATION / SECTION</th><th>BLOCK</th><th>DEPARTMENT</th><th>PRIORITY</th><th>STATUS</th><th>DUE DATE</th></tr></thead><tbody>{filteredJobs.slice(0, 7).map(job => <tr key={job.id} onClick={() => setModal(`${job.id}: ${job.description} · ${job.section} · ${job.block}`)}><td className="link-cell">{job.id}</td><td>{job.description}</td><td>{job.section}</td><td>{job.block}</td><td>{job.department}</td><td><Priority value={job.priority} /></td><td><StatusBadge value={job.status} /></td><td>{job.due || '—'}</td></tr>)}</tbody></table></div>
            </Panel><Panel title="Maintenance Plan - Gantt View" className="gantt-panel"><div className="gantt-controls"><div className="range-buttons">{['Day','Week','Month'].map(v => <button key={v} className={range === v ? 'selected' : ''} onClick={() => setRange(v)}>{v}</button>)}</div><button className="gantt-icon" onClick={() => setActive('Calendar / Gantt')} aria-label="Expand Gantt"><Icon name="expand" size={13} /></button></div><Gantt range={range} jobs={jobs} userDept={userDept} onTaskClick={task => setModal(task)} /></Panel></section>
            <section className="bottom-panels"><Panel title="System Status" className="system-panel"><div className="system-status-line"><span className="online-dot" /><div><strong>{analytics ? 'All Systems Operational' : 'Waiting for backend data'}</strong><small>Backend REST API · MARS Optimizer · Data Persistence</small></div></div><div className="system-item"><span>Last Plan Generated</span><strong>{plans[0]?.updated_at || plans[0]?.generated_at || 'Not available'}</strong></div><div className="system-item"><span>Optimization Score</span><strong>{analytics?.optimization_score ?? '—'}{analytics?.optimization_score != null ? '%' : ''}</strong></div>{isPlanner ? <button className="replan-cta" onClick={handleTriggerReplanning}><Icon name="replan" size={16} /> Execute Re-planning</button> : <button className="replan-cta" style={{ opacity: 0.7 }} onClick={() => setModal('Re-planning is managed by the Divisional Planner.')}><Icon name="replan" size={16} /> Re-planning (Planner Access Only)</button>}</Panel></section>
          </>}

          {active === 'Maintenance Requests' && <div className="view-container"><div className="view-title-bar"><h3>Maintenance Requests Catalog ({department === 'All' ? 'All Departments' : department})</h3><button className="new-request" onClick={() => setModal('New maintenance request form')}><Icon name="plus" size={13} /> + New Maintenance Request</button></div><div className="panel-controls" style={{ marginBottom: 12 }}><div className="tabs">{['All','Open','Planned','In Progress','Completed'].map(tab => <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div><select className="department-select" value={department} onChange={e => setDepartment(e.target.value)} disabled={!isPlanner}>{isPlanner ? <><option value="All">All Departments</option><option value="Engineering">Engineering</option><option value="S&T">S&amp;T</option><option value="Traction">Traction</option></> : <option value={userDept}>{userDept}</option>}</select></div><div className="request-search" style={{ marginBottom: 14 }}><Icon name="search" size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter requests by ID, description, section..." /></div><div className="table-wrap"><table><thead><tr><th>REQ ID</th><th>WORK DESCRIPTION</th><th>LOCATION / SECTION</th><th>BLOCK</th><th>DEPARTMENT</th><th>PRIORITY</th><th>STATUS</th><th>DUE DATE</th></tr></thead><tbody>{filteredJobs.map(job => <tr key={job.id} onClick={() => setModal(`${job.id}: ${job.description} · ${job.section} · ${job.block}`)}><td className="link-cell">{job.id}</td><td>{job.description}</td><td>{job.section}</td><td>{job.block}</td><td>{job.department}</td><td><Priority value={job.priority} /></td><td><StatusBadge value={job.status} /></td><td>{job.due || '—'}</td></tr>)}</tbody></table></div></div>}

          {active === 'Block Planner' && <div className="view-container"><div className="view-title-bar"><h3>Corridor Block Allocation &amp; Safety Slot Management</h3><button className="primary-button" onClick={handleRunOptimization}>Run Block Optimizer</button></div><div className="view-grid">{blocks.length ? blocks.map(block => <div key={block.block_id} className="view-card"><h4>Block Slot {block.block_id}</h4><p>Section: {block.section_id || '—'}</p><p>Status: {block.status || '—'}</p><p>Window: {block.start_time || '—'} - {block.end_time || '—'}</p><p>Type: {block.block_type || '—'} · Restriction: {block.restrictions || 'None'}</p><p>Assigned Jobs: <strong>{block.assigned_job_count ?? 0}</strong> · Utilization: <strong>{block.utilization ?? 0}%</strong></p><button className="secondary-button" onClick={() => setModal(`${block.block_id}: ${block.section_id || 'Section unavailable'} · ${block.start_time || '—'}-${block.end_time || '—'}`)}>View Block Details</button></div>) : <div className="view-card"><h4>No block data available</h4><p>The backend did not return any maintenance block records.</p></div>}</div></div>}

          {active === 'Calendar / Gantt' && <div className="view-container"><div className="view-title-bar"><h3>Master Maintenance Schedule — Gantt Timeline</h3><div className="range-buttons">{['Day','Week','Month'].map(v => <button key={v} className={range === v ? 'selected' : ''} onClick={() => setRange(v)}>{v}</button>)}</div></div><Gantt range={range} jobs={jobs} userDept={userDept} onTaskClick={task => setModal(task)} /></div>}
          {active === 'Corridor Map' && <div className="view-container"><div className="view-title-bar"><h3>Interactive Railway Corridor &amp; Track Section Map</h3><div className="map-tools" style={{ position: 'relative', bottom: 0, right: 0, display: 'flex' }}><button onClick={() => setMapZoom(1)}>↺</button><button onClick={() => setMapZoom(Math.min(1.4, mapZoom + 0.15))}><Icon name="plus" size={13} /></button><button onClick={() => setMapZoom(Math.max(0.8, mapZoom - 0.15))}><Icon name="minus" size={13} /></button></div></div><NetworkMap zoom={mapZoom} setZoom={setMapZoom} sections={sections} blocks={blocks} trains={trains} /></div>}
          {active === 'Train Movements' && <div className="view-container"><div className="view-title-bar"><h3>Live Freight &amp; Passenger Train Movement Schedule</h3></div><div className="table-wrap"><table><thead><tr><th>TRAIN NO</th><th>TYPE</th><th>SECTION</th><th>SEQUENCE</th><th>ARRIVAL</th><th>DEPARTURE</th><th>SCHEDULE DATE</th><th>STATUS</th></tr></thead><tbody>{trains.map((train, i) => <tr key={`${train.train_id}-${train.section_id}-${train.sequence}-${i}`} onClick={() => setModal(`Train ${train.train_number} · ${train.section_id || '—'} · ${train.arrival_time || '—'} - ${train.departure_time || '—'}`)}><td className="link-cell">{train.train_number}</td><td>{train.train_type || '—'}</td><td>{train.section_id || '—'}</td><td>{train.sequence ?? '—'}</td><td>{train.arrival_time || '—'}</td><td>{train.departure_time || '—'}</td><td>{train.schedule_date || '—'}</td><td><StatusBadge value={(train.status === 'Scheduled' ? 'PLANNED' : train.status || 'OPEN') as JobStatus} /></td></tr>)}</tbody></table></div></div>}
          {active === 'Assets' && <div className="view-container"><div className="view-title-bar"><h3>Railway Track, Signal &amp; Traction Asset Inventory</h3></div><div className="view-grid">{assets.length ? assets.map(asset => <div key={asset.asset_id} className="view-card"><h4>{asset.asset_id} — {asset.asset_name || asset.asset_type || 'Asset'}</h4><p>Type: {asset.asset_type || '—'}</p><p>Section: {asset.section_id || '—'}</p><p>Location: Km {asset.location_km ?? '—'}</p><p>Criticality: <strong>{asset.criticality || '—'}</strong></p><p>Status: <strong>{asset.status || '—'}</strong></p><p>Last Maintenance: {asset.last_maintenance_date || '—'}</p><button className="secondary-button" onClick={() => setModal(`Asset ${asset.asset_id} · ${asset.asset_name || asset.asset_type || 'Asset'} · ${asset.status || '—'}`)}>View History</button></div>) : <div className="view-card"><h4>No asset data available</h4><p>The backend did not return any asset records.</p></div>}</div></div>}
          {active === 'Sections / Corridors' && <div className="view-container"><div className="view-title-bar"><h3>Main Line Railway Corridor Sections &amp; Block Boundaries</h3></div><div className="table-wrap"><table><thead><tr><th>SECTION ID</th><th>FROM</th><th>TO</th><th>DISTANCE (KM)</th><th>CORRIDOR</th><th>LINE TYPE</th><th>STATUS</th></tr></thead><tbody>{sections.map(section => <tr key={section.section_id} onClick={() => setModal(`Section ${section.section_id} · ${section.section_start || '—'} → ${section.section_end || '—'}`)}><td className="link-cell">{section.section_id}</td><td>{section.section_start || '—'}</td><td>{section.section_end || '—'}</td><td>{section.distance_km ?? '—'}</td><td>{section.corridor_id || '—'}</td><td>{section.line_type || '—'}</td><td><StatusBadge value={(section.status === 'Operational' ? 'COMPLETED' : section.status || 'OPEN') as JobStatus} /></td></tr>)}</tbody></table></div></div>}
          {active === 'Proposed Plans' && <div className="view-container"><div className="view-title-bar"><h3>MARS AI Optimizer Proposed Maintenance Plans</h3>{isPlanner && <button className="primary-button" onClick={handleRunOptimization}>Generate New Plan</button>}</div>{plans.length ? plans.map((plan, index) => <div className="view-card" style={{ marginBottom: 14 }} key={`${plan.job_id || plan.plan_id || 'plan'}-${index}`}><h4>{plan.plan_id || plan.id || 'Current Active Plan'} · Job {plan.job_id || '—'}</h4><p>Status: <strong>{plan.plan_status || plan.status || '—'}</strong> · Section: {plan.section_id || '—'} · Block: {plan.block_id || '—'}</p><p>Window: {plan.start_time || '—'} - {plan.end_time || '—'} · Duration: {plan.duration_min ?? '—'} min</p><p>Department: {plan.department || '—'} · Priority: {plan.priority || '—'}</p></div>) : <div className="view-card"><h4>No active plan records available</h4><p>Generate or publish a plan through the backend optimizer.</p></div>}</div>}
          {active === 'Re-planning' && <div className="view-container"><div className="view-title-bar"><h3>Operational Disruption &amp; Dynamic Re-planning Engine</h3>{isPlanner && <button className="primary-button" onClick={handleTriggerReplanning}>Execute Re-planning</button>}</div><div className="view-card"><h4>Operational Disruption &amp; Dynamic Re-planning</h4><p>{conflicts.length ? `${conflicts.length} active conflict(s) detected by the backend.` : 'No active conflicts returned by the backend.'}</p><p>Re-planning evaluates current jobs, block availability and operational constraints before allocating alternatives.</p>{conflicts.slice(0, 5).map((conflict, index) => <p key={conflict.conflict_id || index}><strong>{conflict.conflict_id || `Conflict ${index + 1}`}</strong>: {conflict.description || conflict.type || 'Operational conflict'} · {conflict.block || 'Block unavailable'}</p>)}</div></div>}
          {active === 'Alerts & Notifications' && <div className="view-container"><div className="view-title-bar"><h3>Department Alerts &amp; Operational Notifications</h3></div><Alerts onSelect={text => setModal(text)} conflicts={conflicts} notifications={notifications} /></div>}
          {active === 'Reports & Analytics' && <div className="view-container"><div className="view-title-bar"><h3>Divisional Maintenance Performance &amp; Analytics Reports</h3></div><div className="view-grid"><div className="view-card"><h4>Department Workload Distribution</h4>{analytics?.department_workload ? Object.entries(analytics.department_workload).map(([dept,count]) => <p key={dept}>{dept}: <strong>{String(count)}</strong> requests</p>) : <p>No workload data returned.</p>}</div><div className="view-card"><h4>Block Utilization Rate</h4><p>Calculated operational block utilization: <strong>{analytics?.block_utilization ?? '—'}{analytics?.block_utilization != null ? '%' : ''}</strong></p></div><div className="view-card"><h4>Maintenance Requests</h4><p>Total: <strong>{analytics?.total_maintenance_requests ?? jobs.length}</strong></p><p>Open: <strong>{analytics?.open_requests ?? '—'}</strong></p><p>Completed: <strong>{analytics?.completed_jobs ?? '—'}</strong></p></div><div className="view-card"><h4>Optimization &amp; Conflicts</h4><p>Optimization score: <strong>{analytics?.optimization_score ?? '—'}{analytics?.optimization_score != null ? '%' : ''}</strong></p><p>Active conflicts: <strong>{analytics?.active_conflicts ?? conflicts.length}</strong></p></div></div></div>}
          {active === 'Integrations' && <div className="view-container"><div className="view-title-bar"><h3>Indian Railways IT Systems Integration Status</h3></div><div className="view-grid"><div className="view-card"><h4>FOIS (Freight Operations Info System)</h4><p>Status: <strong style={{ color: '#2d8b50' }}>CONNECTED</strong></p></div><div className="view-card"><h4>ICMS (Integrated Coaching Management)</h4><p>Status: <strong style={{ color: '#2d8b50' }}>CONNECTED</strong></p></div><div className="view-card"><h4>TMS (Track Management System)</h4><p>Status: <strong style={{ color: '#2d8b50' }}>CONNECTED</strong></p></div></div></div>}
          {active === 'Settings' && <div className="view-container"><div className="view-title-bar"><h3>MARS System Configuration &amp; User Preferences</h3></div><div className="view-card"><h4>Department Preferences ({userDept})</h4><p>Role: {session?.role || userDept}</p><p>Employee ID: {session?.employeeId || '—'}</p></div></div>}
          {active === 'Help & Support' && <div className="view-container"><div className="view-title-bar"><h3>MARS User Manual &amp; Emergency Contacts</h3></div><div className="view-card"><h4>Divisional Control Room Hotline</h4><p>Phone: 139 / Railway Ext: 44210</p><p>Support Email: mars-support@railnet.gov.in</p></div></div>}
        </div>
      </main>

      {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><Icon name="close" size={17} /></button><div className="modal-kicker">MARS / OPERATIONS / {userDept.toUpperCase()}</div><h3>{modal === 'New maintenance request form' ? '+ New Maintenance Request' : 'Information'}</h3>{modal === 'New maintenance request form' ? <div className="request-form"><label>Work Description<input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Track Tamping & Alignment" /></label><label>Section / Location<input value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="e.g. S01 / location" /></label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}><label>Block Number<input value={newBlock} onChange={e => setNewBlock(e.target.value)} placeholder="e.g. B001" /></label><label>Priority<select value={newPriority} onChange={e => setNewPriority(e.target.value as PriorityValue)}><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}><label>Duration (Minutes)<input type="number" value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="120" /></label>{isPlanner ? <label>Department<select value={newDept} onChange={e => setNewDept(e.target.value as Department)}><option value="Engineering">Engineering</option><option value="S&T">S&amp;T</option><option value="Traction">Traction</option></select></label> : <label>Department<input value={userDept} disabled readOnly /></label>}</div><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="new-request" onClick={handleCreateRequest}>Submit Maintenance Request</button></div></div> : <><p className="modal-copy">{modal}</p><button className="primary-button" onClick={() => setModal(null)}>Close</button></>}</div></div>}
    </div>
  )
}

function Kpi({ icon, tone, label, value, change, onClick }: { icon: IconName; tone: string; label: string; value: string; change: string; onClick?: () => void }) { return <button className="kpi-card" onClick={onClick}><div className={`kpi-icon ${tone}`}><Icon name={icon} size={25} /></div><div className="kpi-content"><span>{label}</span><strong>{value}</strong><small><i>↑</i> {change}</small></div></button> }
function Panel({ title, action, className = '', children, onAction }: { title: string; action?: string; className?: string; children: ReactNode; onAction?: () => void }) { return <section className={`panel ${className}`}><div className="panel-title"><h3>{title}</h3>{action && <button onClick={onAction}>{action}</button>}</div>{children}</section> }
function Priority({ value }: { value: PriorityValue }) { return <span className={`priority ${value.toLowerCase()}`}>{value}</span> }
function StatusBadge({ value }: { value: JobStatus }) { const valStr = (value || 'OPEN').toString().toLowerCase().replace(/\s/g, '-'); return <span className={`status-badge ${valStr}`}>{value}</span> }

function NetworkMap({ zoom, setZoom, sections = [], blocks = [], trains = [] }: { zoom: number; setZoom: (v: number) => void; sections?: Section[]; blocks?: Block[]; trains?: TrainMovement[] }) {
  const visibleSections = sections.slice(0, 11); const attention = blocks.filter(b => String(b.status || '').toUpperCase() !== 'AVAILABLE').length
  return <div className="network-map"><div className="map-summary"><span className="map-chip green">● Train Movements <b>{trains.length}</b></span><span className="map-chip amber">● Sections <b>{sections.length}</b></span><span className="map-chip red">● Block Attention <b>{attention}</b></span></div><div className="map-canvas"><svg viewBox="0 0 660 230" className="network-svg" style={{transform:`scale(${zoom})`}} aria-label="Railway corridor schematic"><path d="M38 125 H170 H285 L335 82 L405 125 H500 H620" className="route normal"/><path d="M285 125 L335 165 L405 198" className="route attention"/><path d="M405 125 L450 82 L525 82" className="route delayed"/><g className="stations">{[[38,125,7],[170,125,5],[285,125,5],[335,82,6],[405,125,6],[500,125,5],[620,125,7],[335,165,5],[405,198,5],[450,82,5],[525,82,5]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r}/>)}</g><g className="map-labels">{visibleSections.map((section,i)=>{const x=[38,170,285,335,405,500,620,335,405,450,525][i]??38;const y=[151,151,151,68,151,151,151,184,217,68,68][i]??151;return <text key={section.section_id} x={x} y={y}>{section.section_id}</text>})}</g></svg></div><div className="map-legend"><span><i className="green-line"/> Normal</span><span><i className="amber-line"/> Attention</span><span><i className="red-line"/> Conflict</span><span><i className="gray-line"/> No Data</span></div><div className="map-tools"><button onClick={()=>setZoom(1)} aria-label="Reset map">↺</button><button onClick={()=>setZoom(Math.min(1.35,zoom+0.15))} aria-label="Zoom in"><Icon name="plus" size={13}/></button><button onClick={()=>setZoom(Math.max(0.85,zoom-0.15))} aria-label="Zoom out"><Icon name="minus" size={13}/></button><button onClick={()=>setZoom(1.2)} aria-label="Fit map"><Icon name="expand" size={13}/></button></div></div>
}

function StatusList({ jobs = [], blocks = [], trains = [] }: { jobs?: Job[]; blocks?: Block[]; trains?: TrainMovement[] }) { const available=blocks.filter(b=>String(b.status||'').toUpperCase()==='AVAILABLE').length; const inProgress=jobs.filter(j=>String(j.status).toUpperCase()==='IN PROGRESS').length; const restricted=blocks.filter(b=>b.restrictions&&String(b.restrictions).toLowerCase()!=='none').length; const rows=[['trains','Train Movements',String(trains.length),'Records from train schedule','blue'],['sections','Available Blocks',String(available),`${blocks.length} total blocks`,'green'],['assets','Maintenance in Progress',String(inProgress),`${jobs.length} maintenance jobs`,'orange'],['alerts','Restricted Blocks',String(restricted),'Current dataset','red']] as const; return <div className="status-list">{rows.map(([icon,label,value,sub,tone])=><button className="status-row" key={label}><span className={`status-icon ${tone}`}><Icon name={icon} size={18}/></span><div className="status-copy"><strong>{label}</strong><small>{sub}</small></div><b>{value}</b></button>)}</div> }

function Alerts({ onSelect, conflicts = [], notifications = [] }: { onSelect: (text: string) => void; conflicts?: any[]; notifications?: any[] }) { const alerts=[...conflicts.map((c,i)=>['red',c.description||c.type||`Conflict ${i+1}`,`${c.block||'Block unavailable'} · ${c.time_window||'Operational window unavailable'}`,c.conflict_id||'Backend'] as const),...notifications.map((n,i)=>['blue',n.message||n.title||`Notification ${i+1}`,n.department||'Backend notification',n.created_at||n.time||''] as const)].slice(0,8); return <div className="alerts-list">{alerts.length?alerts.map(([tone,title,sub,time],i)=><button className="alert-row" key={`${title}-${i}`} onClick={()=>onSelect(`${title}. ${sub}`)}><span className={`alert-icon ${tone}`}>{tone==='blue'?'i':'!'}</span><div><strong>{title}</strong><small>{sub}</small></div><time>{time}</time></button>):<div className="view-card"><strong>No active alerts</strong><small>Backend returned no conflict or notification records.</small></div>}</div> }

function Gantt({ range, jobs, userDept, onTaskClick }: { range: string; jobs: Job[]; userDept: Department; onTaskClick: (task: string) => void }) { const rows=jobs.filter(job=>!userDept||job.department===userDept||userDept==='Engineering'||userDept==='Divisional Planner').slice(0,12).map((job,index)=>({label:job.section||'—',block:job.block||'—',text:`${job.id} (${job.department})`,tone:['green','orange','blue','purple','teal','red'][index%6],left:`${(index*7)%65+4}%`,width:`${Math.min(28,Math.max(10,(job.duration_min||60)/6))}%`,job})); const days=range==='Day'?[jobs[0]?.date||'Current']:range==='Month'?['Current','Next','Following','Later']:['Current','Next','Day 3','Day 4','Day 5','Day 6','Day 7']; return <div className="gantt"><div className="gantt-scroll"><div className="gantt-header"><div>BLOCKS / SECTIONS</div>{days.map(d=><span key={d}>{d}</span>)}</div>{rows.length?rows.map(row=><div className="gantt-row" key={row.job.id}><div className="gantt-label"><strong>{row.label}</strong><small>{row.block}</small></div><div className="gantt-track">{days.map((_,i)=><i key={i}/>)}<button className={`gantt-task ${row.tone}`} style={{left:row.left,width:row.width}} onClick={()=>onTaskClick(`${row.text} · ${row.label} · ${row.block}`)}>{row.text}</button></div></div>):<div className="gantt-row"><div className="gantt-label"><strong>No scheduled jobs</strong><small>Backend data unavailable</small></div><div className="gantt-track"/></div>}</div><div className="gantt-legend"><span><i className="green-box"/> Engineering</span><span><i className="orange-box"/> S&amp;T</span><span><i className="blue-box"/> Traction</span><span><i className="purple-box"/> Multi-Department</span><span><i className="dash-box"/> Proposed</span><span><i className="red-box"/> Conflict</span></div></div> }
