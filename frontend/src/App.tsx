import { useState } from 'react'
import type { ReactNode } from 'react'

type IconName = 'dashboard' | 'requests' | 'planner' | 'calendar' | 'map' | 'trains' | 'assets' | 'sections' | 'plans' | 'replan' | 'alerts' | 'reports' | 'integrations' | 'settings' | 'help' | 'menu' | 'refresh' | 'bell' | 'chevron'
type Job = { id: string; description: string; section: string; block: string; priority: 'Critical' | 'High' | 'Medium'; status: 'Open' | 'Planned'; due: string }

const navItems: { label: string; icon: IconName; badge?: number }[] = [
  { label: 'Dashboard', icon: 'dashboard' }, { label: 'Maintenance Requests', icon: 'requests' }, { label: 'Block Planner', icon: 'planner' },
  { label: 'Calendar / Gantt', icon: 'calendar' }, { label: 'Corridor Map', icon: 'map' }, { label: 'Train Movements', icon: 'trains' },
  { label: 'Assets', icon: 'assets' }, { label: 'Sections / Corridors', icon: 'sections' }, { label: 'Proposed Plans', icon: 'plans' },
  { label: 'Re-planning', icon: 'replan' }, { label: 'Alerts & Notifications', icon: 'alerts', badge: 6 }, { label: 'Reports & Analytics', icon: 'reports' },
  { label: 'Integrations', icon: 'integrations' }, { label: 'Settings', icon: 'settings' }, { label: 'Help & Support', icon: 'help' },
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
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>, refresh: <><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 5v6h-6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>, chevron: <path d="M9 18l6-6-6-6"/>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

const jobs: Job[] = [
  { id: 'MR-101', description: 'Track tamping', section: 'Km 120 - 121', block: 'B120', priority: 'Critical', status: 'Open', due: '20 May 2024' },
  { id: 'MR-102', description: 'Signal equipment check', section: 'Km 121 - 122', block: 'B121', priority: 'High', status: 'Open', due: '21 May 2024' },
  { id: 'MR-103', description: 'OHE inspection', section: 'Km 120 - 122', block: 'B120', priority: 'Medium', status: 'Open', due: '22 May 2024' },
  { id: 'MR-104', description: 'Track renewal', section: 'Km 130 - 131', block: 'B130', priority: 'High', status: 'Planned', due: '22 May 2024' },
  { id: 'MR-105', description: 'Interlocking test', section: 'Km 150 - 151', block: 'B150', priority: 'Medium', status: 'Planned', due: '23 May 2024' },
]

function App() {
  const [active, setActive] = useState('Dashboard')
  const [department, setDepartment] = useState('Engineering')
  const [range, setRange] = useState('Week')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
      <div className="brand"><div className="brand-mark"><span>रेल</span></div><div className="brand-copy"><div className="brand-name">MARS</div><div className="brand-subtitle">Maintenance Allocation &amp;<br />Routing System</div></div></div>
      <nav className="nav">{navItems.map(item => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => setActive(item.label)} title={item.label}><Icon name={item.icon} /><span>{item.label}</span>{item.badge ? <b className="nav-badge">{item.badge}</b> : null}</button>)}</nav>
      <div className="sidebar-user"><div className="avatar large">PA</div><div className="sidebar-user-text"><strong>Planner Admin</strong><span>Divisional Planner</span><em><i /> Online</em></div><span className="user-chevron">⌄</span></div>
      <div className="sidebar-footer"><span>© 2024 MARS</span><span>All rights reserved.</span><span>⌄</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-title"><button className="menu-button" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle navigation"><Icon name="menu" size={21} /></button><div><h1>Dashboard Overview</h1><p>Operational view of Current Active Plan</p></div></div><div className="topbar-actions"><button className="plan-select">Current Active Plan <span className="active-chip">ACTIVE</span><span>⌄</span></button><button className="top-icon"><Icon name="refresh" /></button><button className="top-icon notification-button"><Icon name="bell" /><b>6</b></button><div className="user-chip"><div className="avatar">PA</div><div><strong>Planner Admin</strong><small>Divisional Planner</small></div><span>⌄</span></div></div></header>
      <div className="content">
        <section className="dashboard-heading"><div><span className="eyebrow">MARS / OPERATIONS</span><h2>Dashboard Overview</h2></div><button className="date-picker">▣ &nbsp;20 May 2024 - 26 May 2024 <b>⌄</b></button></section>
        <section className="kpi-grid"><Kpi icon="requests" tone="blue" label="Total Maintenance Requests" value="142" change="18% vs last week" /><Kpi icon="alerts" tone="orange" label="Critical / High Priority" value="28" change="12% vs last week" /><Kpi icon="calendar" tone="green" label="Blocks Planned (This Week)" value="24" change="8% vs last week" /><Kpi icon="planner" tone="purple" label="Asset Availability" value="92.4%" change="3.6% vs last week" /><Kpi icon="planner" tone="navy" label="Block Utilization" value="87.1%" change="4.2% vs last week" /></section>
        <section className="top-panels"><Panel title="Railway Network Overview" action="Open map" className="network-panel"><NetworkMap /></Panel><Panel title="Operational Status" action="View details" className="status-panel"><StatusList /></Panel><Panel title="Alerts & Notifications" action="View All" className="alerts-panel"><Alerts /></Panel></section>
        <section className="middle-panels">
          <Panel title="Maintenance Requests (My Department)" className="requests-panel" action="View All Requests →"><div className="panel-controls"><div className="tabs"><button className="selected">All (56)</button><button>Open (34)</button><button>Planned (16)</button><button>In Progress (4)</button><button>Completed (2)</button></div><button className="department-select" onClick={() => setDepartment(department === 'Engineering' ? 'S&T' : department === 'S&T' ? 'Traction' : 'Engineering')}>{department} <span>⌄</span></button><button className="new-request">+ New Request</button></div><div className="table-wrap"><table><thead><tr><th>REQ ID</th><th>WORK DESCRIPTION</th><th>LOCATION / SECTION</th><th>BLOCK</th><th>PRIORITY</th><th>STATUS</th><th>DUE DATE</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td className="link-cell">{job.id}</td><td>{job.description}</td><td>{job.section}</td><td>{job.block}</td><td><Priority value={job.priority} /></td><td><StatusBadge value={job.status} /></td><td>{job.due}</td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing 1 to 5 of 56 entries</span><button>View All Requests <Icon name="chevron" size={13} /></button></div></Panel>
          <Panel title="Maintenance Plan - Gantt View" className="gantt-panel"><div className="gantt-controls"><div className="range-buttons">{['Day','Week','Month'].map(v => <button key={v} className={range === v ? 'selected' : ''} onClick={() => setRange(v)}>{v}</button>)}</div><button className="gantt-icon">⚙</button><button className="gantt-icon">⛶</button></div><Gantt range={range} /></Panel>
        </section>
        <Panel title="System Status" className="system-panel"><div className="system-status-line"><span className="online-dot" /><div><strong>All Systems Operational</strong><small>Backend API · Optimizer · Data Services</small></div></div><div className="system-item"><span>Last Plan Generated</span><strong>19 May 2024, 18:30</strong></div><div className="system-item"><span>Next Optimization Window</span><strong>27 May 2024, 02:00 AM</strong></div><button className="replan-cta" onClick={() => setActive('Re-planning')}><Icon name="replan" size={16} /> Go to Re-planning</button></Panel>
      </div>
    </main>
  </div>
}

