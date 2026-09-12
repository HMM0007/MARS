import { NavLink } from 'react-router-dom';
import { BarChart3, CalendarDays, ChevronDown, Database, Home, Map, Settings, ShieldCheck, SlidersHorizontal, TrainFront, Wrench } from 'lucide-react';

const plannerItems = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/weekly', icon: SlidersHorizontal, label: 'Command Center' },
  {
    label: 'Planning',
    icon: CalendarDays,
    children: [
      { to: '/monthly', label: 'Monthly Plan' },
      { to: '/weekly', label: 'Weekly Plan' },
    ],
  },
  {
    label: 'Maintenance Jobs',
    icon: Wrench,
    children: [
      { to: '/dept/engineering', label: 'All Jobs' },
      { to: '/dept/engineering', label: 'By Department' },
      { to: '/impact', label: 'Priority & Risk' },
    ],
  },
  { to: '/corridor', icon: Map, label: 'Corridor Map' },
  { to: '/weekly', icon: SlidersHorizontal, label: 'What-If Simulator' },
  { to: '/impact', icon: ShieldCheck, label: 'Compliance & Safety' },
  { to: '/integration', icon: Database, label: 'BDMS Integration' },
  { to: '/impact', icon: BarChart3, label: 'Impact & Reports' },
  { to: '/integration', icon: Database, label: 'System Status' },
  { to: '/integration', icon: Settings, label: 'Settings' },
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

function NavItem({ to, icon: Icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `group mb-0.5 flex h-[39px] items-center justify-between rounded-md px-2.5 text-[12px] font-medium transition-colors ${isActive ? 'bg-[#E7F0FC] text-[#145DA8] shadow-[inset_3px_0_0_#1769D4]' : 'text-[#40546A] hover:bg-[#F0F4F8] hover:text-[#1769D4]'}`}
    >
      {({ isActive }) => (
        <span className="flex min-w-0 items-center gap-3">
          <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-[#1769D4]' : 'text-[#60748A]'}`} strokeWidth={isActive ? 2.15 : 1.85} />
          <span className="truncate">{label}</span>
        </span>
      )}
    </NavLink>
  );
}

function GroupItem({ icon: Icon, label, children }) {
  return (
    <div className="mb-0.5">
      <div className="flex h-[34px] items-center gap-3 px-2.5 text-[11px] font-bold uppercase tracking-[0.02em] text-[#52677C]">
        <Icon className="h-[16px] w-[16px] shrink-0 text-[#60748A]" strokeWidth={1.9} />
        <span>{label}</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-[#91A0AE]" />
      </div>
      <div className="ml-[31px] border-l border-[#DCE4EB] pl-1.5">
        {children.map((item) => (
          <NavLink
            key={`${item.to}-${item.label}`}
            to={item.to}
            className={({ isActive }) => `mb-0.5 flex h-[32px] items-center rounded-md px-2 text-[11px] font-medium transition-colors ${isActive ? 'bg-[#E7F0FC] text-[#145DA8]' : 'text-[#607184] hover:bg-[#F0F4F8] hover:text-[#1769D4]'}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({ currentRole }) {
  const isPlanner = currentRole?.id === 'planner';
  const items = isPlanner ? plannerItems : (deptItems[currentRole?.id] || deptItems.engineering);

  return (
    <aside className="sticky top-[105px] flex h-[calc(100vh-105px)] w-[218px] shrink-0 flex-col border-r border-[#D8E0E8] bg-[#FAFBFC]">
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 px-2 text-[8px] font-bold uppercase tracking-[0.16em] text-[#8A99A8]">Navigation</div>
        {items.map((item) => (
          item.children ? (
            <GroupItem key={item.label} {...item} />
          ) : (
            <NavItem key={`${item.to}-${item.label}`} {...item} />
          )
        ))}
      </nav>

      <div className="border-t border-[#D8E0E8] bg-white px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#8796A5]">System</p>
            <p className="mt-0.5 text-[10px] font-bold text-[#173E6C]">MARS 2.0 Online</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#19A974] shadow-[0_0_0_3px_#E6F7EF]" />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[8px] font-mono font-bold text-[#718294]">
          <span className="rounded bg-[#F1F5F8] px-1.5 py-1">CP-SAT READY</span>
          <span className="rounded bg-[#F1F5F8] px-1.5 py-1">CRIS LINKED</span>
        </div>
        <div className="mt-2.5 border-t border-[#E8EDF2] pt-2 text-center text-[9px] italic text-[#6D7E90]">Reliable Assets for a Stronger India</div>
        <div className="mx-auto mt-1.5 h-[3px] w-20 bg-gradient-to-r from-[#F28C28] via-white to-[#16865F]" />
      </div>
    </aside>
  );
}
