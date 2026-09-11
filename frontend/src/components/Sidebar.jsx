import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Database,
  FileCheck2,
  Home,
  Map,
  Search,
  Settings,
  ShieldCheck,
  TrainFront,
  Wrench,
  Zap,
} from 'lucide-react';

const plannerItems = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/weekly', icon: TrainFront, label: 'Dashboard' },
  { to: '/monthly', icon: CalendarDays, label: 'Monthly Plan' },
  { to: '/weekly', icon: CalendarDays, label: 'Weekly Plan' },
  { to: '/dept/engineering', icon: Wrench, label: 'Jobs' },
  { to: '/dept/engineering', icon: Database, label: 'Asset Management' },
  { to: '/dept/snt', icon: Search, label: 'Inspection' },
  { to: '/impact', icon: ShieldCheck, label: 'Compliance' },
  { to: '/integration', icon: Database, label: 'BDMS Integration' },
  { to: '/impact', icon: BarChart3, label: 'Reports & Analytics' },
  { to: '/corridor', icon: Map, label: 'GIS Map' },
  { to: '/integration', icon: Settings, label: 'Administration' },
  { to: '/integration', icon: CircleHelp, label: 'Help & Support' },
];

const deptItems = {
  engineering: [
    { to: '/dept/engineering', icon: Home, label: 'Home', end: true },
    { to: '/dept/engineering', icon: Wrench, label: 'My Jobs' },
    { to: '/weekly', icon: CalendarDays, label: 'My Schedule' },
    { to: '/corridor', icon: Map, label: 'Corridor Map' },
    { to: '/impact', icon: BarChart3, label: 'Asset Risk' },
    { to: '/integration', icon: Database, label: 'TMS Status' },
    { to: '/', icon: TrainFront, label: 'Planner Overview' },
  ],
  snt: [
    { to: '/dept/snt', icon: Home, label: 'Home', end: true },
    { to: '/dept/snt', icon: Wrench, label: 'My Jobs' },
    { to: '/weekly', icon: CalendarDays, label: 'My Schedule' },
    { to: '/corridor', icon: Map, label: 'Corridor Map' },
    { to: '/impact', icon: BarChart3, label: 'Asset Risk' },
    { to: '/integration', icon: Database, label: 'SMMS Status' },
    { to: '/', icon: TrainFront, label: 'Planner Overview' },
  ],
  traction: [
    { to: '/dept/traction', icon: Home, label: 'Home', end: true },
    { to: '/dept/traction', icon: Wrench, label: 'My Jobs' },
    { to: '/weekly', icon: CalendarDays, label: 'My Schedule' },
    { to: '/corridor', icon: Map, label: 'Corridor Map' },
    { to: '/impact', icon: BarChart3, label: 'Asset Risk' },
    { to: '/integration', icon: Database, label: 'TDMS Status' },
    { to: '/', icon: TrainFront, label: 'Planner Overview' },
  ],
};

export default function Sidebar({ currentRole }) {
  const isPlanner = currentRole?.id === 'planner';
  const items = isPlanner ? plannerItems : (deptItems[currentRole?.id] || deptItems.engineering);

  return (
    <aside className="sticky top-[110px] flex h-[calc(100vh-110px)] w-[236px] shrink-0 flex-col border-r border-[#D5DDE7] bg-white shadow-[2px_0_8px_rgba(24,55,90,.04)]">
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={`${to}-${label}`} to={to} end={end} className={({ isActive }) => `group mb-1 flex h-[43px] items-center justify-between rounded-md border-l-[3px] px-3 text-[13px] font-semibold transition-all ${isActive ? 'border-[#1769D4] bg-[#E7F0FC] text-[#124B91]' : 'border-transparent text-[#31465E] hover:bg-[#F4F7FA] hover:text-[#1769D4]'}`}>
            {({ isActive }) => <><span className="flex items-center gap-3"><Icon className={`h-[18px] w-[18px] ${isActive ? 'text-[#1769D4]' : 'text-[#4E6176]'}`} strokeWidth={2} /><span>{label}</span></span>{!end && <ChevronRight className={`h-3.5 w-3.5 ${isActive ? 'text-[#1769D4]' : 'text-transparent group-hover:text-[#9AAABC]'}`} />}</>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#D8E0E8] bg-[#F5F8FB] p-3">
        <div className="rounded-md border border-[#D6DEE6] bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#738496]">System Status</span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#19A974] shadow-[0_0_0_3px_#E2F5EC]" />
          </div>
          <p className="mt-2 text-xs font-extrabold text-[#173E6C]">MARS 2.0 Online</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] font-mono font-bold text-[#687B8F]">
            <span className="rounded bg-[#F1F5F8] px-1.5 py-1">CP-SAT READY</span>
            <span className="rounded bg-[#F1F5F8] px-1.5 py-1 text-center">CRIS LINKED</span>
          </div>
        </div>
        <div className="mt-3 text-center text-[10px] italic text-[#6D7E90]">“Reliable Assets<br />for a Stronger India”</div>
        <div className="mx-auto mt-2 h-1 w-24 bg-gradient-to-r from-[#F28C28] via-white to-[#16865F]" />
      </div>
    </aside>
  );
}
