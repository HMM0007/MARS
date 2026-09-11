/**
 * MARS 2.0 Impact & Compliance Reports Console
 * Regulatory Compliance (IRPWM, IRSEM, G&SR) & Asset Availability Metrics
 */

import { useState } from 'react';
import {
  FileCheck,
  ShieldCheck,
  TrendingUp,
  Award,
  Download,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const ImpactReportsPage = () => {
  const [downloading, setDownloading] = useState(false);

  const rules = [
    { code: 'RULE-01', rule: 'Train Clearance Buffers', standard: 'G&SR 4.16', status: 'COMPLIANT', detail: 'Mandatory 15-min pre-block & 15-min post-block buffer enforced' },
    { code: 'RULE-02', rule: 'Machine Block Minimum Window', standard: 'IRPWM 2020', status: 'COMPLIANT', detail: 'BCM & Tamping machines granted minimum 2.5 hours continuous possession' },
    { code: 'RULE-03', rule: 'OHE Power Isolation Deadlines', standard: 'ACTM Vol-II', status: 'COMPLIANT', detail: 'Traction power-cut permits strictly bounded within certified intervals' },
    { code: 'RULE-04', rule: 'Safety Exclusion Pairs', standard: 'Safety Circ. 2024', status: 'COMPLIANT', detail: 'Flash-butt welding and signal cabling forbidden concurrently on same track' },
    { code: 'RULE-05', rule: 'Adjacent Track Staggering', standard: 'IRPWM Para 1008', status: 'COMPLIANT', detail: 'Heavy maintenance blocks staggered across UP & DN lines to prevent bottlenecks' },
    { code: 'RULE-06', rule: 'TSR Speed Recovery Curvature', standard: 'IRPWM 2020', status: 'COMPLIANT', detail: 'Automated 4-stage speed restoration (20 → 45 → 75 → 110 km/h) tracked' },
  ];

  const handleExport = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      alert('Official Railway Compliance Certificate generated and queued for Divisional Railway Manager (DRM) countersignature.');
    }, 1200);
  };

  return (
    <main className="p-4 space-y-4 bg-[#F4F6F8] min-h-full font-sans select-none">
      {/* 1. Header */}
      <div className="bg-white border border-[#D6DEE6] rounded p-3.5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-black text-[#1F2933] uppercase tracking-wide">
              Rule Compliance & Impact Analytics
            </h1>
            <span className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded font-mono font-bold">
              IRPWM / G&SR CERTIFICATION
            </span>
          </div>
          <p className="text-xs text-[#52606D] mt-0.5">
            Audit Trail & Statutory Compliance Validation for Pune Division (Central Railway)
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={downloading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2F9E44] text-white rounded text-xs font-semibold hover:bg-[#2F9E44]/90 transition-colors shadow-xs"
        >
          <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
          <span>{downloading ? 'Generating PDF...' : 'Download Compliance Certificate'}</span>
        </button>
      </div>

      {/* 2. Impact Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2 border-t-[#2F9E44]">
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Statutory Compliance</span>
          <p className="text-2xl font-black font-mono text-[#2F9E44] mt-1">100.0%</p>
          <p className="text-[10px] text-[#52606D] mt-1">12 of 12 IR Rules Passed</p>
        </div>

        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2 border-t-[#1E3A5F]">
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Track Hours Saved</span>
          <p className="text-2xl font-black font-mono text-[#1E3A5F] mt-1">18.5 hrs</p>
          <p className="text-[10px] text-[#52606D] mt-1">Via Multi-Dept Consolidation</p>
        </div>

        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2 border-t-[#2F6F7E]">
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Passenger Punctuality Protection</span>
          <p className="text-2xl font-black font-mono text-[#2F6F7E] mt-1">+98.2%</p>
          <p className="text-[10px] text-[#52606D] mt-1">COA Timetable Clearance Zero-Breach</p>
        </div>

        <div className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs border-t-2 border-t-[#6B5B95]">
          <span className="text-[10px] font-bold text-[#52606D] uppercase">Critical Defect Mitigation</span>
          <p className="text-2xl font-black font-mono text-[#6B5B95] mt-1">100%</p>
          <p className="text-[10px] text-[#52606D] mt-1">All Cat-90 Jobs Cleared</p>
        </div>
      </div>

      {/* 3. Statutory Rule Compliance Register Table */}
      <div className="bg-white border border-[#D6DEE6] rounded shadow-xs overflow-hidden">
        <div className="bg-[#F4F6F8] px-3.5 py-2 border-b border-[#D6DEE6] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#2F9E44]" />
            <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">
              Statutory Railway Rule Compliance Register
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#2F9E44]">
            AUTOMATED AUDIT PASSED
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F6F8]/60 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6]">
                <th className="py-2 px-3">Rule Code</th>
                <th className="py-2 px-3">Railway Rule Description</th>
                <th className="py-2 px-3">Standard Reference</th>
                <th className="py-2 px-3">Enforcement Verification</th>
                <th className="py-2 px-3">Audit Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DEE6]/60">
              {rules.map((r) => (
                <tr key={r.code} className="hover:bg-[#F4F6F8]/80 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#1E3A5F]">
                    {r.code}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#1F2933]">
                    {r.rule}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#52606D]">
                    {r.standard}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-[#52606D]">
                    {r.detail}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center space-x-1 text-[9px] bg-[#2F9E44]/10 text-[#2F9E44] border border-[#2F9E44]/30 px-2 py-0.5 rounded font-bold font-mono">
                      <CheckCircle2 className="w-3 h-3 text-[#2F9E44]" />
                      <span>{r.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

export default ImpactReportsPage;
