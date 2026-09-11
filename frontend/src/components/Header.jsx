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
  { id: 'planner', name: 'Planner - Pune Division (CR)', shortName: 'Sr. DOM Pune', badge: 'D', dept: 'Divisional Operations' },
  { id: 'engineering', name: 'Engineering - Pune Division (CR)', shortName: 'Sr. DEN (Civil)', badge: 'E', dept: 'Engineering' },
  { id: 'snt', name: 'S&T - Pune Division (CR)', shortName: 'Sr. DSTE (Signals)', badge: 'S', dept: 'Signalling & Telecom' },
  { id: 'traction', name: 'Traction - Pune Division (CR)', shortName: 'Sr. DEE (TRD)', badge: 'T', dept: 'Traction / OHE' },
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
  const weekday = now.toLocaleDateString('en-IN', { weekday: 'long' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const role = selectedRole || roles[0];

  return (
    <header className="sticky top-0 z-50 text-white shadow-[0_3px_14px_rgba(0,36,86,.24)]">
      <div className="relative flex h-[88px] w-full items-center overflow-hidden border-b border-white/20 bg-[#0755B4] px-3 sm:px-4 lg:px-5">
        <div className="absolute inset-y-0 left-0 w-[355px] bg-gradient-to-r from-[#176ED7] via-[#1165CC] to-[#0755B4] [clip-path:polygon(0_0,100%_0,88%_100%,0_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[length:72px_72px] opacity-20" />

        <div className="relative flex w-[31%] min-w-0 items-center gap-3 lg:gap-4">
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-3 lg:gap-4">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-[0_2px_8px_rgba(0,0,0,.18)]">
              <BrandAsset name="indian_railways_logo.png" alt="Indian Railways" className="h-full w-full object-contain p-1" fallback={<span className="text-[11px] font-black text-[#0757B8]">IR</span>} />
            </div>
            <div className="hidden min-w-0 leading-none xl:block">
              <div className="text-[17px] font-black tracking-tight">भारतीय रेल</div>
              <div className="mt-1 text-[14px] font-extrabold tracking-wide">INDIAN RAILWAYS</div>
              <div className="mt-1.5 text-[9px] font-medium tracking-[.13em] text-white/90">Safety | Service | Progress</div>
            </div>
          </Link>
        </div>

        <div className="relative flex min-w-0 flex-1 justify-center text-center">
          <Link to="/" className="flex min-w-0 items-center gap-3 lg:gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center overflow-hidden lg:flex">
              <BrandAsset name="mars_train_icon.png" alt="MARS railway scheduling" className="h-11 w-11 object-contain" fallback={<span className="text-3xl">🚆</span>} />
            </div>
            <div className="min-w-0 text-left leading-none">
              <div className="text-[36px] font-black tracking-[-.035em] sm:text-[42px] lg:text-[44px]">MARS 2.0</div>
              <div className="mt-1.5 text-[9px] font-semibold tracking-[.18em] text-white/90 sm:text-[10px] lg:text-[11px]">MAINTENANCE &amp; ASSET RESOURCE SCHEDULING</div>
            </div>
          </Link>
        </div>

        <div className="relative flex w-[31%] min-w-0 items-center justify-end gap-2 lg:gap-3 xl:gap-4">
          <div className="hidden border-l border-white/30 pl-4 text-left xl:block">
            <div className="text-[13px] font-bold italic leading-tight tracking-[.01em]">OPTIMIZING TODAY</div>
            <div className="text-[13px] font-bold italic leading-tight tracking-[.01em]">FOR A RELIABLE TOMORROW</div>
          </div>

          <div className="hidden items-center gap-2 border-l border-white/30 pl-3 text-right lg:flex">
            <CalendarDays className="h-[22px] w-[22px] shrink-0" />
            <div className="min-w-[91px] text-[10px] leading-tight">
              <div className="font-bold">{date}</div>
              <div className="mt-0.5 text-white/80">{weekday}, {time} IST</div>
            </div>
          </div>

          <button className="relative rounded-full p-2.5 hover:bg-white/15" title="Operational alerts" aria-label="Operational alerts">
            <Bell className="h-[21px] w-[21px]" />
            <span className="absolute right-1 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-[#0755B4] bg-[#E31B23] px-1 text-[8px] font-black text-white">3</span>
          </button>

          <div className="relative">
            <button type="button" onClick={() => { setRoleOpen(!roleOpen); setDivisionOpen(false); }} className="flex items-center gap-2 rounded-full px-1 py-1.5 hover:bg-white/15">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-[#EAF2FF] text-[15px] text-[#1769D4] shadow-sm font-black">{role.badge || 'D'}</span>
              <span className="hidden max-w-[165px] text-left lg:block">
                <span className="block truncate text-[12px] font-bold">{role.shortName || role.name}</span>
                <span className="block truncate text-[9px] text-white/80">Pune Division (CR)</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 lg:block" />
            </button>
            {roleOpen && <Dropdown className="right-0 top-12 w-72">
              <div className="border-b border-[#D6DEE6] bg-[#F4F6F8] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#52606D]">Operating user</div>
              {roles.map((r) => <button key={r.id} onClick={() => { onRoleChange?.(r); setRoleOpen(false); }} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs text-[#17345C] hover:bg-[#EEF4FB]"><span><b>{r.name}</b><small className="block text-[#718294]">{r.dept}</small></span><span className="rounded bg-[#E8EEF5] px-1.5 py-0.5 font-mono font-bold">{r.badge}</span></button>)}
            </Dropdown>}
          </div>
        </div>
      </div>

      <div className="flex h-[30px] items-center justify-between overflow-x-auto bg-white px-4 text-[10px] text-[#17345C] shadow-[0_1px_3px_rgba(20,45,75,.10)] md:px-5">
        <div className="flex shrink-0 items-center gap-2"><span className="font-bold text-[#1769D4]">Division</span><span className="relative"><button onClick={() => { setDivisionOpen(!divisionOpen); setRoleOpen(false); }} className="flex items-center gap-1 rounded border border-[#D6DEE6] bg-white px-3 py-1 font-semibold hover:bg-[#F4F6F8]">{selectedDivision?.name || divisions[0].name}<ChevronDown className="h-3 w-3" /></button>{divisionOpen && <Dropdown className="left-0 top-7 w-64">{divisions.map((d) => <button key={d.id} onClick={() => { onDivisionChange?.(d); setDivisionOpen(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#EEF4FB]"><span>{d.name}</span><span className="font-mono text-[10px] text-[#718294]">{d.code}</span></button>)}</Dropdown>}</span></div>
        <div className="hidden items-center gap-5 font-semibold md:flex"><span>Planning Horizon: <b>Weekly / Monthly</b></span><span>System: <b className="text-[#16865F]">ONLINE</b></span><span>Network: <b>CRIS / DCO</b></span></div>
      </div>
    </header>
  );
}

function Dropdown({ children, className = '' }) { return <div className={`absolute z-[70] mt-1 overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-xl ${className}`}>{children}</div>; }
