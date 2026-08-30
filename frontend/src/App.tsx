import { useState } from 'react'
import type { ReactNode } from 'react'

type IconName = 'dashboard' | 'jobs' | 'assets' | 'sections' | 'blocks' | 'trains' | 'plans' | 'replan' | 'reports' | 'users' | 'settings'

const navItems: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Maintenance Jobs', icon: 'jobs' },
  { label: 'Assets', icon: 'assets' },
  { label: 'Sections', icon: 'sections' },
  { label: 'Blocks', icon: 'blocks' },
  { label: 'Train Movements', icon: 'trains' },
  { label: 'Proposed Plans', icon: 'plans' },
  { label: 'Re-planning', icon: 'replan' },
  { label: 'Reports', icon: 'reports' },
]

const adminItems: { label: string; icon: IconName }[] = [
  { label: 'Users', icon: 'users' },
  { label: 'Settings', icon: 'settings' },
]

function Icon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    jobs: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/></>,
    assets: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.83 2.83-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.07a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.83-2.83.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.65 13H2v-4h.65A1.8 1.8 0 0 0 4.3 7.9a1.8 1.8 0 0 0-.36-2l-.05-.05L6.72 3l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.87 1.8V1h4v.8a1.8 1.8 0 0 0 1.1 1.61 1.8 1.8 0 0 0 2-.36l.05-.05 2.83 2.83-.05.05a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.35 9H22v4h-.65A1.8 1.8 0 0 0 19.4 15Z"/></>,
    sections: <><path d="M3 18h18M5 14l4-4 3 3 5-6 4 4"/><circle cx="5" cy="14" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="17" cy="7" r="1"/></>,
    blocks: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14M3 10h18M3 15h18"/></>,
    trains: <><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 18l-2 3M16 18l2 3M5 13h14M8 7h.01M16 7h.01"/></>,
    plans: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="11" cy="19" r="1"/></>,
    replan: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.2 9A7 7 0 0 1 19 7M18 15a7 7 0 0 1-12.8 2"/></>,
    reports: <><path d="M4 19V5M4 19h17"/><path d="M8 16v-5M12 16V7M16 16v-3M20 16V9"/></>,
    users: <><circle cx="12" cy="8" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.83 2.83-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.07a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.83-2.83.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.65 13H2v-4h.65A1.8 1.8 0 0 0 4.3 7.9a1.8 1.8 0 0 0-.36-2l-.05-.05L6.72 3l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.87 1.8V1h4v.8a1.8 1.8 0 0 0 1.1 1.61 1.8 1.8 0 0 0 2-.36l.05-.05 2.83 2.83-.05.05a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.35 9H22v4h-.65A1.8 1.8 0 0 0 19.4 15Z"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

const jobs = [
  ['J001', 'S01', 'B001', '06:00–08:00', 'HIGH', 'Scheduled'],
  ['J002', 'S03', 'B004', '07:30–09:30', 'MEDIUM', 'Scheduled'],
  ['J004', 'S05', 'B020', '06:00–10:00', 'CRITICAL', 'Scheduled'],
  ['J029', 'S07', 'B019', '09:30–12:30', 'HIGH', 'Scheduled'],
  ['J036', 'S05', 'B020', '06:30–09:30', 'CRITICAL', 'Scheduled'],
]

