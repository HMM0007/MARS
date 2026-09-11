import { useEffect, useState } from 'react';
import { Bell, CalendarDays, ChevronDown, Menu, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const divisions = [
  { id: 'pune-cr', name: 'Pune Division (CR)', code: 'PUNE-CR' },
  { id: 'mumbai-cr', name: 'Mumbai Division (CR)', code: 'BB-CR' },
  { id: 'delhi-nr', name: 'Delhi Division (NR)', code: 'DLI-NR' },
];

const roles = [
  { id: 'planner', name: 'Planner', badge: 'P', dept: 'Pune Division (CR)' },
  { id: 'engineering', name: 'Sr. DEN (Civil)', badge: 'ENG', dept: 'Engineering' },
  { id: 'snt', name: 'Sr. DSTE (Signals)', badge: 'S&T', dept: 'Signalling & Telecom' },
  { id: 'traction', name: 'Sr. DEE (TRD)', badge: 'TRD', dept: 'Traction / OHE' },
];

export default function Header({ selectedDivision, selectedRole, onDivisionChange, onRoleChange }) {
  const [divisionOpen, setDivisionOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const role = selectedRole || roles[0];

  return (
    <header className="sticky top-0 z-50 border-b border-[#0B3977] bg-gradient-to-r from-[#0757B8] via-[#1769D4] to-[#0D55B1] text-white shadow-md">
      <div className="flex h-[78px] items-center justify-between gap-4 px-4 lg:px-7">
        <div className="flex min-w-0 items-center gap-3 lg:w-[31%]">
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <div className="h-[58px] w-[58px] overflow-hidden rounded-full bg-white shadow ring-1 ring-white/50">
              <img src="/assets/mars/indian_railways_emblem.png" alt="Indian Railways" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#0757B8]">IR</div>
            </div>
            <div className="hidden xl:block leading-none">
              <div className="text-[18px] font-black tracking-tight">भारतीय रेल</div>
              <div className="mt-1 text-[14px] font-bold tracking-wide">INDIAN RAILWAYS</div>
              <div className="mt-1 text-[9px] font-medium tracking-wider text-white/85">Safety | Service | Progress</div>
            </div>
          </Link>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <TrainMark />
            <div className="text-left leading-none">
              <div className="text-3xl font-black tracking-tight lg:text-[39px]">MARS 2.0</div>
              <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-white/85 lg:text-xs">MAINTENANCE &amp; ASSET RESOURCE SCHEDULING</div>
            </div>
          </Link>
        </div>

        <div className="flex items-center justify-end gap-2 lg:w-[31%] lg:gap-4">
          <div className="hidden border-l border-white/30 pl-4 text-left xl:block">
            <div className="text-[13px] font-semibold italic leading-tight">OPTIMIZING TODAY</div>
            <div className="text-[13px] font-semibold italic leading-tight">FOR A RELIABLE TOMORROW</div>
          </div>
          <div className="hidden items-center gap-2 border-l border-white/25 pl-4 text-right lg:flex">
            <CalendarDays className="h-6 w-6" />
            <div className="font-mono text-[11px]"><div className="font-bold">{date}</div><div className="text-white/80">{time} IST</div></div>
          </div>
          <button className="relative rounded-full p-2 hover:bg-white/15" title="Operational alerts"><Bell className="h-6 w-6" /><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#E31B23] ring-2 ring-[#1769D4]" /></button>
          <div className="relative">
            <button type="button" onClick={() => { setRoleOpen(!roleOpen); setDivisionOpen(false); }} className="flex items-center gap-2 rounded-full px-1.5 py-1 hover:bg-white/15">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1769D4] shadow font-black">{role.badge?.slice(0, 1) || 'P'}</span>
              <span className="hidden text-left lg:block"><span className="block text-xs font-bold">{role.name}</span><span className="block text-[10px] text-white/75">{role.dept}</span></span>
              <ChevronDown className="hidden h-4 w-4 lg:block" />
            </button>
            {roleOpen && <Dropdown className="right-0 w-64">
              <div className="border-b border-[#D6DEE6] bg-[#F4F6F8] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#52606D]">Operating user</div>
              {roles.map((r) => <button key={r.id} onClick={() => { onRoleChange?.(r); setRoleOpen(false); }} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs text-[#17345C] hover:bg-[#EEF4FB]"><span><b>{r.name}</b><small className="block text-[#718294]">{r.dept}</small></span><span className="rounded bg-[#E8EEF5] px-1.5 py-0.5 font-mono font-bold">{r.badge}</span></button>)}
            </Dropdown>}
          </div>
        </div>
      </div>
      <div className="hidden h-[32px] items-center justify-between bg-white px-5 text-[11px] text-[#17345C] shadow-sm md:flex">
        <div className="flex items-center gap-2"><span className="font-bold text-[#1769D4]">Division</span><span className="relative"><button onClick={() => { setDivisionOpen(!divisionOpen); setRoleOpen(false); }} className="flex items-center gap-1 rounded border border-[#D6DEE6] bg-white px-3 py-1 font-semibold hover:bg-[#F4F6F8]">{selectedDivision?.name || divisions[0].name}<ChevronDown className="h-3 w-3" /></button>{divisionOpen && <Dropdown className="left-0 top-7 w-64">{divisions.map((d) => <button key={d.id} onClick={() => { onDivisionChange?.(d); setDivisionOpen(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#EEF4FB]"><span>{d.name}</span><span className="font-mono text-[10px] text-[#718294]">{d.code}</span></button>)}</Dropdown>}</span></div>
        <div className="flex items-center gap-5 font-semibold"><span>Planning Horizon: <b>Weekly / Monthly</b></span><span>System: <b className="text-[#16865F]">ONLINE</b></span><span>Network: <b>CRIS / DCO</b></span></div>
      </div>
    </header>
  );
}

function Dropdown({ children, className = '' }) { return <div className={`absolute z-[70] mt-1 overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-xl ${className}`}>{children}</div>; }
function TrainMark() { return <span className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/45 bg-white/10 lg:flex"><TrainIcon /></span>; }
function TrainIcon() { return <span className="text-2xl">🚆</span>; }
