import { useEffect, useState } from 'react';
import { Bell, CalendarDays, ChevronDown, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandAsset from './BrandAsset';

const divisions = [
  { id: 'pune-cr', name: 'Pune Division (CR)', code: 'PUNE-CR' },
  { id: 'mumbai-cr', name: 'Mumbai Division (CR)', code: 'BB-CR' },
  { id: 'delhi-nr', name: 'Delhi Division (NR)', code: 'DLI-NR' },
];

const roles = [
  { id: 'planner', name: 'Sr. DOM Pune', badge: 'D', dept: 'Divisional Operations' },
  { id: 'engineering', name: 'Sr. DEN (Civil)', badge: 'E', dept: 'Engineering' },
  { id: 'snt', name: 'Sr. DSTE (Signals)', badge: 'S', dept: 'Signalling & Telecom' },
  { id: 'traction', name: 'Sr. DEE (TRD)', badge: 'T', dept: 'Traction / OHE' },
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
    <header className="sticky top-0 z-50 text-white shadow-[0_2px_10px_rgba(0,36,86,.22)]">
      <div className="relative flex h-[74px] items-center justify-between gap-4 overflow-hidden border-b border-white/20 bg-gradient-to-r from-[#0755B4] via-[#1769D4] to-[#0B56B4] px-4 lg:px-7">
        <div className="pointer-events-none absolute inset-0 opacity-[.07] bg-[linear-gradient(90deg,transparent_0,transparent_49%,#fff_50%,transparent_51%,transparent_100%)] bg-[length:80px_80px]" />

        <div className="relative flex min-w-0 items-center gap-3 lg:w-[32%]">
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white shadow-lg">
              <BrandAsset name="indian_railways_emblem.png" alt="Indian Railways" className="h-full w-full object-contain p-1" fallback={<span className="text-[10px] font-black text-[#0757B8]">IR</span>} />
            </div>
            <div className="hidden xl:block leading-none">
              <div className="text-[17px] font-black tracking-tight">भारतीय रेल</div>
              <div className="mt-1 text-[13px] font-extrabold tracking-wide">INDIAN RAILWAYS</div>
              <div className="mt-1 text-[8px] font-medium tracking-[.16em] text-white/80">Safety | Service | Progress</div>
            </div>
          </Link>
        </div>

        <div className="relative min-w-0 flex-1 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="hidden h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/10 lg:flex">
              <BrandAsset name="mars_train_icon.png" alt="MARS" className="h-8 w-8 object-contain" fallback={<span className="text-xl">🚆</span>} />
            </div>
            <div className="text-left leading-none">
              <div className="text-3xl font-black tracking-tight lg:text-[39px]">MARS 2.0</div>
              <div className="mt-1 text-[9px] font-semibold tracking-[.18em] text-white/85 lg:text-[11px]">MAINTENANCE &amp; ASSET RESOURCE SCHEDULING</div>
            </div>
          </Link>
        </div>

        <div className="relative flex items-center justify-end gap-2 lg:w-[32%] lg:gap-3">
          <div className="hidden border-l border-white/30 pl-4 text-left xl:block">
            <div className="text-[12px] font-bold italic leading-tight">OPTIMIZING TODAY</div>
            <div className="text-[12px] font-bold italic leading-tight">FOR A RELIABLE TOMORROW</div>
          </div>
          <div className="hidden items-center gap-2 border-l border-white/25 pl-3 text-right lg:flex">
            <CalendarDays className="h-5 w-5" />
            <div className="font-mono text-[10px]"><div className="font-bold">{date}</div><div className="text-white/80">{time} IST</div></div>
          </div>
          <button className="relative rounded-full p-2 hover:bg-white/15" title="Operational alerts"><Bell className="h-5 w-5" /><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#E31B23] ring-2 ring-[#1769D4]" /></button>
          <div className="relative">
            <button type="button" onClick={() => { setRoleOpen(!roleOpen); setDivisionOpen(false); }} className="flex items-center gap-2 rounded-full px-1 py-1 hover:bg-white/15">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1769D4] shadow font-black">{role.badge || 'D'}</span>
              <span className="hidden text-left lg:block"><span className="block text-[11px] font-bold">{role.name}</span><span className="block text-[9px] text-white/75">{role.dept}</span></span>
              <ChevronDown className="hidden h-4 w-4 lg:block" />
            </button>
            {roleOpen && <Dropdown className="right-0 w-64">
              <div className="border-b border-[#D6DEE6] bg-[#F4F6F8] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#52606D]">Operating user</div>
              {roles.map((r) => <button key={r.id} onClick={() => { onRoleChange?.(r); setRoleOpen(false); }} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs text-[#17345C] hover:bg-[#EEF4FB]"><span><b>{r.name}</b><small className="block text-[#718294]">{r.dept}</small></span><span className="rounded bg-[#E8EEF5] px-1.5 py-0.5 font-mono font-bold">{r.badge}</span></button>)}
            </Dropdown>}
          </div>
        </div>
      </div>

      <div className="hidden h-[31px] items-center justify-between bg-white px-5 text-[10px] text-[#17345C] shadow-sm md:flex">
        <div className="flex items-center gap-2"><span className="font-bold text-[#1769D4]">Division</span><span className="relative"><button onClick={() => { setDivisionOpen(!divisionOpen); setRoleOpen(false); }} className="flex items-center gap-1 rounded border border-[#D6DEE6] bg-white px-3 py-1 font-semibold hover:bg-[#F4F6F8]">{selectedDivision?.name || divisions[0].name}<ChevronDown className="h-3 w-3" /></button>{divisionOpen && <Dropdown className="left-0 top-7 w-64">{divisions.map((d) => <button key={d.id} onClick={() => { onDivisionChange?.(d); setDivisionOpen(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#EEF4FB]"><span>{d.name}</span><span className="font-mono text-[10px] text-[#718294]">{d.code}</span></button>)}</Dropdown>}</span></div>
        <div className="flex items-center gap-5 font-semibold"><span>Planning Horizon: <b>Weekly / Monthly</b></span><span>System: <b className="text-[#16865F]">ONLINE</b></span><span>Network: <b>CRIS / DCO</b></span></div>
      </div>
    </header>
  );
}

function Dropdown({ children, className = '' }) { return <div className={`absolute z-[70] mt-1 overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-xl ${className}`}>{children}</div>; }
