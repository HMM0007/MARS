import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type IconName = 'dashboard' | 'requests' | 'planner' | 'calendar' | 'map' | 'trains' | 'assets' | 'sections' | 'plans' | 'replan' | 'alerts' | 'reports' | 'integrations' | 'settings' | 'help' | 'menu' | 'refresh' | 'bell' | 'chevron' | 'close' | 'search' | 'plus' | 'minus' | 'expand'
type PriorityValue = 'Critical' | 'High' | 'Medium'
type JobStatus = 'Open' | 'Planned' | 'In Progress' | 'Completed'
type Job = { id: string; description: string; section: string; block: string; priority: PriorityValue; status: JobStatus; due: string; department: string }

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
  { label: 'Alerts & Notifications', icon: 'alerts', badge: 6 },
  { label: 'Reports & Analytics', icon: 'reports' },
  { label: 'Integrations', icon: 'integrations' },
  { label: 'Settings', icon: 'settings' },
  { label: 'Help & Support', icon: 'help' },
]

const jobs: Job[] = [
  { id: 'MR-101', description: 'Track tamping', section: 'Km 120 - 121', block: 'B120', priority: 'Critical', status: 'Open', due: '20 May 2024', department: 'Engineering' },
  { id: 'MR-102', description: 'Signal equipment check', section: 'Km 121 - 122', block: 'B121', priority: 'High', status: 'Open', due: '21 May 2024', department: 'S&T' },
  { id: 'MR-103', description: 'OHE inspection', section: 'Km 120 - 122', block: 'B120', priority: 'Medium', status: 'Open', due: '22 May 2024', department: 'Traction' },
  { id: 'MR-104', description: 'Track renewal', section: 'Km 130 - 131', block: 'B130', priority: 'High', status: 'Planned', due: '22 May 2024', department: 'Engineering' },
  { id: 'MR-105', description: 'Interlocking test', section: 'Km 150 - 151', block: 'B150', priority: 'Medium', status: 'Planned', due: '23 May 2024', department: 'S&T' },
  { id: 'MR-106', description: 'Point machine inspection', section: 'Km 158 - 159', block: 'B158', priority: 'Critical', status: 'In Progress', due: '23 May 2024', department: 'Engineering' },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
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

function App() {
  const [active, setActive] = useState('Dashboard')
  const [department, setDepartment] = useState('Engineering')
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

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const matchesDept = department === 'All' || job.department === department
    const matchesTab = activeTab === 'All' || job.status === activeTab
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || [job.id, job.description, job.section, job.block, job.department].some(v => v.toLowerCase().includes(q))
    return matchesDept && matchesTab && matchesSearch
  }), [department, activeTab, search])

  const refresh = () => setLastRefresh(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const navigate = (label: string) => { setActive(label); setMobileNav(false); if (label !== 'Dashboard') setModal(`The ${label} workspace is ready for integration with its dedicated module.`) }

  return <div className="app-shell">
    <div className={`mobile-backdrop ${mobileNav ? 'show' : ''}`} onClick={() => setMobileNav(false)} />
    <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'} ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><span>रेल</span></div><div className="brand-copy"><div className="brand-name">MARS</div><div className="brand-subtitle">Maintenance Allocation &amp;<br />Routing System</div></div></div>
      <nav className="nav" aria-label="Primary navigation">
        <div className="nav-label">OPERATIONS</div>
        {navItems.slice(0, 12).map(item => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)} title={item.label}><Icon name={item.icon} /><span>{item.label}</span>{item.badge ? <b className="nav-badge">{item.badge}</b> : null}</button>)}
        <div className="nav-label admin-label">SYSTEM</div>
        {navItems.slice(12).map(item => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)} title={item.label}><Icon name={item.icon} /><span>{item.label}</span></button>)}
      </nav>
      <button className="sidebar-user" onClick={() => setModal('Planner Admin profile and account controls.') }><div className="avatar large">PA</div><div className="sidebar-user-text"><strong>Planner Admin</strong><span>Divisional Planner</span><em><i /> Online</em></div><span className="user-chevron">⌄</span></button>
      <div className="sidebar-footer"><span>© 2024 MARS</span><span>All rights reserved.</span></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-title"><button className="menu-button" onClick={() => window.innerWidth <= 900 ? setMobileNav(true) : setSidebarOpen(v => !v)} aria-label="Toggle navigation"><Icon name="menu" size={21} /></button><div><h1>Dashboard Overview</h1><p>Operational view of Current Active Plan · Refreshed {lastRefresh}</p></div></div>
        <div className="topbar-actions">
          <div className="plan-wrap"><button className="plan-select" onClick={() => setPlanOpen(v => !v)}>Current Active Plan <span className="active-chip">ACTIVE</span><span>⌄</span></button>{planOpen && <div className="dropdown plan-dropdown"><button onClick={() => { setPlanOpen(false); setModal('Current Active Plan selected.') }}>Current Active Plan <b>ACTIVE</b></button><button onClick={() => { setPlanOpen(false); setModal('Draft plan selected for review.') }}>Draft Plan <b>DRAFT</b></button></div>}</div>
          <button className="top-icon" onClick={refresh} aria-label="Refresh"><Icon name="refresh" /></button>
          <div className="notification-wrap"><button className="top-icon notification-button" onClick={() => setNotificationsOpen(v => !v)} aria-label="Notifications"><Icon name="bell" /><b>6</b></button>{notificationsOpen && <div className="dropdown notification-dropdown"><strong>Notifications</strong><p>3 critical operational alerts</p><p>2 block planning updates</p><p>1 new maintenance request</p><button onClick={() => { setNotificationsOpen(false); setActive('Alerts & Notifications') }}>View all alerts →</button></div>}</div>
          <button className="user-chip" onClick={() => setModal('Planner Admin profile and account controls.')}><div className="avatar">PA</div><div><strong>Planner Admin</strong><small>Divisional Planner</small></div><span>⌄</span></button>
        </div>
      </header>

      <div className="content">
        <section className="dashboard-heading"><div><span className="eyebrow">MARS / OPERATIONS</span><h2>Dashboard Overview</h2></div><button className="date-picker" onClick={() => setModal('Date range control: 20 May 2024 - 26 May 2024')}><span>▣</span> 20 May 2024 - 26 May 2024 <b>⌄</b></button></section>

        <section className="kpi-grid">
          <Kpi icon="requests" tone="blue" label="Total Maintenance Requests" value="142" change="18% vs last week" onClick={() => { setActiveTab('All'); setActive('Maintenance Requests') }} />
          <Kpi icon="alerts" tone="orange" label="Critical / High Priority" value="28" change="12% vs last week" onClick={() => setActiveTab('Critical')} />
          <Kpi icon="calendar" tone="green" label="Blocks Planned (This Week)" value="24" change="8% vs last week" onClick={() => setActive('Block Planner')} />
          <Kpi icon="planner" tone="purple" label="Asset Availability" value="92.4%" change="3.6% vs last week" onClick={() => setActive('Assets')} />
          <Kpi icon="planner" tone="navy" label="Block Utilization" value="87.1%" change="4.2% vs last week" onClick={() => setActive('Calendar / Gantt')} />
        </section>

        <section className="top-panels">
          <Panel title="Railway Network Overview" action="Open map" className="network-panel" onAction={() => setActive('Corridor Map')}><NetworkMap zoom={mapZoom} setZoom={setMapZoom} onSelect={(text) => setModal(text)} /></Panel>
          <Panel title="Operational Status" action="View details" className="status-panel" onAction={() => setModal('Operational status details: 24 running trains, 38 active blocks, 16 maintenance jobs and 3 traffic restrictions.')}><StatusList /></Panel>
          <Panel title="Alerts & Notifications" action="View All" className="alerts-panel" onAction={() => setActive('Alerts & Notifications')}><Alerts onSelect={(text) => setModal(text)} /></Panel>
        </section>

        <section className="middle-panels">
          <Panel title="Maintenance Requests (My Department)" className="requests-panel" action="View All Requests →" onAction={() => { setActiveTab('All'); setSearch('') }}>
            <div className="panel-controls">
              <div className="tabs" role="tablist">{['All','Open','Planned','In Progress','Completed'].map(tab => <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab} {tab === 'All' ? '(56)' : tab === 'Open' ? '(34)' : tab === 'Planned' ? '(16)' : tab === 'In Progress' ? '(4)' : '(2)'}</button>)}</div>
              <select className="department-select" value={department} onChange={e => setDepartment(e.target.value)} aria-label="Department"><option>Engineering</option><option>S&amp;T</option><option>Traction</option><option>All</option></select>
              <button className="new-request" onClick={() => setModal('New maintenance request form') }><Icon name="plus" size={13} /> New Request</button>
            </div>
            <div className="request-search"><Icon name="search" size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search request ID, work, section or block..." aria-label="Search maintenance requests" /></div>
            <div className="table-wrap"><table><thead><tr><th>REQ ID</th><th>WORK DESCRIPTION</th><th>LOCATION / SECTION</th><th>BLOCK</th><th>DEPARTMENT</th><th>PRIORITY</th><th>STATUS</th><th>DUE DATE</th></tr></thead><tbody>{filteredJobs.map(job => <tr key={job.id} onClick={() => setModal(`${job.id}: ${job.description} · ${job.section} · ${job.block}`)}><td className="link-cell">{job.id}</td><td>{job.description}</td><td>{job.section}</td><td>{job.block}</td><td>{job.department}</td><td><Priority value={job.priority} /></td><td><StatusBadge value={job.status} /></td><td>{job.due}</td></tr>)}{filteredJobs.length === 0 && <tr><td colSpan={8} className="empty-state">No maintenance requests match the current filters.</td></tr>}</tbody></table></div>
            <div className="table-footer"><span>Showing {filteredJobs.length} of {filteredJobs.length || 56} visible entries</span><button onClick={() => { setActiveTab('All'); setDepartment('All'); setSearch('') }}>Clear filters</button></div>
          </Panel>
          <Panel title="Maintenance Plan - Gantt View" className="gantt-panel">
            <div className="gantt-controls"><div className="range-buttons">{['Day','Week','Month'].map(v => <button key={v} className={range === v ? 'selected' : ''} onClick={() => setRange(v)}>{v}</button>)}</div><button className="gantt-icon" onClick={() => setModal('Gantt display settings')} aria-label="Gantt settings">⚙</button><button className="gantt-icon" onClick={() => setModal('Expanded Gantt view')} aria-label="Expand Gantt"><Icon name="expand" size={13} /></button></div><Gantt range={range} onTaskClick={task => setModal(task)} />
          </Panel>
        </section>

        <section className="bottom-panels"><Panel title="System Status" className="system-panel"><div className="system-status-line"><span className="online-dot" /><div><strong>All Systems Operational</strong><small>Backend API · Optimizer · Data Services</small></div></div><div className="system-item"><span>Last Plan Generated</span><strong>19 May 2024, 18:30</strong></div><div className="system-item"><span>Next Optimization Window</span><strong>27 May 2024, 02:00 AM</strong></div><button className="replan-cta" onClick={() => setActive('Re-planning')}><Icon name="replan" size={16} /> Go to Re-planning</button></Panel></section>
      </div>
    </main>

    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><Icon name="close" size={17} /></button><div className="modal-kicker">MARS / OPERATIONS</div><h3>{modal === 'New maintenance request form' ? 'New Maintenance Request' : 'Information'}</h3>{modal === 'New maintenance request form' ? <div className="request-form"><label>Work description<input placeholder="e.g. Track inspection" /></label><label>Section / location<input placeholder="e.g. Km 120 - 121" /></label><label>Priority<select defaultValue="High"><option>Critical</option><option>High</option><option>Medium</option></select></label><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="new-request" onClick={() => setModal('Maintenance request saved as draft.')}>Save Draft</button></div></div> : <><p className="modal-copy">{modal}</p><button className="primary-button" onClick={() => setModal(null)}>Close</button></>}</div></div>}
  </div>
}

