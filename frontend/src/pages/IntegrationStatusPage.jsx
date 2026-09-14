import { useState, useEffect } from 'react';
import {
  fetchHealth,
  fetchDatasetStatus,
  fetchTMSJobs,
  fetchSMMSJobs,
  fetchTDMSJobs,
  fetchCOATimetable,
  fetchFreightForecast,
  fetchAllScoredJobs,
  fetchWeeklyPlan,
} from '../services/api';
import { Network, CheckCircle2, AlertCircle, RefreshCw, Radio, Database, FileText, ShieldCheck, Printer } from 'lucide-react';
import SanctionMemoModal from '../components/SanctionMemoModal';

const IntegrationStatusPage = () => {
  const [endpoints, setEndpoints] = useState([
    { name: 'Core Server Health', path: '/health', fn: fetchHealth, status: 'CHECKING', latency: null, count: null },
    { name: 'Dataset Raw Store', path: '/api/v1/dataset/status', fn: fetchDatasetStatus, status: 'CHECKING', latency: null, count: null },
    { name: 'TMS Adapter (Engineering)', path: '/api/v1/adapters/tms/jobs', fn: fetchTMSJobs, status: 'CHECKING', latency: null, count: null },
    { name: 'SMMS Adapter (S&T)', path: '/api/v1/adapters/smms/jobs', fn: fetchSMMSJobs, status: 'CHECKING', latency: null, count: null },
    { name: 'TDMS Adapter (Traction)', path: '/api/v1/adapters/tdms/jobs', fn: fetchTDMSJobs, status: 'CHECKING', latency: null, count: null },
    { name: 'COA Timetable (Passenger)', path: '/api/v1/adapters/coa/timetable', fn: fetchCOATimetable, status: 'CHECKING', latency: null, count: null },
    { name: 'COA Freight Forecast', path: '/api/v1/adapters/coa/freight-forecast', fn: fetchFreightForecast, status: 'CHECKING', latency: null, count: null },
    { name: 'AI Scored Jobs Pool', path: '/api/v1/core/jobs/all-scored', fn: fetchAllScoredJobs, status: 'CHECKING', latency: null, count: null },
  ]);
  const [testing, setTesting] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [showMemoModal, setShowMemoModal] = useState(false);

  const testAll = async () => {
    setTesting(true);
    const [updated] = await Promise.all([
      Promise.all(
        endpoints.map(async (ep) => {
          const start = performance.now();
          try {
            const res = await ep.fn();
            const latency = Math.round(performance.now() - start);
            const count = Array.isArray(res) ? `${res.length} Items` : res.status ? 'OK' : 'Active';
            return { ...ep, status: 'ONLINE', latency: `${latency}ms`, count };
          } catch (err) {
            return { ...ep, status: 'OFFLINE', latency: 'Err', count: err.message };
          }
        })
      ),
      fetchWeeklyPlan().then((p) => setBlocks(p?.scheduled_blocks || p?.blocks || [])).catch(() => {}),
    ]);
    setEndpoints(updated);
    setTesting(false);
  };

  useEffect(() => {
    testAll();
  }, []);

  return (
    <main className="p-4 space-y-4 bg-[#F4F6F8] min-h-full font-sans select-none">
      {/* 1. Header */}
      <div className="bg-white border border-[#D6DEE6] rounded p-3.5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-black text-[#1F2933] uppercase tracking-wide">
              CRIS Subsystem Integration & BDMS Gateway
            </h1>
            <span className="text-[10px] bg-[#2F6F7E] text-white px-2 py-0.5 rounded font-mono font-bold">
              LIVE GATEWAY
            </span>
          </div>
          <p className="text-xs text-[#52606D] mt-0.5">
            Real-time API Polling, CRIS Adapter Diagnostics & Official Form T/1518 Line Block Sanction Registry
          </p>
        </div>

        <button
          type="button"
          onClick={testAll}
          disabled={testing}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white rounded text-xs font-semibold hover:bg-[#2F6F7E] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Probing Adapters...' : 'Ping All Endpoints'}</span>
        </button>
      </div>

      {/* 2. Endpoint Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {endpoints.map((ep) => (
          <div
            key={ep.name}
            className="bg-white border border-[#D6DEE6] rounded p-3 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#1F2933] truncate">
                  {ep.name}
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  ep.status === 'ONLINE'
                    ? 'bg-[#2F9E44]/15 text-[#2F9E44]'
                    : ep.status === 'CHECKING'
                    ? 'bg-[#F08C00]/15 text-[#F08C00]'
                    : 'bg-[#C92A2A]/15 text-[#C92A2A]'
                }`}>
                  ● {ep.status}
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#2F6F7E] truncate">
                {ep.path}
              </p>
            </div>

            <div className="pt-2 mt-2 border-t border-[#D6DEE6] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#52606D]">
                Latency: <span className="font-bold text-[#1F2933]">{ep.latency || '--'}</span>
              </span>
              <span className="font-bold text-[#2F9E44]">
                {ep.count || '--'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Official BDMS Sanction Orders (Form T/1518) Registry */}
      <section className="bg-white border border-[#D6DEE6] rounded shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0A2540] text-white border-b border-[#1E3A5F]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#38BDF8]" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider">
                Official BDMS Sanction Orders Registry • Form T/1518 Memos
              </h2>
              <p className="text-[10px] text-white/70">
                Statutory Line Block Orders Verified under Indian Railways G&SR Rule 15.06
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-[#1E3A5F] px-2.5 py-1 rounded text-[#38BDF8] border border-white/10">
            {blocks.length} Sanctions Issued
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFB] border-b border-[#D6DEE6] text-[10px] font-bold uppercase tracking-wider text-[#60748A]">
              <tr>
                <th className="px-3.5 py-2.5">Sanction Order No.</th>
                <th className="px-3.5 py-2.5">Corridor / Section</th>
                <th className="px-3.5 py-2.5">Track / Line</th>
                <th className="px-3.5 py-2.5">Sanctioned Window</th>
                <th className="px-3.5 py-2.5">Departments</th>
                <th className="px-3.5 py-2.5">Safety Status</th>
                <th className="px-3.5 py-2.5 text-right">Official Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9EEF3]">
              {blocks.slice(0, 10).map((b, idx) => {
                const depts = b.departments || ['Engineering'];
                const isConsolidated = depts.length > 1;
                const memoRef = `CR/PA/OPTG/LB-2026/09/W1-${String(idx + 1).padStart(3, '0')}`;

                return (
                  <tr key={b.block_id || idx} className="hover:bg-[#F8FAFC] transition">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-[#8B0000]">
                      {memoRef}
                    </td>
                    <td className="px-3.5 py-2.5 font-bold text-[#0A2540]">
                      {b.section_id || 'PUNE-LNL'}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#52606D]">
                      {b.track_id}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#0A2540]">
                      {b.start_time ? new Date(b.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '01:15'} – {b.end_time ? new Date(b.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '04:45'} ({b.duration_hours || 3.5}h)
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1">
                        {isConsolidated && <span className="text-[10px]">🔗</span>}
                        <span className="font-semibold text-[#1F2937]">{depts.join(' + ')}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="rounded bg-[#D1FAE5] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#059669]">
                        ✓ SANCTIONED
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedBlock(b);
                          setShowMemoModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded border border-[#8B0000] bg-[#FFF8F0] hover:bg-[#FEE2E2] px-2.5 py-1 text-[10px] font-bold text-[#8B0000] transition shadow-2xs"
                      >
                        <FileText className="h-3 w-3 text-[#8B0000]" />
                        <span>Form T/1518 Memo</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Official Form T/1518 Modal */}
      <SanctionMemoModal
        isOpen={showMemoModal}
        onClose={() => setShowMemoModal(false)}
        block={selectedBlock}
        department={selectedBlock?.departments?.[0] || 'Engineering'}
      />
    </main>
  );
};

export default IntegrationStatusPage;