function App() {
  const [active, setActive] = useState('Dashboard')
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark" aria-hidden="true">M</div><div><div className="brand-name">MARS</div><div className="brand-subtitle">Maintenance Allocation<br />&amp; Routing System</div></div></div>
        <div className="sidebar-rule" />
        <nav className="nav" aria-label="Primary navigation">
          <div className="nav-label">OPERATIONS</div>
          {navItems.map((item) => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => setActive(item.label)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
          <div className="nav-label admin-label">ADMINISTRATION</div>
          {adminItems.map((item) => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => setActive(item.label)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-footer"><div className="system-status"><span className="status-dot" /> System operational</div><div className="footer-version">MARS · Prototype</div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="topbar-title"><button className="menu-button" aria-label="Toggle navigation">☰</button><div><h1>Dashboard Overview</h1><p>Maintenance planning and operational status</p></div></div><div className="topbar-actions"><div className="plan-state"><span /> Current Active Plan: <strong>ACTIVE</strong></div><button className="icon-button" aria-label="Refresh">↻</button><button className="icon-button notification" aria-label="Notifications">♢<b>3</b></button><div className="user-chip"><div className="avatar">PA</div><div><strong>Planner Admin</strong><small>Divisional Planner</small></div><span>⌄</span></div></div></header>
        <div className="content">
          <section className="page-heading"><div><span className="eyebrow">MARS / OPERATIONS</span><h2>Current Maintenance Plan</h2></div><div className="date-control">30 Aug 2026 <span>⌄</span></div></section>
          <section className="metric-strip" aria-label="Operational summary"><Metric label="Total Jobs" value="40" detail="Maintenance requirements" /><Metric label="Scheduled Jobs" value="11" detail="27.5% of total" /><Metric label="Unscheduled Jobs" value="29" detail="Require planning" /><Metric label="Critical Jobs" value="6" detail="Require attention" tone="critical" /><Metric label="Available Blocks" value="20" detail="Maintenance windows" /><Metric label="Active Sections" value="10" detail="Network sections" /></section>
          <section className="workspace-grid"><Panel title="Railway Operations" action="Open network"><div className="railway-view"><div className="railway-meta"><span>SCHEMATIC NETWORK</span><span>10 sections · 20 blocks</span></div><div className="railway-line"><Node code="S01" name="Section 01" status="active" /><Segment /><Node code="S02" name="Section 02" status="clear" /><Segment /><Node code="S03" name="Section 03" status="active" /><Segment warning /><Node code="S05" name="Section 05" status="work" /><Segment /><Node code="S07" name="Section 07" status="clear" /></div><div className="railway-legend"><span><i className="legend-active" /> Active</span><span><i className="legend-work" /> Maintenance</span><span><i className="legend-warning" /> Attention</span></div></div></Panel><Panel title="Operational Status" action="View details"><div className="status-list"><StatusRow label="Scheduled maintenance" value="11 jobs" tone="ok" /><StatusRow label="Pending planning" value="29 jobs" tone="warn" /><StatusRow label="Active conflicts" value="0" tone="ok" /><StatusRow label="Critical work" value="6 jobs" tone="critical" /><StatusRow label="Current plan" value="Active" tone="ok" /></div></Panel></section>
          <section className="section-block"><SectionHeader title="Maintenance Planning" subtitle="Current Active Plan · Scheduled work" action="View complete plan" /><div className="toolbar"><button className="filter">Status: All <span>⌄</span></button><button className="filter">Section: All <span>⌄</span></button><button className="filter">Department: All <span>⌄</span></button><button className="filter">Priority: All <span>⌄</span></button><div className="search">⌕ <span>Search jobs</span></div></div><div className="table-wrap"><table><thead><tr><th>JOB ID</th><th>SECTION</th><th>BLOCK</th><th>PLANNED TIME</th><th>PRIORITY</th><th>STATUS</th><th /></tr></thead><tbody>{jobs.map((job) => <tr key={job[0]}><td className="job-id">{job[0]}</td><td>{job[1]}</td><td>{job[2]}</td><td>{job[3]}</td><td><Priority value={job[4]} /></td><td><span className="status-badge scheduled">{job[5]}</span></td><td className="row-arrow">›</td></tr>)}</tbody></table></div></section>
          <section className="lower-grid"><Panel title="Maintenance Timeline" action="Open Gantt"><div className="mini-gantt"><div className="gantt-head"><span>SECTION / BLOCK</span><div>06:00&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 08:00&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 10:00&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 12:00</div></div><GanttRow label="S01 / B001" bar="j1" start="8%" width="24%" text="J001" /><GanttRow label="S03 / B004" bar="j2" start="28%" width="22%" text="J002" /><GanttRow label="S05 / B020" bar="critical" start="8%" width="48%" text="J004 · J036" /><GanttRow label="S07 / B019" bar="j4" start="50%" width="30%" text="J029" /></div></Panel><Panel title="Re-planning" action="Open workspace"><div className="replan-box"><div className="replan-title"><span className="alert-mark">!</span><div><strong>Operational change required?</strong><p>Run impact analysis and generate a revised plan.</p></div></div><div className="replan-steps"><span>1&nbsp; Event</span><i>→</i><span>2&nbsp; Impact</span><i>→</i><span>3&nbsp; Re-plan</span><i>→</i><span>4&nbsp; Review</span></div><button className="primary-button">Open Re-planning</button></div></Panel></section>
        </div>
      </main>
    </div>
  )
}

function Metric({ label, value, detail, tone = '' }: { label: string; value: string; detail: string; tone?: string }) { return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function Panel({ title, action, children }: { title: string; action?: string; children: ReactNode }) { return <div className="panel"><div className="panel-header"><h3>{title}</h3>{action && <button>{action} <span>›</span></button>}</div>{children}</div> }
function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action: string }) { return <div className="section-header"><div><h3>{title}</h3><p>{subtitle}</p></div><button>{action} <span>›</span></button></div> }
function Priority({ value }: { value: string }) { return <span className={`priority ${value.toLowerCase()}`}>{value}</span> }
function StatusRow({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className="status-row"><span><i className={`status-indicator ${tone}`} />{label}</span><strong>{value}</strong></div> }
function Node({ code, name, status }: { code: string; name: string; status: string }) { return <div className={`rail-node ${status}`}><span className="node-dot" /><strong>{code}</strong><small>{name}</small></div> }
function Segment({ warning = false }: { warning?: boolean }) { return <div className={`rail-segment ${warning ? 'warning' : ''}`}><span /></div> }
function GanttRow({ label, bar, start, width, text }: { label: string; bar: string; start: string; width: string; text: string }) { return <div className="gantt-row"><span>{label}</span><div className="gantt-track"><i className={`gantt-bar ${bar}`} style={{ left: start, width }} /><b style={{ left: `calc(${start} + 8px)` }}>{text}</b></div></div> }

export default App
