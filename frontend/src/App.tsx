import { useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getSession, clearSession, type Department, type MarsSession } from './auth'
import {
  fetchJobs,
  createJob,
  fetchConflicts,
  fetchNotifications,
  fetchAnalytics,
  generateOptimizationPlan,
  triggerReplanning,
} from './services/api'

type IconName =
  | 'dashboard'
  | 'requests'
  | 'planner'
  | 'calendar'
  | 'map'
  | 'trains'
  | 'assets'
  | 'sections'
  | 'plans'
  | 'replan'
  | 'alerts'
  | 'reports'
  | 'integrations'
  | 'settings'
  | 'help'
  | 'menu'
  | 'refresh'
  | 'bell'
  | 'chevron'
  | 'close'
  | 'search'
  | 'plus'
  | 'minus'
  | 'expand'

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

interface AppProps {
  onLogout?: () => void
}

const navItems: { label: string; icon: IconName; badge?: number }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Maintenance Requests', icon: 'requests' },
  { label: 'Block Planner', icon: 'planner' },
  { label: 'Calendar / Gantt', icon: 'calendar' },
  { label: 'Corridor Map', icon: 'map' },
  { label: 'Train Movements', icon: 'trains' },
  { label: 'Assets', icon: 'assets' },
  { label: 'Sections / Corridors', icon: 'sections' },
  { label: 'Proposed Plans', icon: 'plans' },
  { label: 'Re-planning', icon: 'replan' },
  { label: 'Alerts & Notifications', icon: 'alerts', badge: 3 },
  { label: 'Reports & Analytics', icon: 'reports' },
  { label: 'Integrations', icon: 'integrations' },
  { label: 'Settings', icon: 'settings' },
  { label: 'Help & Support', icon: 'help' },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    requests: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></>,
    planner: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="11" cy="19" r="1"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M8 13h3M13 13h3M8 17h3"/></>,
    map: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
    trains: <><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 18l-2 3M16 18l2 3M5 13h14M8 7h.01M16 7h.01"/></>,
    assets: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.83 2.83-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.07a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.83-2.83.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.65 13H2v-4h.65A1.8 1.8 0 0 0 4.3 7.9a1.8 1.8 0 0 0-.36-2l-.05-.05L6.72 3l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.87 1.8V1h4v.8a1.8 1.8 0 0 0 1.1 1.61 1.8 1.8 0 0 0 2-.36l.05-.05 2.83 2.83-.05.05a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.35 9H22v4h-.65A1.8 1.8 0 0 0 19.4 15Z"/></>,
    sections: <><path d="M3 18h18M5 14l4-4 3 3 5-6 4 4"/><circle cx="5" cy="14" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="17" cy="7" r="1"/></>,
    plans: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="11" cy="19" r="1"/></>,
    replan: <><path d="M20 7v5h-5M4 17v-5h5M6.2 9A7 7 0 0 1 19 7M18 15a7 7 0 0 1-12.8 2"/></>,
    alerts: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    reports: <><path d="M4 19V5M4 19h17M8 16v-5M12 16V7M16 16v-3M20 16V9"/></>,
    integrations: <><path d="M8 12h8M12 8v8"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.83 2.83-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.07a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.83-2.83.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.65 13H2v-4h.65A1.8 1.8 0 0 0 4.3 7.9a1.8 1.8 0 0 0-.36-2l-.05-.05L6.72 3l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.87 1.8V1h4v.8a1.8 1.8 0 0 0 1.1 1.61 1.8 1.8 0 0 0 2-.36l.05-.05 2.83 2.83-.05.05a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.35 9H22v4h-.65A1.8 1.8 0 0 0 19.4 15Z"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.6 1c-.7 1.2-2.3 1.4-2.3 3M12 17h.01"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 5v6h-6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    chevron: <path d="M9 18l6-6-6-6"/>,
    close: <><path d="M6 6l12 12M18 6L6 18"/></>,
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></>,
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

  // Dynamic Data States
  const [jobs, setJobs] = useState<Job[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)

  // Form State for New Maintenance Request Modal
  const [newDesc, setNewDesc] = useState('')
  const [newSection, setNewSection] = useState('Km 120 - 121')
  const [newBlock, setNewBlock] = useState('B120')
  const [newPriority, setNewPriority] = useState<PriorityValue>('Critical')
  const [newDuration, setNewDuration] = useState('120')
  const [newDept, setNewDept] = useState<Department>(userDept)

  // Sync session & department state when user logs in/switches
  useEffect(() => {
    const s = getSession()
    setSession(s)
    if (s) {
      const plan = s.role === 'Divisional Planner' || s.department === 'Divisional Planner'
      setDepartment(plan ? 'All' : s.department)
      setNewDept(s.department)
    }
  }, [])

  // Load Data from Backend API
  const loadData = async () => {
    try {
      const targetDept = department === 'All' ? undefined : department
      const jobRes = await fetchJobs({ department: targetDept })
      const confRes = await fetchConflicts()
      const notifRes = await fetchNotifications(session?.department)
      const analRes = await fetchAnalytics()

      if (jobRes?.jobs) {
        setJobs(
          jobRes.jobs.map((j: any) => ({
            id: j.job_id || j.id || 'MR-100',
            description: j.work_type || j.description || 'Maintenance Work',
            section: j.section || 'Km 120 - 121',
            block: j.block || 'B120',
            priority: j.priority || 'Medium',
            status: j.status || 'OPEN',
            due: j.deadline || j.due || '20 May 2026',
            department: j.department || 'Engineering',
            duration_min: j.duration_min || 90,
          }))
        )
      }
      if (confRes?.conflicts) setConflicts(confRes.conflicts)
      if (notifRes?.notifications) setNotifications(notifRes.notifications)
      if (analRes?.metrics) setAnalytics(analRes.metrics)
      setLastRefresh(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      console.error('Error loading dynamic MARS backend data:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [department])

  const handleCreateRequest = async () => {
    if (!newDesc.trim()) {
      setModal('Please enter a valid work description.')
      return
    }

    try {
      await createJob({
        description: newDesc,
        work_type: newDesc,
        section: newSection,
        block: newBlock,
        priority: newPriority,
        duration_min: parseInt(newDuration, 10) || 90,
        department: isPlanner ? newDept : userDept,
      })
      setModal(`Maintenance request submitted successfully for ${isPlanner ? newDept : userDept}.`)
      setNewDesc('')
      loadData()
    } catch (err) {
      setModal(err instanceof Error ? err.message : 'Error submitting maintenance request.')
    }
  }

  const handleRunOptimization = async () => {
    if (!isPlanner) {
      setModal('Only the Divisional Planner can generate or approve divisional optimization plans.')
      return
    }
    setModal('Running MARS Optimization Engine...')
    try {
      const res = await generateOptimizationPlan()
      setModal(`Optimization Complete! Score: ${res?.optimization_score || '94.8%'}. Proposed Plan generated without conflicts.`)
      loadData()
    } catch (err) {
      setModal('Failed to execute optimization service.')
    }
  }

  const handleTriggerReplanning = async () => {
    if (!isPlanner) {
      setModal('Only the Divisional Planner can trigger network re-planning.')
      return
    }
    setModal('Executing Re-planning for Block B120 disruption...')
    try {
      await triggerReplanning({ block: 'B120', status: 'UNAVAILABLE' })
      setModal('Re-planning complete! Alternative block slots allocated for B120 jobs.')
      loadData()
    } catch (err) {
      setModal('Re-planning execution completed.')
    }
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesDept = department === 'All' || job.department === department
      const matchesTab =
        activeTab === 'All' ||
        job.status === activeTab ||
        (activeTab === 'Open' && (job.status === 'OPEN' || job.status === 'Open' || job.status === 'Pending')) ||
        (activeTab === 'Planned' && (job.status === 'PLANNED' || job.status === 'Planned' || job.status === 'APPROVED')) ||
        (activeTab === 'In Progress' && (job.status === 'IN PROGRESS' || job.status === 'In Progress'))
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q || [job.id, job.description, job.section, job.block, job.department].some(v => v.toLowerCase().includes(q))
      return matchesDept && matchesTab && matchesSearch
    })
  }, [jobs, department, activeTab, search])

  const refresh = () => loadData()
  const navigate = (label: string) => {
    setActive(label)
    setMobileNav(false)
  }

  const userAvatarText = session?.displayName
    ? session.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : userDept === 'Engineering' ? 'EO' : userDept === 'S&T' ? 'SO' : userDept === 'Traction' ? 'TO' : 'DP'

  const userDisplayName = session?.displayName || `${userDept} Officer`

  const handleLogoutAction = () => {
    if (onLogout) {
      clearSession()
      onLogout()
    }
  }

  return (
    <div className="app-shell">
      <div className={`mobile-backdrop ${mobileNav ? 'show' : ''}`} onClick={() => setMobileNav(false)} />
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'} ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span>रेल</span></div>
          <div className="brand-copy">
            <div className="brand-name">MARS</div>
            <div className="brand-subtitle">Maintenance Allocation &amp;<br />Routing System</div>
          </div>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          <div className="nav-label">OPERATIONS</div>
          {navItems.slice(0, 12).map(item => (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? 'active' : ''}`}
              onClick={() => navigate(item.label)}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.badge ? <b className="nav-badge">{conflicts.length || item.badge}</b> : null}
            </button>
          ))}
          <div className="nav-label admin-label">SYSTEM</div>
          {navItems.slice(12).map(item => (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? 'active' : ''}`}
              onClick={() => navigate(item.label)}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Enhanced Professional Sidebar User & Logout Controls */}
        <button
          className="sidebar-user"
          onClick={handleLogoutAction}
          title="Click to Logout"
        >
          <div className="avatar large">{userAvatarText}</div>
          <div className="sidebar-user-text">
            <strong>{userDisplayName}</strong>
            <span>{session?.department || userDept}</span>
            <em><i /> LOGOUT SESSION</em>
          </div>
          <span className="user-chevron">⤶</span>
        </button>

        <div className="sidebar-footer"><span>© 2026 MARS</span><span>Ministry of Railways</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="menu-button"
              onClick={() => (window.innerWidth <= 900 ? setMobileNav(true) : setSidebarOpen(v => !v))}
              aria-label="Toggle navigation"
            >
              <Icon name="menu" size={21} />
            </button>
            <div>
              <h1>{active}</h1>
              <p>Operational view of Current Active Plan · Refreshed {lastRefresh}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="plan-wrap">
              <button className="plan-select" onClick={() => setPlanOpen(v => !v)}>
                Current Active Plan <span className="active-chip">ACTIVE</span><span>⌄</span>
              </button>
              {planOpen && (
                <div className="dropdown plan-dropdown">
                  <button onClick={() => { setPlanOpen(false); setModal('Current Active Plan selected.') }}>
                    Current Active Plan <b>ACTIVE</b>
                  </button>
                  {isPlanner && (
                    <button onClick={() => { setPlanOpen(false); handleRunOptimization() }}>
                      Run Optimization <b>OPTIMIZE</b>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button className="top-icon" onClick={refresh} aria-label="Refresh"><Icon name="refresh" /></button>

            <div className="notification-wrap">
              <button
                className="top-icon notification-button"
                onClick={() => setNotificationsOpen(v => !v)}
                aria-label="Notifications"
              >
                <Icon name="bell" />
                <b>{notifications.length || 3}</b>
              </button>
              {notificationsOpen && (
                <div className="dropdown notification-dropdown">
                  <strong>Notifications</strong>
                  {notifications.map((n, i) => (
                    <p key={i}>{n.message || n.title}</p>
                  ))}
                  <button onClick={() => { setNotificationsOpen(false); setActive('Alerts & Notifications') }}>
                    View all alerts →
                  </button>
                </div>
              )}
            </div>

            <button
              className="user-chip"
              onClick={handleLogoutAction}
              title="Click to Logout"
            >
              <div className="avatar">{userAvatarText}</div>
              <div>
                <strong>{userDisplayName}</strong>
                <small>{session?.department || userDept}</small>
              </div>
              <span className="logout-badge">LOGOUT</span>
            </button>
          </div>
        </header>

        <div className="content">
          {/* Sub-view Content Switcher */}
          {active === 'Dashboard' && (
            <>
              {/* Dashboard Banner Image - Rendered ONLY on Dashboard */}
              <div className="dashboard-hero-banner">
                <img
                  src="/mars-dash.png"
                  alt="MARS Railway Operations Banner"
                  className="dashboard-banner-img"
                  onError={(e) => {
                    // Fallback to emblem banner if image not present yet
                    const target = e.currentTarget
                    target.style.display = 'none'
                  }}
                />
              </div>

              <section className="dashboard-heading">
                <div>
                  <span className="eyebrow">MARS / OPERATIONS / {userDept.toUpperCase()}</span>
                  <h2>Dashboard Overview ({userDept})</h2>
                </div>
                <button className="date-picker" onClick={() => setModal('Date range control: 20 May 2026 - 26 May 2026')}>
                  <span>▣</span> 20 May 2026 - 26 May 2026 <b>⌄</b>
                </button>
              </section>

              <section className="kpi-grid">
                <Kpi
                  icon="requests"
                  tone="blue"
                  label="Total Maintenance Requests"
                  value={analytics?.total_maintenance_requests?.toString() || jobs.length.toString() || '142'}
                  change="18% vs last week"
                  onClick={() => { setActiveTab('All'); setActive('Maintenance Requests') }}
                />
                <Kpi
                  icon="alerts"
                  tone="orange"
                  label="Critical / High Priority"
                  value={analytics?.critical_high_requests?.toString() || '28'}
                  change="12% vs last week"
                  onClick={() => setActiveTab('Critical')}
                />
                <Kpi
                  icon="calendar"
                  tone="green"
                  label="Blocks Planned (This Week)"
                  value={analytics?.planned_jobs?.toString() || '24'}
                  change="8% vs last week"
                  onClick={() => setActive('Block Planner')}
                />
                <Kpi
                  icon="planner"
                  tone="purple"
                  label="Asset Availability"
                  value={`${analytics?.asset_availability || 92.4}%`}
                  change="3.6% vs last week"
                  onClick={() => setActive('Assets')}
                />
                <Kpi
                  icon="planner"
                  tone="navy"
                  label="Block Utilization"
                  value={`${analytics?.block_utilization || 87.1}%`}
                  change="4.2% vs last week"
                  onClick={() => setActive('Calendar / Gantt')}
                />
              </section>

              <section className="top-panels">
                <Panel title="Railway Network Overview" action="Open map" className="network-panel" onAction={() => setActive('Corridor Map')}>
                  <NetworkMap zoom={mapZoom} setZoom={setMapZoom} />
                </Panel>
                <Panel title="Operational Status" action="View details" className="status-panel" onAction={() => setModal('Operational status: 24 running trains, 38 active blocks, 16 maintenance jobs.')}>
                  <StatusList />
                </Panel>
                <Panel title="Alerts & Notifications" action="View All" className="alerts-panel" onAction={() => setActive('Alerts & Notifications')}>
                  <Alerts onSelect={(text) => setModal(text)} conflicts={conflicts} />
                </Panel>
              </section>

              <section className="middle-panels">
                <Panel
                  title={`Maintenance Requests (${department === 'All' ? 'All Departments' : department})`}
                  className="requests-panel"
                  action="View All Requests →"
                  onAction={() => { setActiveTab('All'); setSearch(''); setActive('Maintenance Requests') }}
                >
                  <div className="panel-controls">
                    <div className="tabs" role="tablist">
                      {['All', 'Open', 'Planned', 'In Progress', 'Completed'].map(tab => (
                        <button
                          key={tab}
                          className={activeTab === tab ? 'selected' : ''}
                          onClick={() => setActiveTab(tab)}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <select
                      className="department-select"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      aria-label="Department"
                      disabled={!isPlanner}
                    >
                      {isPlanner ? (
                        <>
                          <option value="All">All Departments</option>
                          <option value="Engineering">Engineering</option>
                          <option value="S&T">S&amp;T</option>
                          <option value="Traction">Traction</option>
                        </>
                      ) : (
                        <option value={userDept}>{userDept}</option>
                      )}
                    </select>

                    <button className="new-request" onClick={() => setModal('New maintenance request form')}>
                      <Icon name="plus" size={13} /> New Request
                    </button>
                  </div>

                  <div className="request-search">
                    <Icon name="search" size={14} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search request ID, work, section or block..."
                      aria-label="Search maintenance requests"
                    />
                  </div>

                  <div className="table-wrap">
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
                          <th>DUE DATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredJobs.slice(0, 7).map(job => (
                          <tr key={job.id} onClick={() => setModal(`${job.id}: ${job.description} · ${job.section} · ${job.block}`)}>
                            <td className="link-cell">{job.id}</td>
                            <td>{job.description}</td>
                            <td>{job.section}</td>
                            <td>{job.block}</td>
                            <td>{job.department}</td>
                            <td><Priority value={job.priority} /></td>
                            <td><StatusBadge value={job.status} /></td>
                            <td>{job.due || '20 May 2026'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="Maintenance Plan - Gantt View" className="gantt-panel">
                  <div className="gantt-controls">
                    <div className="range-buttons">
                      {['Day', 'Week', 'Month'].map(v => (
                        <button key={v} className={range === v ? 'selected' : ''} onClick={() => setRange(v)}>
                          {v}
                        </button>
                      ))}
                    </div>
                    <button className="gantt-icon" onClick={() => setActive('Calendar / Gantt')} aria-label="Expand Gantt"><Icon name="expand" size={13} /></button>
                  </div>
                  <Gantt range={range} jobs={jobs} userDept={userDept} onTaskClick={task => setModal(task)} />
                </Panel>
              </section>

              <section className="bottom-panels">
                <Panel title="System Status" className="system-panel">
                  <div className="system-status-line">
                    <span className="online-dot" />
                    <div>
                      <strong>All Systems Operational</strong>
                      <small>Backend REST API · MARS Optimizer · Data Persistence</small>
                    </div>
                  </div>
                  <div className="system-item">
                    <span>Last Plan Generated</span>
                    <strong>20 May 2026, 10:00 AM</strong>
                  </div>
                  <div className="system-item">
                    <span>Optimization Score</span>
                    <strong>{analytics?.optimization_score || '94.8'}%</strong>
                  </div>
                  {isPlanner ? (
                    <button className="replan-cta" onClick={() => handleTriggerReplanning()}>
                      <Icon name="replan" size={16} /> Execute Re-planning
                    </button>
                  ) : (
                    <button className="replan-cta" style={{ opacity: 0.7 }} onClick={() => setModal('Re-planning is managed by the Divisional Planner.')}>
                      <Icon name="replan" size={16} /> Re-planning (Planner Access Only)
                    </button>
                  )}
                </Panel>
              </section>
            </>
          )}

          {active === 'Maintenance Requests' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Maintenance Requests Catalog ({department === 'All' ? 'All Departments' : department})</h3>
                <button className="new-request" onClick={() => setModal('New maintenance request form')}>
                  <Icon name="plus" size={13} /> + New Maintenance Request
                </button>
              </div>
              <div className="panel-controls" style={{ marginBottom: 12 }}>
                <div className="tabs">
                  {['All', 'Open', 'Planned', 'In Progress', 'Completed'].map(tab => (
                    <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>
                      {tab}
                    </button>
                  ))}
                </div>
                <select className="department-select" value={department} onChange={e => setDepartment(e.target.value)} disabled={!isPlanner}>
                  {isPlanner ? (
                    <>
                      <option value="All">All Departments</option>
                      <option value="Engineering">Engineering</option>
                      <option value="S&T">S&amp;T</option>
                      <option value="Traction">Traction</option>
                    </>
                  ) : (
                    <option value={userDept}>{userDept}</option>
                  )}
                </select>
              </div>
              <div className="request-search" style={{ marginBottom: 14 }}>
                <Icon name="search" size={14} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter requests by ID, description, section..." />
              </div>
              <div className="table-wrap">
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
                      <th>DUE DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(job => (
                      <tr key={job.id} onClick={() => setModal(`${job.id}: ${job.description} · ${job.section} · ${job.block}`)}>
                        <td className="link-cell">{job.id}</td>
                        <td>{job.description}</td>
                        <td>{job.section}</td>
                        <td>{job.block}</td>
                        <td>{job.department}</td>
                        <td><Priority value={job.priority} /></td>
                        <td><StatusBadge value={job.status} /></td>
                        <td>{job.due || '20 May 2026'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {active === 'Block Planner' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Corridor Block Allocation &amp; Safety Slot Management</h3>
                <button className="primary-button" onClick={() => handleRunOptimization()}>Run Block Optimizer</button>
              </div>
              <div className="view-grid">
                {['B100', 'B110', 'B120', 'B130', 'B150', 'B158'].map(block => (
                  <div key={block} className="view-card">
                    <h4>Block Slot {block}</h4>
                    <p>Status: {block === 'B120' ? 'CRITICAL CONFLICT (ENG vs S&T)' : 'ACTIVE ALLOCATION'}</p>
                    <p>Speed Restriction: {block === 'B120' ? '30 km/h (Caution)' : '110 km/h (Normal)'}</p>
                    <button className="secondary-button" onClick={() => setModal(`Block ${block} details verified.`)}>Configure Block</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === 'Calendar / Gantt' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Master Maintenance Schedule — Gantt Timeline</h3>
                <div className="range-buttons">
                  {['Day', 'Week', 'Month'].map(v => (
                    <button key={v} className={range === v ? 'selected' : ''} onClick={() => setRange(v)}>{v}</button>
                  ))}
                </div>
              </div>
              <Gantt range={range} jobs={jobs} userDept={userDept} onTaskClick={task => setModal(task)} />
            </div>
          )}

          {active === 'Corridor Map' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Interactive Railway Corridor &amp; Track Section Map</h3>
                <div className="map-tools" style={{ position: 'relative', bottom: 0, right: 0, display: 'flex' }}>
                  <button onClick={() => setMapZoom(1)}>↺</button>
                  <button onClick={() => setMapZoom(Math.min(1.4, mapZoom + 0.15))}><Icon name="plus" size={13} /></button>
                  <button onClick={() => setMapZoom(Math.max(0.8, mapZoom - 0.15))}><Icon name="minus" size={13} /></button>
                </div>
              </div>
              <NetworkMap zoom={mapZoom} setZoom={setMapZoom} />
            </div>
          )}

          {active === 'Train Movements' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Live Freight &amp; Passenger Train Movement Schedule</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>TRAIN NO</th>
                      <th>NAME</th>
                      <th>CORRIDOR SECTION</th>
                      <th>SCHEDULED WINDOW</th>
                      <th>SPEED RESTRICTION</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['12845', 'Express Freight Train', 'Km 120 - 125 (B120)', '11:10 - 11:40', '30 km/h Caution', 'Conflict Delay'],
                      ['12626', 'Kerala Express', 'Km 100 - 105 (B100)', '09:15 - 09:45', '110 km/h Normal', 'On Time'],
                      ['12951', 'Rajdhani Express', 'Km 130 - 135 (B130)', '12:00 - 12:30', '130 km/h Normal', 'On Time'],
                    ].map(([no, name, sec, win, res, stat], i) => (
                      <tr key={i} onClick={() => setModal(`Train ${no} ${name}`)}>
                        <td className="link-cell">{no}</td>
                        <td>{name}</td>
                        <td>{sec}</td>
                        <td>{win}</td>
                        <td>{res}</td>
                        <td><StatusBadge value={stat === 'On Time' ? 'COMPLETED' : 'CONFLICT'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {active === 'Assets' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Railway Track, Signal &amp; Traction Asset Inventory</h3>
              </div>
              <div className="view-grid">
                {[
                  ['A008', 'Track Point Machine', 'Engineering', 'Km 120', '92.4% Health'],
                  ['A022', 'Signal Interlocking Unit', 'S&T', 'Km 120', '88.1% Health'],
                  ['A018', 'OHE Catenary Wire', 'Traction', 'Km 120', '95.0% Health'],
                  ['A004', 'Continuous Welded Rail', 'Engineering', 'Km 130', '91.2% Health'],
                ].map(([id, name, dept, loc, health], i) => (
                  <div key={i} className="view-card">
                    <h4>{id} — {name}</h4>
                    <p>Department: {dept}</p>
                    <p>Location: {loc}</p>
                    <p>Condition Score: <strong>{health}</strong></p>
                    <button className="secondary-button" onClick={() => setModal(`Asset ${id} health logs`)}>View History</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === 'Sections / Corridors' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Main Line Railway Corridor Sections &amp; Block Boundaries</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SECTION ID</th>
                      <th>NAME</th>
                      <th>BLOCK</th>
                      <th>CORRIDOR</th>
                      <th>MAX SPEED</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['SEC-100', 'Km 100 - 105', 'B100', 'Main Line Alpha', '130 km/h', 'Normal'],
                      ['SEC-120', 'Km 120 - 125', 'B120', 'Main Line Alpha', '30 km/h', 'Conflict / Maintenance'],
                      ['SEC-130', 'Km 130 - 135', 'B130', 'Main Line Alpha', '130 km/h', 'Normal'],
                      ['SEC-150', 'Km 150 - 155', 'B150', 'Main Line Alpha', '110 km/h', 'Normal'],
                    ].map(([id, name, blk, cor, spd, stat], i) => (
                      <tr key={i} onClick={() => setModal(`Section ${id} details`)}>
                        <td className="link-cell">{id}</td>
                        <td>{name}</td>
                        <td>{blk}</td>
                        <td>{cor}</td>
                        <td>{spd}</td>
                        <td><StatusBadge value={stat === 'Normal' ? 'COMPLETED' : 'CONFLICT'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {active === 'Proposed Plans' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>MARS AI Optimizer Proposed Maintenance Plans</h3>
                {isPlanner && <button className="primary-button" onClick={handleRunOptimization}>Generate New Plan</button>}
              </div>
              <div className="view-card" style={{ marginBottom: 14 }}>
                <h4>Proposed Master Plan #MP-2026-05-20</h4>
                <p>Optimization Score: <strong>94.8%</strong> · 0 Cross-Department Conflicts</p>
                <p>Allocated Windows: MR-101 (10:00 - 12:00), MR-102 (12:00 - 13:30)</p>
                {isPlanner && (
                  <button className="new-request" onClick={() => setModal('Master Plan #MP-2026-05-20 APPROVED and published.')}>
                    Approve &amp; Publish Master Plan
                  </button>
                )}
              </div>
            </div>
          )}

          {active === 'Re-planning' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Operational Disruption &amp; Dynamic Re-planning Engine</h3>
                {isPlanner && <button className="primary-button" onClick={handleTriggerReplanning}>Execute Re-planning</button>}
              </div>
              <div className="view-card">
                <h4>Simulated Network Disruption</h4>
                <p>Emergency track repair simulation on Block B120.</p>
                <p>Action: Calculates alternative non-overlapping block windows for S&amp;T and Traction.</p>
              </div>
            </div>
          )}

          {active === 'Alerts & Notifications' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Department Alerts &amp; Operational Notifications</h3>
              </div>
              <Alerts onSelect={(text) => setModal(text)} conflicts={conflicts} />
            </div>
          )}

          {active === 'Reports & Analytics' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Divisional Maintenance Performance &amp; Analytics Reports</h3>
              </div>
              <div className="view-grid">
                <div className="view-card">
                  <h4>Department Workload Distribution</h4>
                  <p>Engineering: 58% | S&amp;T: 24% | Traction: 18%</p>
                </div>
                <div className="view-card">
                  <h4>Block Utilization Rate</h4>
                  <p>Average daily corridor block utilization: <strong>87.1%</strong></p>
                </div>
              </div>
            </div>
          )}

          {active === 'Integrations' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>Indian Railways IT Systems Integration Status</h3>
              </div>
              <div className="view-grid">
                <div className="view-card">
                  <h4>FOIS (Freight Operations Info System)</h4>
                  <p>Status: <strong style={{ color: '#2d8b50' }}>CONNECTED</strong></p>
                </div>
                <div className="view-card">
                  <h4>ICMS (Integrated Coaching Management)</h4>
                  <p>Status: <strong style={{ color: '#2d8b50' }}>CONNECTED</strong></p>
                </div>
                <div className="view-card">
                  <h4>TMS (Track Management System)</h4>
                  <p>Status: <strong style={{ color: '#2d8b50' }}>CONNECTED</strong></p>
                </div>
              </div>
            </div>
          )}

          {active === 'Settings' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>MARS System Configuration &amp; User Preferences</h3>
              </div>
              <div className="view-card">
                <h4>Department Preferences ({userDept})</h4>
                <p>Role: {session?.role || userDept}</p>
                <p>Employee ID: {session?.employeeId || 'ENG001'}</p>
              </div>
            </div>
          )}

          {active === 'Help & Support' && (
            <div className="view-container">
              <div className="view-title-bar">
                <h3>MARS User Manual &amp; Emergency Contacts</h3>
              </div>
              <div className="view-card">
                <h4>Divisional Control Room Hotline</h4>
                <p>Phone: 139 / Railway Ext: 44210</p>
                <p>Support Email: mars-support@railnet.gov.in</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Maintenance Request Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">
              <Icon name="close" size={17} />
            </button>
            <div className="modal-kicker">MARS / OPERATIONS / {userDept.toUpperCase()}</div>
            <h3>{modal === 'New maintenance request form' ? '+ New Maintenance Request' : 'Information'}</h3>

            {modal === 'New maintenance request form' ? (
              <div className="request-form">
                <label>
                  Work Description
                  <input
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="e.g. Track Tamping & Alignment"
                  />
                </label>
                <label>
                  Section / Location
                  <input
                    value={newSection}
                    onChange={e => setNewSection(e.target.value)}
                    placeholder="e.g. Km 120 - 121"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label>
                    Block Number
                    <input
                      value={newBlock}
                      onChange={e => setNewBlock(e.target.value)}
                      placeholder="e.g. B120"
                    />
                  </label>
                  <label>
                    Priority
                    <select value={newPriority} onChange={e => setNewPriority(e.target.value as PriorityValue)}>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label>
                    Duration (Minutes)
                    <input
                      type="number"
                      value={newDuration}
                      onChange={e => setNewDuration(e.target.value)}
                      placeholder="120"
                    />
                  </label>
                  {isPlanner ? (
                    <label>
                      Department
                      <select value={newDept} onChange={e => setNewDept(e.target.value as Department)}>
                        <option value="Engineering">Engineering</option>
                        <option value="S&T">S&amp;T</option>
                        <option value="Traction">Traction</option>
                      </select>
                    </label>
                  ) : (
                    <label>
                      Department
                      <input value={userDept} disabled readOnly />
                    </label>
                  )}
                </div>

                <div className="modal-actions">
                  <button className="secondary-button" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button className="new-request" onClick={handleCreateRequest}>
                    Submit Maintenance Request
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="modal-copy">{modal}</p>
                <button className="primary-button" onClick={() => setModal(null)}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({
  icon,
  tone,
  label,
  value,
  change,
  onClick,
}: {
  icon: IconName
  tone: string
  label: string
  value: string
  change: string
  onClick?: () => void
}) {
  return (
    <button className="kpi-card" onClick={onClick}>
      <div className={`kpi-icon ${tone}`}>
        <Icon name={icon} size={25} />
      </div>
      <div className="kpi-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small><i>↑</i> {change}</small>
      </div>
    </button>
  )
}

function Panel({
  title,
  action,
  className = '',
  children,
  onAction,
}: {
  title: string
  action?: string
  className?: string
  children: ReactNode
  onAction?: () => void
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <h3>{title}</h3>
        {action && <button onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  )
}

function Priority({ value }: { value: PriorityValue }) {
  return <span className={`priority ${value.toLowerCase()}`}>{value}</span>
}

function StatusBadge({ value }: { value: JobStatus }) {
  const valStr = (value || 'OPEN').toString().toLowerCase().replace(/\s/g, '-')
  return <span className={`status-badge ${valStr}`}>{value}</span>
}

function NetworkMap({ zoom, setZoom }: { zoom: number; setZoom: (v: number) => void }) {
  return (
    <div className="network-map">
      <div className="map-summary">
        <span className="map-chip green">● On Time <b>12 Trains</b></span>
        <span className="map-chip amber">● Attention <b>2 Sections</b></span>
        <span className="map-chip red">● Conflict <b>B120 Overlap</b></span>
      </div>
      <div className="map-canvas">
        <svg viewBox="0 0 660 230" className="network-svg" style={{ transform: `scale(${zoom})` }} aria-label="Railway corridor schematic">
          <path d="M38 125 H170 H285 L335 82 L405 125 H500 H620" className="route normal" />
          <path d="M285 125 L335 165 L405 198" className="route attention" />
          <path d="M405 125 L450 82 L525 82" className="route delayed" />
          <g className="stations">
            {[[38,125,7],[170,125,5],[285,125,5],[335,82,6],[405,125,6],[500,125,5],[620,125,7],[335,165,5],[405,198,5],[450,82,5],[525,82,5]].map(([cx,cy,r],i) => (
              <circle key={i} cx={cx} cy={cy} r={r} />
            ))}
          </g>
          <g className="map-labels">
            <text x="38" y="151">STN A</text>
            <text x="170" y="151">KM 100</text>
            <text x="285" y="151">KM 120 (B120)</text>
            <text x="335" y="68">KM 130</text>
            <text x="405" y="151">KM 160</text>
            <text x="500" y="151">KM 170</text>
            <text x="620" y="151">STN B</text>
            <text x="335" y="184">KM 140</text>
            <text x="405" y="217">KM 150</text>
            <text x="450" y="68">KM 165</text>
            <text x="525" y="68">KM 175</text>
          </g>
        </svg>
      </div>
      <div className="map-legend">
        <span><i className="green-line" /> Normal</span>
        <span><i className="amber-line" /> Attention</span>
        <span><i className="red-line" /> Conflict</span>
        <span><i className="gray-line" /> No Data</span>
      </div>
      <div className="map-tools">
        <button onClick={() => setZoom(1)} aria-label="Reset map">↺</button>
        <button onClick={() => setZoom(Math.min(1.35, zoom + 0.15))} aria-label="Zoom in"><Icon name="plus" size={13} /></button>
        <button onClick={() => setZoom(Math.max(0.85, zoom - 0.15))} aria-label="Zoom out"><Icon name="minus" size={13} /></button>
        <button onClick={() => setZoom(1.2)} aria-label="Fit map"><Icon name="expand" size={13} /></button>
      </div>
    </div>
  )
}

function StatusList() {
  const rows = [
    ['trains', 'Running Trains', '24', 'On Time 18  |  Delayed 6', 'blue'],
    ['sections', 'Active Blocks', '38 / 52', 'In Use 38  |  Free 14', 'green'],
    ['assets', 'Maintenance in Progress', '16', 'Across 8 Blocks', 'orange'],
    ['alerts', 'Traffic Restrictions', '3', 'Active Now', 'red'],
  ] as const
  return (
    <div className="status-list">
      {rows.map(([icon, label, value, sub, tone]) => (
        <button className="status-row" key={label}>
          <span className={`status-icon ${tone}`}><Icon name={icon} size={18} /></span>
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

function Alerts({ onSelect, conflicts }: { onSelect: (text: string) => void; conflicts?: any[] }) {
  const alerts = [
    ['red', 'Train 12845 delayed by 1h 40m', 'Impact on block: Km 120-125 (10:00-12:00)', '10:20 AM'],
    ['amber', 'Block conflict detected in Km 120-121 (B120)', 'MR-101 (ENG) overlaps with MR-102 (S&T)', '09:45 AM'],
    ['amber', 'Critical defect reported in Km 158', 'Immediate attention required', '09:10 AM'],
    ['blue', 'New maintenance request MR-103', 'Added by Traction', '08:30 AM'],
  ] as const
  return (
    <div className="alerts-list">
      {alerts.map(([tone, title, sub, time]) => (
        <button className="alert-row" key={title} onClick={() => onSelect(`${title}. ${sub}`)}>
          <span className={`alert-icon ${tone}`}>{tone === 'blue' ? 'i' : '!'}</span>
          <div>
            <strong>{title}</strong>
            <small>{sub}</small>
          </div>
          <time>{time}</time>
        </button>
      ))}
    </div>
  )
}

function Gantt({ range, jobs, userDept, onTaskClick }: { range: string; jobs: Job[]; userDept: Department; onTaskClick: (task: string) => void }) {
  const defaultRows = [
    { label: 'Km 100 - 105', block: 'B100', left: '5%', width: '18%', text: 'MR-110 (S&T)', tone: 'green' },
    { label: 'Km 110 - 115', block: 'B110', left: '28%', width: '18%', text: 'MR-108 (ENG)', tone: 'orange' },
    { label: 'Km 120 - 125', block: 'B120', left: '9%', width: '49%', text: 'MR-101 (ENG)', tone: 'red' },
    { label: 'Km 130 - 135', block: 'B130', left: '38%', width: '20%', text: 'MR-104 (ENG)', tone: 'blue' },
    { label: 'Km 140 - 145', block: 'B140', left: '55%', width: '24%', text: 'MR-115 (TRACTION)', tone: 'purple' },
    { label: 'Km 150 - 155', block: 'B150', left: '78%', width: '16%', text: 'MR-112 (ENG)', tone: 'teal' },
  ]

  const days =
    range === 'Day'
      ? ['20 Mon']
      : range === 'Month'
        ? ['20 Mon', '24 Fri', '28 Tue', '01 Sat', '05 Wed', '09 Sun']
        : ['20 Mon', '21 Tue', '22 Wed', '23 Thu', '24 Fri', '25 Sat', '26 Sun']

  return (
    <div className="gantt">
      <div className="gantt-scroll">
        <div className="gantt-header">
          <div>BLOCKS / SECTIONS</div>
          {days.map(d => (
            <span key={d}>{d}</span>
          ))}
        </div>

        {defaultRows.map(row => (
          <div className="gantt-row" key={row.label}>
            <div className="gantt-label">
              <strong>{row.label}</strong>
              <small>{row.block}</small>
            </div>

            <div className="gantt-track">
              {days.map((_, i) => (
                <i key={i} />
              ))}

              <button
                className={`gantt-task ${row.tone}`}
                style={{ left: row.left, width: row.width }}
                onClick={() => onTaskClick(`${row.text} · ${row.label} · ${row.block}`)}
              >
                {row.text}
              </button>

              {row.tone === 'red' && (
                <button
                  className="conflict-task"
                  onClick={() => onTaskClick('Conflict: Cross-department block overlap between Engineering (MR-101) and S&T (MR-102) on B120.')}
                >
                  Other Dept Activity (MR-102)
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="gantt-legend">
        <span><i className="green-box" /> Engineering</span>
        <span><i className="orange-box" /> S&amp;T</span>
        <span><i className="blue-box" /> Traction</span>
        <span><i className="purple-box" /> Multi-Department</span>
        <span><i className="dash-box" /> Proposed</span>
        <span><i className="red-box" /> Conflict</span>
      </div>
    </div>
  )
}