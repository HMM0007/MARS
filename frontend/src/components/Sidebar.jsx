import { NavLink } from 'react-router-dom';
import { BarChart3, CalendarDays, ChevronDown, CircleHelp, Database, FileCheck2, Home, Map, Search, Settings, ShieldCheck, TrainFront, Wrench } from 'lucide-react';

const plannerItems = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/weekly', icon: TrainFront, label: 'Dashboard' },
  { to: '/monthly', icon: CalendarDays, label: 'Monthly Plan', caret: true },
  { to: '/weekly', icon: CalendarDays, label: 'Weekly Plan', caret: true },
  { to: '/dept/engineering', icon: Wrench, label: 'Jobs' },
  { to: '/dept/engineering', icon: Database, label: 'Asset Management', caret: true },
  { to: '/dept/snt', icon: Search, label: 'Inspection', caret: true },
  { to: '/impact', icon: ShieldCheck, label: 'Compliance' },
  { to: '/integration', icon: Database, label: 'BDMS Integration', caret: true },
  { to: '/impact', icon: BarChart3, label: 'Reports & Analytics', caret: true },
  { to: '/corridor', icon: Map, label: 'GIS Map' },
  { to: '/integration', icon: Settings, label: 'Administration', caret: true },
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
    <aside className="sticky top-[105px] flex h-[calc(100vh-105px)] w-[236px] shrink-0 flex-col border-r border-[#D5DDE7] bg-white">
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {items.map(({ to, icon: Icon, label, end, caret }) => (
          <NavLink key={`${to}-${label}`} to={to} end={end} className={({ isActive }) => `group mb-1 flex h-[42px] items-center justify-between rounded-md border-l-[3px] px-3 text-[13px] font-semibold transition-colors ${isActive ? 'border-[#0B5DBB] bg-[#1769D4] text-white shadow-[0_2px_6px_rgba(23,105,212,.18)]' : 'border-transparent text-[#31465E] hover:bg-[#F0F5FA] hover:text-[#1769D4]'}`}>
            {({ isActive }) => <><span className="flex min-w-0 items-center gap-3"><Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-[#4E6176]'}`} strokeWidth={2} /><span className="truncate">{label}</span></span>{caret && <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#718294]'}`} />}</>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#D8E0E8] bg-[#F5F8FB] p-3">
        <div className="rounded-md border border-[#D6DEE6] bg-white p-3">
          <div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#738496]">System Status</span><span className="h-2.5 w-2.5 rounded-full bg-[#19A974] shadow-[0_0_0_3px_#E2F5EC]" /></div>
          <p className="mt-2 text-xs font-extrabold text-[#173E6C]">MARS 2.0 Online</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] font-mono font-bold text-[#687B8F]"><span className="rounded bg-[#F1F5F8] px-1.5 py-1">CP-SAT READY</span><span className="rounded bg-[#F1F5F8] px-1.5 py-1 text-center">CRIS LINKED</span></div>
        </div>
        <div className="mt-3 text-center text-[10px] italic text-[#6D7E90]">“Reliable Assets<br />for a Stronger India”</div>
        <div className="mx-auto mt-2 h-1 w-24 bg-gradient-to-r from-[#F28C28] via-white to-[#16865F]" />
      </div>
    </aside>
  );
}
