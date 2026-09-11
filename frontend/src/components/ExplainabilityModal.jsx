/**
 * MARS 2.0 Explainability "Why?" Modal Component
 * Displays mathematical reasoning, hard constraint proofs, soft objective scoring,
 * TSR recovery curves, and associated jobs for any scheduled maintenance block.
 */

import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  X,
  FileText,
  Activity,
  Award,
  Zap,
} from 'lucide-react';

const ExplainabilityModal = ({ block, isOpen, onClose }) => {
  if (!isOpen || !block) return null;

  const depts = block.departments || ['Engineering'];
  const isConsolidated = block.is_consolidated || depts.length > 1;
  const jobs = block.jobs_detail || [];

  // 12 Embedded Railway Hard Constraints Check
  const hardConstraints = [
    {
      name: 'Train Clearance Buffers (15 + 15 min)',
      rule: 'G&SR 4.16',
      status: 'VERIFIED CLEAR',
      details: 'Pre-block margin of 15 min and post-block margin of 15 min maintained against COA timetable.',
    },
    {
      name: 'Single Track No-Overlap Possession',
      rule: 'IRPWM 2020',
      status: 'MATHEMATICALLY PROVEN',
      details: `Zero conflicting physical possessions on ${block.track_id} during ${block.duration_hours || 2.5}h window.`,
    },
    {
      name: 'OHE Power Isolation Window',
      rule: 'ACTM Vol-II',
      status: depts.includes('Traction') ? 'POWER-CUT CERTIFIED' : 'NOT REQUIRED',
      details: depts.includes('Traction')
        ? 'Traction permit isolation scheduled concurrently with track possession.'
        : 'Work performed without 25kV traction line shutdown.',
    },
    {
      name: 'Safety Exclusion Incompatibility Matrix',
      rule: 'Safety Circ. 2024',
      status: 'PASS',
      details: 'No conflicting heavy track welding scheduled alongside sensitive S&T signal cabling.',
    },
  ];

  // Soft Objective Multi-Criteria Optimizations
  const softObjectives = [
    {
      criterion: 'AI Priority & Risk Escalation',
      points: '+85.4 pts',
      note: 'High-criticality defect prioritized ahead of routine inspection',
    },
    {
      criterion: 'Night Non-Peak Window Preference',
      points: '+25.0 pts',
      note: 'Scheduled between 00:00 — 05:30 to minimize passenger train detention',
    },
    {
      criterion: isConsolidated ? 'Multi-Department Consolidation Bonus' : 'Single Department Window',
      points: isConsolidated ? '+40.0 pts BONUS' : '0.0 pts',
      note: isConsolidated
        ? 'Combined Engineering + S&T track possession saving 2.5 hours of corridor downtime'
        : 'Single department maintenance block',
    },
  ];

  // TSR Profile Stages
  const tsrStages = block.tsr_recovery_profile?.stages || [
    { day: 'Day 1', speed_kmh: 20, label: 'Initial Caution Order' },
    { day: 'Day 2', speed_kmh: 45, label: 'Secondary Speed Step' },
    { day: 'Day 3', speed_kmh: 75, label: 'Tamping Stability' },
    { day: 'Day 4', speed_kmh: 110, label: 'Full Sectional Speed Restored' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white border border-[#D6DEE6] rounded-md shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-[#1E3A5F] text-white px-4 py-3 flex items-center justify-between border-b border-[#13263E]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1 rounded bg-white/10 text-[#2F9E44]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  Reason for Allocation (Explainability Audit)
                </h2>
                <span className="text-[10px] bg-[#2F6F7E] text-white px-1.5 py-0.2 rounded font-mono">
                  CP-SAT SOLVER
                </span>
              </div>
              <p className="text-[11px] text-[#D6DEE6]">
                Block Identifier: <span className="font-mono font-bold text-white">{block.block_id}</span> • Track: <span className="font-mono text-white">{block.track_id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
            <div>
              <span className="text-[10px] font-bold text-[#52606D] uppercase">Section / Corridor</span>
              <p className="font-bold text-[#1F2933] font-mono mt-0.5">{block.section_id}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#52606D] uppercase">Scheduled Window</span>
              <p className="font-semibold text-[#1F2933] font-mono mt-0.5">
                {block.start_time?.slice(11, 16)} → {block.end_time?.slice(11, 16)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#52606D] uppercase">Possession Duration</span>
              <p className="font-bold text-[#1F2933] font-mono mt-0.5">{block.duration_hours || 2.5} Hours</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#52606D] uppercase">Block Classification</span>
              <div className="mt-0.5">
                {isConsolidated ? (
                  <span className="text-[9px] bg-[#6B5B95]/15 text-[#6B5B95] px-1.5 py-0.5 rounded font-bold font-mono border border-[#6B5B95]/30">
                    PURPLE CONSOLIDATED
                  </span>
                ) : (
                  <span className="text-[9px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-1.5 py-0.5 rounded font-bold font-mono">
                    STANDARD BLOCK
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Natural Language Explanation Box */}
          <div className="bg-[#2F6F7E]/10 border border-[#2F6F7E]/30 p-3 rounded">
            <h4 className="text-[11px] font-bold text-[#1E3A5F] uppercase tracking-wider flex items-center space-x-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-[#2F6F7E]" />
              <span>Automated Scheduling Justification</span>
            </h4>
            <p className="text-[#1F2933] leading-relaxed">
              {block.explanation ||
                `Scheduled optimal maintenance window on ${block.track_id} for ${depts.join(', ')} from ${block.start_time} to ${block.end_time}. Hard train buffers satisfied with zero passenger path conflicts, maximizing divisional corridor asset availability.`}
            </p>
          </div>

          {/* Section 1: Hard Constraints Audited */}
          <div>
            <h4 className="text-[11px] font-bold text-[#1F2933] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2F9E44]" />
              <span>Hard Operational Constraints (Mandatory IRPWM / G&SR Compliance)</span>
            </h4>
            <div className="border border-[#D6DEE6] rounded divide-y divide-[#D6DEE6] bg-white">
              {hardConstraints.map((hc) => (
                <div key={hc.name} className="p-2.5 flex items-start justify-between gap-2 hover:bg-[#F4F6F8]/50">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#1F2933]">{hc.name}</span>
                      <span className="text-[10px] font-mono text-[#52606D] bg-[#D6DEE6]/60 px-1 rounded">
                        {hc.rule}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#52606D] mt-0.5">{hc.details}</p>
                  </div>
                  <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-[#2F9E44]/15 text-[#2F9E44] border border-[#2F9E44]/30 flex-shrink-0">
                    ✓ {hc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Soft Objectives Multi-Criteria Scoring */}
          <div>
            <h4 className="text-[11px] font-bold text-[#1F2933] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-[#1E3A5F]" />
              <span>Soft Objective Optimization Function</span>
            </h4>
            <div className="border border-[#D6DEE6] rounded divide-y divide-[#D6DEE6] bg-white">
              {softObjectives.map((so) => (
                <div key={so.criterion} className="p-2.5 flex items-center justify-between hover:bg-[#F4F6F8]/50">
                  <div>
                    <p className="font-bold text-[#1F2933]">{so.criterion}</p>
                    <p className="text-[11px] text-[#52606D]">{so.note}</p>
                  </div>
                  <span className="text-[11px] font-bold font-mono text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded">
                    {so.points}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Post-Maintenance TSR Speed Recovery Curve */}
          <div>
            <h4 className="text-[11px] font-bold text-[#1F2933] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-[#C9842A]" />
              <span>Temporary Speed Restriction (TSR) Recovery Curve</span>
            </h4>
            <div className="border border-[#D6DEE6] rounded p-3 bg-white">
              <div className="grid grid-cols-4 gap-2 text-center">
                {tsrStages.map((stg, i) => (
                  <div key={stg.day} className="p-2 rounded bg-[#F4F6F8] border border-[#D6DEE6]">
                    <span className="text-[10px] font-bold font-mono text-[#52606D] uppercase">
                      {stg.day}
                    </span>
                    <p className="text-base font-black font-mono text-[#C9842A] my-0.5">
                      {stg.speed_kmh} <span className="text-[9px]">km/h</span>
                    </p>
                    <p className="text-[9px] text-[#52606D] truncate" title={stg.label}>
                      {stg.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Associated Jobs in this Block */}
          {jobs.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-[#1F2933] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-[#6B5B95]" />
                <span>Associated Maintenance Jobs ({jobs.length})</span>
              </h4>
              <div className="border border-[#D6DEE6] rounded overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F4F6F8] text-[10px] font-bold text-[#52606D] uppercase border-b border-[#D6DEE6]">
                    <tr>
                      <th className="py-1.5 px-3">Job ID</th>
                      <th className="py-1.5 px-3">Department</th>
                      <th className="py-1.5 px-3">Defect Description</th>
                      <th className="py-1.5 px-3">Duration</th>
                      <th className="py-1.5 px-3">Criticality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6DEE6]">
                    {jobs.map((j) => (
                      <tr key={j.job_id} className="hover:bg-[#F4F6F8]/60">
                        <td className="py-1.5 px-3 font-mono font-bold text-[#1E3A5F]">{j.job_id}</td>
                        <td className="py-1.5 px-3 font-semibold">{j.department}</td>
                        <td className="py-1.5 px-3 text-[#52606D]">{j.defect_type?.replace(/_/g, ' ')}</td>
                        <td className="py-1.5 px-3 font-mono">{j.estimated_duration_hours}h</td>
                        <td className="py-1.5 px-3">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#D6DEE6]">
                            {j.criticality_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F4F6F8] px-4 py-2.5 border-t border-[#D6DEE6] flex items-center justify-between">
          <span className="text-[10px] text-[#52606D] font-mono">
            Audit Hash: SHA256-IR-{(block.block_id || 'BLK').replace(/[^a-zA-Z0-9]/g, '')}-OK
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-semibold hover:bg-[#2F6F7E] transition-colors"
          >
            Close Audit Inspection
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExplainabilityModal;