function Kpi({ icon, tone, label, value, change, onClick }: { icon: IconName; tone: string; label: string; value: string; change: string; onClick?: () => void }) { return <button className="kpi-card" onClick={onClick}><div className={`kpi-icon ${tone}`}><Icon name={icon} size={25} /></div><div className="kpi-content"><span>{label}</span><strong>{value}</strong><small><i>↑</i> {change}</small></div></button> }
function Panel({ title, action, className = '', children, onAction }: { title: string; action?: string; className?: string; children: ReactNode; onAction?: () => void }) { return <section className={`panel ${className}`}><div className="panel-title"><h3>{title}</h3>{action && <button onClick={onAction}>{action}</button>}</div>{children}</section> }
function Priority({ value }: { value: PriorityValue }) { return <span className={`priority ${value.toLowerCase()}`}>{value}</span> }
function StatusBadge({ value }: { value: JobStatus }) { return <span className={`status-badge ${value.toLowerCase().replace(/\s/g, '-')}`}>{value}</span> }

function NetworkMap({ zoom, setZoom, onSelect }: { zoom: number; setZoom: (v: number) => void; onSelect: (text: string) => void }) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null)
  const points = [
    { id: 'stn-a', x: 38, y: 125, label: 'STN A', status: 'Normal', block: '—', jobs: 0, dept: 'All departments', window: 'No active block' },
    { id: 'km-100', x: 170, y: 125, label: 'KM 100', status: 'Normal', block: 'B100', jobs: 1, dept: 'S&T', window: '08:00 - 10:00' },
    { id: 'km-120', x: 285, y: 125, label: 'KM 120', status: 'Attention', block: 'B120', jobs: 3, dept: 'ENG · S&T · TRD', window: '10:00 - 12:00' },
    { id: 'km-130', x: 335, y: 82, label: 'KM 130', status: 'Attention', block: 'B130', jobs: 2, dept: 'Engineering', window: '11:00 - 14:00' },
    { id: 'km-160', x: 405, y: 125, label: 'KM 160', status: 'Delayed', block: 'B160', jobs: 2, dept: 'Traction', window: '14:00 - 16:00' },
    { id: 'km-170', x: 500, y: 125, label: 'KM 170', status: 'Normal', block: 'B170', jobs: 1, dept: 'Engineering', window: '15:00 - 17:00' },
    { id: 'stn-b', x: 620, y: 125, label: 'STN B', status: 'Normal', block: '—', jobs: 0, dept: 'All departments', window: 'No active block' },
    { id: 'km-140', x: 335, y: 165, label: 'KM 140', status: 'Attention', block: 'B140', jobs: 1, dept: 'S&T', window: '12:00 - 14:00' },
    { id: 'km-150', x: 405, y: 198, label: 'KM 150', status: 'Attention', block: 'B150', jobs: 2, dept: 'S&T · Traction', window: '15:00 - 17:00' },
    { id: 'km-165', x: 450, y: 82, label: 'KM 165', status: 'Delayed', block: 'B165', jobs: 1, dept: 'Traction', window: '16:00 - 18:00' },
    { id: 'km-175', x: 525, y: 82, label: 'KM 175', status: 'Delayed', block: 'B175', jobs: 2, dept: 'Engineering · Traction', window: '17:00 - 19:00' },
  ]
  const point = points.find(p => p.id === (hoveredPoint ?? selectedPoint))
  const selectPoint = (p: typeof points[number]) => {
    setSelectedPoint(p.id)
    onSelect(`${p.label} · ${p.block === '—' ? 'Station' : `Block ${p.block}`} · ${p.jobs} active job${p.jobs === 1 ? '' : 's'} · ${p.status}`)
  }
  return <div className="network-map">
    <div className="map-summary"><span className="map-chip green">● On Time <b>12 Trains</b></span><span className="map-chip amber">● Attention <b>2 Sections</b></span><span className="map-chip red">● Delayed <b>3 Trains</b></span></div>
    <div className="map-canvas">
      <style>{`
        .network-map .map-canvas{position:relative}
        .network-map .stations circle{cursor:pointer;transition:stroke-width .15s,filter .15s,fill .15s}
        .network-map .stations circle:hover,.network-map .stations circle.selected-point{stroke:#1468c4;stroke-width:4;filter:drop-shadow(0 1px 3px rgba(20,104,196,.25));fill:#eef5ff}
        .network-map .map-tooltip{position:absolute;z-index:5;width:218px;background:#fff;border:1px solid #cfd9e4;border-radius:6px;box-shadow:0 10px 24px rgba(28,52,78,.14);padding:10px;pointer-events:auto;transform:translate(-8%,-12%)}
        .network-map .map-tooltip-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:7px;border-bottom:1px solid #edf0f3}
        .network-map .map-tooltip-head strong{font-size:10px;color:#1b2c43}
        .network-map .map-tooltip-head span{font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 5px;border-radius:3px;background:#edf8f0;color:#2c8c4d}
        .network-map .map-tooltip.attention .map-tooltip-head span{background:#fff5e6;color:#b96e0b}
        .network-map .map-tooltip.delayed .map-tooltip-head span{background:#fff0f0;color:#c53d3d}
        .network-map .map-tooltip-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 10px;padding:9px 0}
        .network-map .map-tooltip-grid div{min-width:0}
        .network-map .map-tooltip-grid small{display:block;font-size:6px;text-transform:uppercase;letter-spacing:.05em;color:#8995a4;margin-bottom:2px}
        .network-map .map-tooltip-grid b{display:block;font-size:8px;line-height:1.3;color:#34465d;overflow-wrap:anywhere}
        .network-map .map-tooltip>button{border:0;background:#eef5ff;color:#1268c6;border-radius:4px;padding:6px 8px;font-size:8px;font-weight:600;cursor:pointer}
        .network-map .map-tooltip>button:hover{background:#e2efff}
        .network-map .map-help{margin-left:auto;color:#98a2af;font-style:italic}
        @media (max-width:760px){.network-map .map-tooltip{width:190px;transform:translate(-10%,-8%)}.network-map .map-help{width:100%;margin-left:0}}
      `}</style>
      <svg viewBox="0 0 660 230" className="network-svg" style={{ transform: `scale(${zoom})` }} aria-label="Interactive railway corridor schematic">
        <path d="M38 125 H170 H285 L335 82 L405 125 H500 H620" className="route normal"/>
        <path d="M285 125 L335 165 L405 198" className="route attention"/>
        <path d="M405 125 L450 82 L525 82" className="route delayed"/>
        <g className="stations">{points.map(p => <circle key={p.id} cx={p.x} cy={p.y} r={p.id.startsWith('stn') ? 7 : 5} className={(hoveredPoint ?? selectedPoint) === p.id ? 'selected-point' : ''} onMouseEnter={() => setHoveredPoint(p.id)} onFocus={() => setHoveredPoint(p.id)} onMouseLeave={() => setHoveredPoint(null)} onClick={() => selectPoint(p)} role="button" tabIndex={0} aria-label={`${p.label}, ${p.status}, ${p.jobs} active jobs`} />)}</g>
        <g className="map-labels">{points.map(p => <text key={p.id} x={p.x} y={p.y + (p.y < 100 ? -14 : 26)}>{p.label}</text>)}</g>
      </svg>
      {point && <div className={`map-tooltip ${point.status.toLowerCase()}`} style={{ left: `${Math.min(74, Math.max(8, (point.x / 660) * 100))}%`, top: `${Math.min(66, Math.max(8, (point.y / 230) * 100))}%` }}>
        <div className="map-tooltip-head"><strong>{point.label}</strong><span>{point.status}</span></div>
        <div className="map-tooltip-grid"><div><small>Block</small><b>{point.block}</b></div><div><small>Active Jobs</small><b>{point.jobs}</b></div><div><small>Department</small><b>{point.dept}</b></div><div><small>Window</small><b>{point.window}</b></div></div>
        <button type="button" onClick={() => selectPoint(point)}>View Details →</button>
      </div>}
    </div>
    <div className="map-legend"><span><i className="green-line" /> Normal</span><span><i className="amber-line" /> Attention</span><span><i className="red-line" /> Delayed</span><span><i className="gray-line" /> No Data</span><span className="map-help">Hover or click a point for details</span></div>
    <div className="map-tools"><button onClick={() => { setZoom(1); setHoveredPoint(null); setSelectedPoint(null) }} aria-label="Reset map">↺</button><button onClick={() => setZoom(Math.min(1.35, zoom + .15))} aria-label="Zoom in"><Icon name="plus" size={13} /></button><button onClick={() => setZoom(Math.max(.85, zoom - .15))} aria-label="Zoom out"><Icon name="minus" size={13} /></button><button onClick={() => setZoom(1.2)} aria-label="Fit map"><Icon name="expand" size={13} /></button></div>
  </div>
}
function StatusList() { const rows = [['trains','Running Trains','24','On Time 18  |  Delayed 6','blue'],['sections','Active Blocks','38 / 52','In Use 38  |  Free 14','green'],['assets','Maintenance in Progress','16','Across 8 Blocks','orange'],['alerts','Traffic Restrictions','3','Active Now','red']] as const; return <div className="status-list">{rows.map(([icon,label,value,sub,tone]) => <button className="status-row" key={label}><span className={`status-icon ${tone}`}><Icon name={icon} size={18} /></span><div className="status-copy"><strong>{label}</strong><small>{sub}</small></div><b>{value}</b></button>)}</div> }
function Alerts({ onSelect }: { onSelect: (text: string) => void }) { const alerts = [['red','Train 12845 delayed by 1h 40m','Impact on block: Km 120-125 (10:00-12:00)','10:20 AM'],['amber','Block conflict detected in Km 130-135','21 May','09:45 AM'],['amber','Critical defect reported in Km 158','Immediate attention required','09:10 AM'],['blue','New maintenance request MR-129','Added by Engineering','08:30 AM']] as const; return <div className="alerts-list">{alerts.map(([tone,title,sub,time]) => <button className="alert-row" key={title} onClick={() => onSelect(`${title}. ${sub}`)}><span className={`alert-icon ${tone}`}>{tone === 'blue' ? 'i' : '!'}</span><div><strong>{title}</strong><small>{sub}</small></div><time>{time}</time></button>)}</div> }
function Gantt({ range, onTaskClick }: { range: string; onTaskClick: (task: string) => void }) {
  const rows = [
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

        {rows.map(row => (
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
                onClick={() =>
                  onTaskClick(`${row.text} · ${row.label} · ${row.block}`)
                }
              >
                {row.text}
              </button>

              {row.tone === 'red' && (
                <button
                  className="conflict-task"
                  onClick={() =>
                    onTaskClick(
                      'Conflict: Other Department Activity overlaps MR-101 on B120.'
                    )
                  }
                >
                  Other Dept Activity
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

export default App
