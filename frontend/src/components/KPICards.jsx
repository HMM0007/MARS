/**
 * MARS 2.0 KPI Cards Component
 * Professional Government Railway Application Metric Cards
 * Railway Blue Theme - No Neon Colors
 */

import { CalendarCheck, AlertTriangle, Layers, TrendingUp } from 'lucide-react';

const KPICards = ({ planData, loading = false }) => {
  const metrics = planData?.metrics || {};
  const consolidated = Number(metrics.consolidated_blocks ?? 0);

  // Asset availability is not currently calculated by the backend. Do not
  // fabricate a value; show the planning target until the metric is implemented.
  const availability = planData?.asset_availability_pct;

  const cards = [
    {
      title: 'Total Jobs Scheduled',
      value: metrics.total_jobs_scheduled ?? '--',
      icon: CalendarCheck,
      color: '#3B6EA5',
      subtitle: 'This Week',
    },
    {
      title: 'Active Conflicts',
      value: metrics.active_conflicts ?? '--',
      icon: AlertTriangle,
      color: '#B42318',
      subtitle: 'CP-SAT Guaranteed',
    },
    {
      title: 'Consolidated Blocks',
      value: consolidated,
      icon: Layers,
      color: '#6B5B95',
      subtitle: 'Multi-Dept Purple',
    },
    {
      title: 'Asset Availability',
      value: availability == null ? '—' : `${Number(availability).toFixed(1)}%`,
      icon: TrendingUp,
      color: '#2F8F6B',
      subtitle: availability == null ? 'Metric pending' : 'Target > 95%',
    },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const displayValue = loading ? '--' : card.value;

          return (
            <div
              key={card.title}
              className="bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                    <p className="text-sm text-[#52606D] font-medium">{card.title}</p>
                  </div>
                  <p className="text-2xl font-semibold text-[#1F2933]">{displayValue}</p>
                  <p className="text-xs text-[#52606D] mt-1">{card.subtitle}</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${card.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KPICards;
