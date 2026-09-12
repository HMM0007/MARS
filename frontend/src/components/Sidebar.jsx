import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Database,
  Gauge,
  Home,
  Map,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
  Zap,
} from 'lucide-react';

const plannerItems = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/command-center', icon: Gauge, label: 'Command Center' },
  {
    key: 'planning',
    icon: CalendarDays,
    label: 'Planning',
    children: [
      { to: '/monthly', label: 'Monthly Plan' },
      { to: '/weekly', label: 'Weekly Plan' },
    ],
  },
  {
    key: 'jobs',
    icon: Wrench,
    label: 'Maintenance Jobs',
    children: [
      { to: '/jobs', label: 'All Jobs' },
      { to: '/jobs/department', label: 'By Department' },
      { to: '/jobs/priority-risk', label: 'Priority & Risk' },
    ],
  },
  { to: '/corridor', icon: Map, label: 'Corridor Map' },
  { to: '/what-if', icon: SlidersHorizontal, label: 'What-If Simulator' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliance & Safety' },
  { to: '/integration', icon: Database, label: 'BDMS Integration' },
  { to: '/impact', icon: BarChart3, label: 'Impact & Reports' },
  { to: '/system-status', icon: Zap, label: 'System Status' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const deptItems = {
  engineering: [
    { to: '/dept/engineering', icon: Home, label: 'Home', end: true },
    { to: '/dept/engineering', icon: Wrench, label: 'My Jobs' },
    { to: '/weekly', icon: CalendarDays, label: 'My Schedule' },
    { to: '/corridor', icon: Map, label: 'Corridor Map' },
    { to: '/impact', icon: BarChart3, label: 'Asset Risk' },
    { to: '/integration', icon: Database, label: 'TMS Status' },
    { to: '/', icon: Gauge, label: 'Planner Overview' },
  ],
  snt: [
    { to: '/dept/snt', icon: Home, label: 'Home', end: true },
    { to: '/dept/snt', icon: Wrench, label: 'My Jobs' },
    { to: '/weekly', icon: CalendarDays, label: 'My Schedule' },
    { to: '/corridor', icon: Map, label: 'Corridor Map' },
    { to: '/impact', icon: BarChart3, label: 'Asset Risk' },
    { to: '/integration', icon: Database, label: 'SMMS Status' },
    { to: '/', icon: Gauge, label: 'Planner Overview' },
  ],
  traction: [
    { to: '/dept/traction', icon: Home, label: 'Home', end: true },
    { to: '/dept/traction', icon: Wrench, label: 'My Jobs' },
    { to: '/weekly', icon: CalendarDays, label: 'My Schedule' },
    { to: '/corridor', icon: Map, label: 'Corridor Map' },
    { to: '/impact', icon: BarChart3, label: 'Asset Risk' },
    { to: '/integration', icon: Database, label: 'TDMS Status' },
    { to: '/', icon: Gauge, label: 'Planner Overview' },
  ],
};

function SectionNavItem({ item, expanded, onToggle }) {
  const Icon = item.icon;
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`group flex h-[40px] w-full items-center justify-between rounded-lg px-3 text-left text-[12px] font-semibold transition-all ${expanded ? 'bg-[#F1F5F8] text-[#173E6C]' : 'text-[#40546A] hover:bg-[#F4F7FA] hover:text-[#1769D4]'}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="h-[17px] w-[17px] shrink-0 text-[#60748A]" strokeWidth={1.9} />
          <span className="truncate">{item.label}</span>
        </span>
        {hasChildren && (expanded ? <ChevronDown className="h-3.5 w-3.5 text-[#718294]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#718294]" />)}
      </button>

      {expanded && hasChildren && (
        <div className="ml-[21px] mt-0.5 border-l border-[#D9E1E8] pl-2">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => `relative flex h-[34px] items-center rounded-md px-3 text-[11px] font-medium transition-colors ${isActive ? 'bg-[#E7F0FC] font-semibold text-[#145DA8]' : 'text-[#60748A] hover:bg-[#F4F7FA] hover:text-[#1769D4]'}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-[9px] h-[18px] w-[2px] rounded-full bg-[#1769D4]" />}
                  {child.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ currentRole }) {
  const isPlanner = currentRole?.id === 'planner';
  const items = isPlanner ? plannerItems : (deptItems[currentRole?.id] || deptItems.engineering);
  const [expanded, setExpanded] = useState({ planning: false, jobs: false });

  return (
    <aside className="sticky top-[105px] flex h-[calc(100vh-105px)] w-[236px] shrink-0 flex-col border-r border-[#D8E0E8] bg-white">
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8796A5]">Planner Navigation</div>

        {items.map((item) => {
          if (item.children) {
            return (
              <SectionNavItem
                key={item.key}
                item={item}
                expanded={Boolean(expanded[item.key])}
                onToggle={() => setExpanded((current) => ({ ...current, [item.key]: !current[item.key] }))}
              />
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `group mb-1 flex h-[40px] items-center rounded-lg px-3 text-[12px] font-semibold transition-all ${isActive ? 'bg-[#E8F1FB] text-[#145DA8] shadow-[inset_3px_0_0_#1769D4]' : 'text-[#40546A] hover:bg-[#F4F7FA] hover:text-[#1769D4]'}`}
            >
              {({ isActive }) => (
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-[#1769D4]' : 'text-[#60748A]'}`} strokeWidth={isActive ? 2.1 : 1.9} />
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[#D8E0E8] bg-[#FAFBFC] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#8796A5]">System</p>
            <p className="mt-0.5 text-[10px] font-bold text-[#173E6C]">MARS 2.0 Online</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#19A974] shadow-[0_0_0_3px_#E6F7EF]" />
        </div>
        <div className="mt-2 flex gap-1.5 text-[8px] font-mono font-bold text-[#718294]">
          <span className="rounded bg-white px-1.5 py-1 ring-1 ring-[#E3E8ED]">CP-SAT READY</span>
          <span className="rounded bg-white px-1.5 py-1 ring-1 ring-[#E3E8ED]">CRIS LINKED</span>
        </div>
      </div>
    </aside>
  );
}