function Kpi({ icon, tone, label, value, change }: { icon: IconName; tone: string; label: string; value: string; change: string }) { return <div className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon} size={25} /></div><div className="kpi-content"><span>{label}</span><strong>{value}</strong><small><i>↑</i> {change}</small></div></div> }
function Panel({ title, action, className = '', children }: { title: string; action?: string; className?: string; children: ReactNode }) { return <section className={`panel ${className}`}><div className="panel-title"><h3>{title}</h3>{action && <button>{action}</button>}</div>{children}</section> }
function Priority({ value }: { value: Job['priority'] }) { return <span className={`priority ${value.toLowerCase()}`}>{value}</span> }
function StatusBadge({ value }: { value: Job['status'] }) { return <span className={`status-badge ${value.toLowerCase()}`}>{value}</span> }

function NetworkMap() { return <div className="network-map"><div className="map-summary"><span className="map-chip green">● On Time <b>12 Trains</b></span><span className="map-chip amber">● Attention <b>2 Sections</b></span><span className="map-chip red">● Delayed <b>3 Trains</b></span></div><svg viewBox="0 0 660 230" className="network-svg"><path d="M38 125 H170 H285 L335 82 L405 125 H500 H620" className="route normal"/><path d="M285 125 L335 165 L405 198" className="route attention"/><path d="M405 125 L450 82 L525 82" className="route delayed"/><g className="stations"><circle cx="38" cy="125" r="7"/><circle cx="170" cy="125" r="5"/><circle cx="285" cy="125" r="5"/><circle cx="335" cy="82" r="6"/><circle cx="405" cy="125" r="6"/><circle cx="500" cy="125" r="5"/><circle cx="620" cy="125" r="7"/><circle cx="335" cy="165" r="5"/><circle cx="405" cy="198" r="5"/><circle cx="450" cy="82" r="5"/><circle cx="525" cy="82" r="5"/></g><g className="map-labels"><text x="38" y="151">STN A</text><text x="170" y="151">KM 100</text><text x="285" y="151">KM 120</text><text x="335" y="68">KM 130</text><text x="405" y="151">KM 160</text><text x="500" y="151">KM 170</text><text x="620" y="151">STN B</text><text x="335" y="184">KM 140</text><text x="405" y="217">KM 150</text><text x="450" y="68">KM 165</text><text x="525" y="68">KM 175</text></g></svg><div className="map-legend"><span><i className="green-line" /> Normal</span><span><i className="amber-line" /> Attention</span><span><i className="red-line" /> Delayed</span><span><i className="gray-line" /> No Data</span></div><div className="map-tools"><button>⟳</button><button>+</button><button>−</button><button>⌗</button></div></div> }
function StatusList() { const rows = [['trains','Running Trains','24','On Time 18  |  Delayed 6','blue'],['sections','Active Blocks','38 / 52','In Use 38  |  Free 14','green'],['assets','Maintenance in Progress','16','Across 8 Blocks','orange'],['alerts','Traffic Restrictions','3','Active Now','red']] as const; return <div className="status-list">{rows.map(([icon,label,value,sub,tone]) => <div className="status-row" key={label}><span className={`status-icon ${tone}`}><Icon name={icon} size={18} /></span><div className="status-copy"><strong>{label}</strong><small>{sub}</small></div><b>{value}</b></div>)}</div> }
function Alerts() { const alerts = [['red','Train 12845 delayed by 1h 40m','Impact on block: Km 120-125 (10:00-12:00)','10:20 AM'],['amber','Block conflict detected in Km 130-135','21 May','09:45 AM'],['amber','Critical defect reported in Km 158','Immediate attention required','09:10 AM'],['blue','New maintenance request MR-129','Added by Engineering','08:30 AM']] as const; return <div className="alerts-list">{alerts.map(([tone,title,sub,time]) => <div className="alert-row" key={title}><span className={`alert-icon ${tone}`}>{tone === 'blue' ? 'i' : '!'}</span><div><strong>{title}</strong><small>{sub}</small></div><time>{time}</time></div>)}</div> }
function Gantt({ range }: { range: string }) { const rows = [{label:'Km 100 - 105',block:'B100',left:'5%',width:'18%',text:'MR-110 (S&T)',tone:'green'},{label:'Km 110 - 115',block:'B110',left:'28%',width:'18%',text:'MR-108 (ENG)',tone:'orange'},{label:'Km 120 - 125',block:'B120',left:'9%',width:'49%',text:'MR-101 (ENG)',tone:'red'},{label:'Km 130 - 135',block:'B130',left:'38%',width:'20%',text:'MR-104 (ENG)',tone:'blue'},{label:'Km 140 - 145',block:'B140',left:'55%',width:'24%',text:'MR-115 (TRACTION)',tone:'purple'},{label:'Km 150 - 155',block:'B150',left:'78%',width:'16%',text:'MR-112 (ENG)',tone:'teal'}]; const days = range === 'Day' ? ['20 Mon'] : range === 'Month' ? ['20 Mon','24 Fri','28 Tue','01 Sat','05 Wed','09 Sun'] : ['20 Mon','21 Tue','22 Wed','23 Thu','24 Fri','25 Sat','26 Sun']; return <div className="gantt"><div className="gantt-header"><div>BLOCKS / SECTIONS</div>{days.map(d => <span key={d}>{d}</span>)}</div>{rows.map(row => <div className="gantt-row" key={row.label}><div className="gantt-label"><strong>{row.label}</strong><small>{row.block}</small></div><div className="gantt-track">{days.map((_,i) => <i key={i} />)}<div className={`gantt-task ${row.tone}`} style={{left:row.left,width:row.width}}>{row.text}</div>{row.tone === 'red' && <div className="conflict-task">Other Dept Activity</div>}</div></div>)}<div className="gantt-legend"><span><i className="green-box" /> Engineering</span><span><i className="orange-box" /> S&amp;T</span><span><i className="blue-box" /> Traction</span><span><i className="purple-box" /> Multi-Department</span><span><i className="dash-box" /> Proposed</span><span><i className="red-box" /> Conflict</span></div></div> }

export default App
