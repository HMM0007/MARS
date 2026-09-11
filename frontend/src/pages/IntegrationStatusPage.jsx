/**
 * MARS 2.0 CRIS Integration Health & Diagnostic Console
 * Live health monitoring, latency checks, and test runner for all CRIS adapters.
 */

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
} from '../services/api';
import { Network, CheckCircle2, AlertCircle, RefreshCw, Radio, Database } from 'lucide-react';

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

  const testAll = async () => {
    setTesting(true);
    const updated = await Promise.all(
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
    );
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
              CRIS Subsystem Integration Status
            </h1>
            <span className="text-[10px] bg-[#2F6F7E] text-white px-2 py-0.5 rounded font-mono font-bold">
              DIAGNOSTIC CONSOLE
            </span>
          </div>
          <p className="text-xs text-[#52606D] mt-0.5">
            Real-time API Polling & Network Latency Benchmark for Upstream Railway Systems
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
    </main>
  );
};

export default IntegrationStatusPage;
