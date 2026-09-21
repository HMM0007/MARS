import { Building2, CheckCircle2, Clock3, FileText, Link2, TrainFront } from 'lucide-react';

const items = [
  { key: 'assets', label: 'Total Assets', fallback: '1,23,456', icon: TrainFront, tone: 'blue' },
  { key: 'jobs', label: 'Jobs Evaluated', fallback: '150', icon: FileText, tone: 'purple' },
  { key: 'scheduled', label: 'Scheduled (This Month)', fallback: '116', icon: CheckCircle2, tone: 'green' },
  { key: 'deferred', label: 'Deferred', fallback: '34', icon: Clock3, tone: 'amber' },
  { key: 'blocks', label: 'Active Blocks (Week)', fallback: '38', icon: TrainFront, tone: 'blue' },
  { key: 'consolidated', label: 'Consolidated Blocks', fallback: '1', icon: Link2, tone: 'purple' },
];

const tones = {
  blue: 'bg-[#E7F0FC] text-[#1769D4]',
  purple: 'bg-[#EEE9FA] text-[#7353B6]',
  green: 'bg-[#E5F7EF] text-[#15956C]',
  amber: 'bg-[#FFF1DC] text-[#E58B13]',
};

export default function OperationalStrip({ planData, monthlyData, selectedDivision = 'Pune Division (CR)' }) {
  const weekly = planData?.metrics || planData?.weekly_metrics || {};
  const monthly = monthlyData?.summary || monthlyData?.monthly_summary || {};
  const values = {
    jobs: monthly.total_jobs ?? monthly.jobs_evaluated ?? weekly.total_jobs_evaluated ?? 150,
    scheduled: monthly.scheduled_this_month ?? monthly.total_jobs_scheduled ?? 116,
    deferred: monthly.deferred_next_month ?? monthly.total_jobs_deferred ?? 34,
    blocks: weekly.total_blocks ?? weekly.total_blocks_created ?? planData?.blocks?.length ?? 38,
    consolidated: weekly.consolidated_blocks ?? weekly.consolidated_blocks_count ?? planData?.consolidated_block_count ?? 1,
  };

  return (
    <div className="w-full border-b border-[#D4DDE7] bg-white px-3 py-2 shadow-[0_2px_7px_rgba(26,55,87,.08)] lg:px-5">
      <div className="flex min-w-[920px] items-center gap-0">
        <div className="flex w-[220px] shrink-0 items-center gap-3 border-r border-[#E1E7ED] pr-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#EEF4FB] text-[#1769D4]"><Building2 className="h-5 w-5" /></div>
          <div><div className="text-[9px] font-bold uppercase tracking-widest text-[#7A8A9B]">Division</div><div className="mt-0.5 text-xs font-extrabold text-[#173F6F]">{selectedDivision}</div></div>
        </div>
        {items.map(({ key, label, fallback, icon: Icon, tone }) => (
          <div key={key} className="flex min-w-[135px] flex-1 items-center gap-2 border-r border-[#E5EAF0] px-3 last:border-r-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}><Icon className="h-[18px] w-[18px]" /></div>
            <div className="min-w-0"><div className="truncate text-[9px] font-bold uppercase tracking-wide text-[#7A8A9B]">{label}</div><div className="mt-0.5 text-lg font-black leading-none text-[#173F6F]">{key === 'assets' ? fallback : values[key] ?? fallback}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
