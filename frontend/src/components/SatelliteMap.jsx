import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Maximize2, Search, X, MapPinned, TrainFront, ShieldCheck, Activity, Clock3 } from 'lucide-react';
import { PUNE_LNL_STATIONS, getCoordinatesForKm } from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.397, 18.515], [73.887, 18.775]];
const MAP_BOUNDS = [[73.36, 18.48], [73.93, 18.82]];
const COLORS = { Engineering: '#1769AA', 'S&T': '#12805C', Traction: '#C46A12', Shared: '#66539A', Deferred: '#6B7280', Pending: '#E45718', Scheduled: '#1769AA' };
const departmentsOf = (item) => [...new Set((item?.departments || item?.jobs_detail?.map((j) => j.department) || (item?.department ? [item.department] : [])).filter(Boolean))];
const colorOf = (departments) => departments.length > 1 ? COLORS.Shared : (COLORS[departments[0]] || COLORS.Engineering);
const jobKey = (id) => String(id ?? '').trim();

function normaliseStatus(item, scheduledIds) {
  const id = jobKey(item?.job_id);
  if (item?.status === 'DEFERRED') return 'DEFERRED';
  if (scheduledIds.has(id)) return 'SCHEDULED';
  return item?.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING';
}
function blockJobs(block, jobsById) {
  const ids = Array.isArray(block?.job_ids) ? block.job_ids : [];
  const direct = Array.isArray(block?.jobs_detail) ? block.jobs_detail : [];
  const resolved = [...direct, ...ids.map((id) => jobsById.get(jobKey(id))).filter(Boolean)];
  const seen = new Set();
  return resolved.filter((j) => { const id = jobKey(j?.job_id); if (!id || seen.has(id)) return false; seen.add(id); return true; });
}
function makeBlockFeature(block, jobsById) {
  const details = blockJobs(block, jobsById);
  const kms = details.map((j) => Number(j.location_km)).filter(Number.isFinite);
  const ownKm = Number(block?.location_km);
  const anchor = kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : (Number.isFinite(ownKm) ? ownKm : null);
  if (!Number.isFinite(anchor)) return null;
  const minKm = kms.length ? Math.min(...kms) : anchor - 0.35;
  const maxKm = kms.length ? Math.max(...kms) : anchor + 0.35;
  const trackId = block?.track_id || details.find((j) => j?.track_id)?.track_id || 'PUNE-LNL-UP';
  const departments = departmentsOf(block).length ? departmentsOf(block) : departmentsOf(details[0]);
  const status = block?.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
  return { type: 'Feature', properties: { entity_type: 'BLOCK', block_id: block?.block_id || 'BLOCK', color: status === 'DEFERRED' ? COLORS.Deferred : colorOf(departments), status, department: departments.join(' + '), job_count: details.length || (Array.isArray(block?.job_ids) ? block.job_ids.length : 0), track_id: trackId, location_km: anchor, start_km: minKm, end_km: maxKm, job_ids: Array.isArray(block?.job_ids) ? block.job_ids.map(jobKey) : details.map((j) => j.job_id), start_time: block?.start_time || block?.planned_start || block?.possession_start || '', end_time: block?.end_time || block?.planned_end || block?.possession_end || '' }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(minKm, trackId), getCoordinatesForKm(maxKm, trackId)] } };
}
function makeJobFeature(job, scheduledIds) {
  const km = Number(job?.location_km); if (!Number.isFinite(km)) return null;
  const id = jobKey(job?.job_id); const status = normaliseStatus(job, scheduledIds); const trackId = job?.track_id || 'PUNE-LNL-UP'; const departments = departmentsOf(job);
  const color = status === 'DEFERRED' ? COLORS.Deferred : status === 'SCHEDULED' ? colorOf(departments) : COLORS.Pending;
  return { type: 'Feature', properties: { entity_type: 'JOB', job_id: id || 'JOB', color, status, department: departments.join(' + '), location_km: km, track_id: trackId, section_id: job?.section_id || 'PUNE-LNL', defect_type: job?.defect_type || job?.maintenance_type || 'Maintenance', asset_id: job?.asset_id || '', asset_type: job?.asset_type || '', criticality: job?.criticality_level || job?.criticality || '', due_date: job?.due_date || '', duration_hours: job?.estimated_duration_hours ?? '', work_type: job?.work_type || '', power_block_required: Boolean(job?.power_block_required) }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(km - 0.20, trackId), getCoordinatesForKm(km + 0.20, trackId)] } };
}

export default function SatelliteMap({ blocks = [], jobs = [], onOpenExplainability, isFullScreenMode = false, onToggleFullScreen }) {
  const containerRef = useRef(null); const mapRef = useRef(null); const stationLabelRefs = useRef([]); const activityLabelRefs = useRef([]); const activityFeaturesRef = useRef([]);
  const [loaded, setLoaded] = useState(false); const [mapError, setMapError] = useState(null); const [dept, setDept] = useState('ALL'); const [status, setStatus] = useState('ALL'); const [query, setQuery] = useState(''); const [inspection, setInspection] = useState(null);
  const jobsById = useMemo(() => new Map(jobs.map((j) => [jobKey(j?.job_id), j])), [jobs]);
  const scheduledJobIds = useMemo(() => new Set(blocks.flatMap((b) => Array.isArray(b?.job_ids) ? b.job_ids : []).map(jobKey).filter(Boolean)), [blocks]);
  const activityFeatures = useMemo(() => {
    const matches = (feature) => { const p = feature.properties; const departments = p.department ? p.department.split(' + ') : []; if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return false; if (dept === 'Shared' && departments.length < 2) return false; if (status !== 'ALL' && status !== p.status) return false; const text = `${p.block_id || ''} ${p.job_id || ''} ${(p.job_ids || []).join(' ')} ${p.department || ''} ${p.track_id || ''} ${p.start_km || ''} ${p.end_km || ''} ${p.asset_id || ''} ${p.asset_type || ''} ${p.section_id || ''} ${p.defect_type || ''} ${p.location_km || ''}`.toLowerCase(); return !query || text.includes(query.toLowerCase()); };
    return [...blocks.map((b) => makeBlockFeature(b, jobsById)).filter(Boolean), ...jobs.map((j) => makeJobFeature(j, scheduledJobIds)).filter(Boolean)].filter(matches);
  }, [blocks, jobs, jobsById, scheduledJobIds, dept, status, query]);
  const counts = useMemo(() => ({ jobs: jobs.length, blocks: blocks.length, scheduled: jobs.filter((j) => scheduledJobIds.has(jobKey(j?.job_id))).length, pending: jobs.filter((j) => !scheduledJobIds.has(jobKey(j?.job_id)) && j?.status !== 'DEFERRED' && j?.status !== 'COMPLETED').length, deferred: jobs.filter((j) => j?.status === 'DEFERRED').length, critical: jobs.filter((j) => (j?.criticality_level || j?.criticality) === 'CRITICAL').length }), [jobs, blocks, scheduledJobIds]);

  const clearActivityLabels = () => { activityLabelRefs.current.forEach(({ el }) => el.remove()); activityLabelRefs.current = []; };
  const updateStationLabels = () => { const map = mapRef.current; if (!map) return; stationLabelRefs.current.forEach(({ el, station }) => { const p = map.project([station.lng, station.lat]); const visible = map.getBounds().contains([station.lng, station.lat]); el.style.display = visible ? 'block' : 'none'; el.style.transform = `translate(${p.x}px,${p.y - 10}px) translate(-50%,-100%)`; }); };
  const updateActivityLabels = () => { const map = mapRef.current; if (!map) return; clearActivityLabels(); const zoom = map.getZoom(); if (zoom < 10.45) return; const occupied = []; activityFeaturesRef.current.forEach((feature, index) => { const pData = feature.properties; const coords = feature.geometry.coordinates; const mid = coords[Math.floor(coords.length / 2)]; const projected = map.project(mid); const isBlock = pData.entity_type === 'BLOCK'; const critical = !isBlock && pData.criticality === 'CRITICAL'; const priorityVisible = isBlock || critical || zoom >= 11.0; if (!priorityVisible) return; const tooClose = occupied.some((q) => Math.abs(q.x - projected.x) < 50 && Math.abs(q.y - projected.y) < 20); if (tooClose && zoom < 12.0) return; occupied.push({ x: projected.x, y: projected.y }); const el = document.createElement('button'); el.type = 'button'; el.textContent = isBlock ? `${pData.block_id} · ${pData.job_count} JOBS` : pData.job_id; el.title = isBlock ? `${pData.block_id} • ${pData.start_km.toFixed(2)}–${pData.end_km.toFixed(2)} km • ${pData.department || 'Maintenance'}` : `${pData.job_id} • ${pData.defect_type} • Km ${pData.location_km.toFixed(2)}`; const background = isBlock ? pData.color : (pData.status === 'SCHEDULED' ? '#F0F7FF' : pData.status === 'DEFERRED' ? '#F3F4F6' : '#FFF4E8'); const foreground = isBlock ? '#FFFFFF' : (pData.status === 'SCHEDULED' ? '#12528A' : pData.status === 'DEFERRED' ? '#4B5563' : '#9A3412'); const offset = (index % 3 - 1) * 13; el.style.cssText = `position:absolute;left:0;top:0;z-index:30;pointer-events:auto;transform:translate(${projected.x + offset}px,${projected.y - (isBlock ? 21 : 14)}px) translate(-50%,-50%);background:${background};color:${foreground};border:2px solid ${pData.color};border-radius:4px;padding:3px 6px;font:800 ${isBlock ? 8 : 7}px/11px Arial,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.26);white-space:nowrap;cursor:pointer;${critical ? 'box-shadow:0 0 0 2px #B42318,0 2px 7px rgba(0,0,0,.28);' : ''}`; el.addEventListener('click', () => setInspection({ type: 'ACTIVITY', data: pData })); map.getCanvasContainer().appendChild(el); activityLabelRefs.current.push({ el }); }); };

  useEffect(() => { activityFeaturesRef.current = activityFeatures; const map = mapRef.current; if (!map || !map.isStyleLoaded()) return; map.getSource('maintenance')?.setData({ type: 'FeatureCollection', features: activityFeatures }); requestAnimationFrame(updateActivityLabels); }, [activityFeatures]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({ container: containerRef.current, style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: '© OpenStreetMap contributors' }, railway: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }, maintenance: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }, layers: [
      { id: 'osm-base', type: 'raster', source: 'osm' },
      { id: 'railway-casing', type: 'line', source: 'railway', minzoom: 9.5, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 5, 12, 8, 16, 12], 'line-opacity': 0.95 } },
      { id: 'railway-up', type: 'line', source: 'railway', minzoom: 9.5, filter: ['==', ['get', 'direction'], 'UP'], paint: { 'line-color': '#123E73', 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 2.4, 12, 3.5, 16, 5.5], 'line-opacity': 1 } },
      { id: 'railway-dn', type: 'line', source: 'railway', minzoom: 9.5, filter: ['==', ['get', 'direction'], 'DN'], paint: { 'line-color': '#087A86', 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 2.4, 12, 3.5, 16, 5.5], 'line-opacity': 1 } },
      { id: 'railway-center', type: 'line', source: 'railway', minzoom: 12, paint: { 'line-color': '#FFFFFF', 'line-width': 1.1, 'line-opacity': 0.85 } },
      { id: 'block-casing', type: 'line', source: 'maintenance', filter: ['==', ['get', 'entity_type'], 'BLOCK'], minzoom: 9.5, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 8, 12, 12, 16, 18], 'line-opacity': 0.98 } },
      { id: 'block-line', type: 'line', source: 'maintenance', filter: ['==', ['get', 'entity_type'], 'BLOCK'], minzoom: 9.5, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 5, 12, 8, 16, 12], 'line-opacity': 0.96 } },
      { id: 'job-casing', type: 'line', source: 'maintenance', filter: ['==', ['get', 'entity_type'], 'JOB'], minzoom: 9.5, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 5, 12, 7, 16, 10], 'line-opacity': 0.98 } },
      { id: 'job-line', type: 'line', source: 'maintenance', filter: ['==', ['get', 'entity_type'], 'JOB'], minzoom: 9.5, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 2.8, 12, 4.2, 16, 6], 'line-opacity': 1, 'line-dasharray': ['case', ['==', ['get', 'status'], 'PENDING'], ['literal', [1, 2]], ['literal', [1, 0]]] } },
    ] }, center: [73.64, 18.65], zoom: 10.45, minZoom: 10.25, maxZoom: 18, maxBounds: MAP_BOUNDS, maxBoundsViscosity: 1, renderWorldCopies: false, attributionControl: true });
    mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

    const fallbackRailway = () => ({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { track_id: 'PUNE-LNL-UP', direction: 'UP' }, geometry: { type: 'LineString', coordinates: PUNE_LNL_STATIONS.map((s) => [s.lng, s.lat]) } },
      { type: 'Feature', properties: { track_id: 'PUNE-LNL-DN', direction: 'DN' }, geometry: { type: 'LineString', coordinates: PUNE_LNL_STATIONS.map((s) => [s.lng + 0.00018, s.lat + 0.00012]) } },
    ] });

    const loadDetailedRailway = async () => {
      try {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 3500);
        const response = await fetch('/geojson/pune_lonavala_railways.geojson', { cache: 'no-store', signal: controller.signal }); clearTimeout(timeout);
        if (!response.ok) throw new Error(`Railway geometry HTTP ${response.status}`);
        const data = await response.json();
        const lines = (data?.features || []).filter((f) => f?.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length > 1);
        const corridorLines = lines.filter((f) => { const p = f.properties || {}; return p.section_id === 'PUNE-LNL' || String(p.track_id || '').includes('PUNE-LNL'); });
        const usable = corridorLines.length ? corridorLines : lines; if (!usable.length) throw new Error('No railway LineString geometry found');
        const enriched = usable.map((f) => ({ ...f, properties: { ...(f.properties || {}), direction: String(f.properties?.direction || f.properties?.track_id || '').toUpperCase().includes('DN') ? 'DN' : 'UP' } }));
        map.getSource('railway')?.setData({ type: 'FeatureCollection', features: enriched });
      } catch (error) { console.warn('Detailed railway geometry unavailable; fallback retained.', error); }
    };

    map.once('load', () => {
      try {
        // Critical: never wait for an optional network asset before revealing the map.
        map.getSource('railway')?.setData(fallbackRailway());
        activityFeaturesRef.current = activityFeatures;
        map.getSource('maintenance')?.setData({ type: 'FeatureCollection', features: activityFeatures });

        stationLabelRefs.current = PUNE_LNL_STATIONS.map((station) => {
          const el = document.createElement('button'); el.type = 'button'; el.textContent = `${station.code} · ${station.name}`; el.title = `${station.name} • ${station.code} • Km ${station.km.toFixed(2)}`;
          el.style.cssText = 'position:absolute;left:0;top:0;z-index:24;pointer-events:auto;background:rgba(255,255,255,.96);border:1px solid #9BAFC1;border-radius:4px;padding:3px 5px;font:800 8px/11px Arial,sans-serif;color:#173E6C;box-shadow:0 1px 4px rgba(0,0,0,.20);cursor:pointer;white-space:nowrap;';
          el.addEventListener('click', () => setInspection({ type: 'STATION', data: station })); map.getCanvasContainer().appendChild(el); return { el, station };
        });
        const refresh = () => { updateStationLabels(); updateActivityLabels(); };
        map.on('move', refresh); map.on('resize', refresh); map.on('zoom', refresh);
        map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 96, right: 100, bottom: 96, left: 100 }, duration: 0 }); requestAnimationFrame(refresh);
        setLoaded(true); setMapError(null);
        // Upgrade to the repository geometry in the background; fallback remains visible if it fails.
        loadDetailedRailway();
      } catch (error) { console.error('Corridor map initialization failed:', error); setMapError(error?.message || 'Railway map could not be initialized.'); setLoaded(true); }
    });
    const resize = () => map.resize(); window.addEventListener('resize', resize);
    return () => { stationLabelRefs.current.forEach(({ el }) => el.remove()); clearActivityLabels(); stationLabelRefs.current = []; map.remove(); mapRef.current = null; window.removeEventListener('resize', resize); };
  }, []);

  useEffect(() => { const map = mapRef.current; if (!map) return; requestAnimationFrame(() => map.resize()); const timer = setTimeout(() => map.resize(), 200); return () => clearTimeout(timer); }, [isFullScreenMode]);
  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 96, right: 100, bottom: 96, left: 100 }, duration: 450 });

  const shell = <div className={`relative overflow-hidden border border-[#B9C6D1] bg-[#DDE5E9] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[2147483000] h-screen w-screen rounded-none' : 'h-[calc(100vh-245px)] min-h-[620px] rounded-lg'}`}>
    <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    <div className="pointer-events-none absolute left-4 top-4 z-40 rounded-md border border-[#C9D4DE] bg-white/96 px-3 py-2 shadow-lg"><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#68798A]"><ShieldCheck className="h-3 w-3 text-[#12805C]" /> CENTRAL RAILWAY • PUNE DIVISION</div><div className="mt-0.5 text-sm font-extrabold text-[#123E73]">PUNE–LONAVALA OPERATIONAL CORRIDOR</div><div className="mt-0.5 text-[9px] font-mono text-[#52606D]">Km 191.00 → 254.84 • DOUBLE LINE • 25 kV AC</div></div>
    <div className="absolute left-4 top-[94px] z-40 flex max-w-[720px] flex-wrap gap-1 rounded-md border border-[#C9D4DE] bg-white/96 p-1.5 shadow-lg">{['ALL', 'Engineering', 'S&T', 'Traction', 'Shared'].map((item) => <button key={item} onClick={() => setDept(item)} className={`rounded px-2.5 py-1.5 text-[9px] font-extrabold ${dept === item ? 'bg-[#173E6C] text-white' : 'text-[#52606D] hover:bg-[#EDF3F7]'}`}>{item}</button>)}<span className="mx-1 w-px bg-[#CBD5DF]" />{['ALL', 'SCHEDULED', 'DEFERRED', 'PENDING'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded px-2.5 py-1.5 text-[9px] font-extrabold ${status === item ? 'bg-[#087A86] text-white' : 'text-[#52606D] hover:bg-[#EDF3F7]'}`}>{item}</button>)}</div>
    <div className="absolute left-4 top-[140px] z-40 w-[330px]"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job / asset / defect / block / chainage" className="h-9 w-full rounded-md border border-[#C9D4DE] bg-white/96 pl-8 pr-8 text-[10px] font-mono shadow-lg outline-none focus:border-[#173E6C]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div></div>
    <div className="absolute right-4 top-4 z-40 flex gap-2"><button onClick={resetView} className="flex h-9 items-center gap-1.5 rounded-md border border-[#C9D4DE] bg-white px-3 text-[10px] font-extrabold text-[#173E6C] shadow-lg"><LocateFixed className="h-3.5 w-3.5" />Reset</button><button onClick={onToggleFullScreen} className="flex h-9 items-center gap-1.5 rounded-md border border-[#C9D4DE] bg-white px-3 text-[10px] font-extrabold text-[#173E6C] shadow-lg"><Maximize2 className="h-3.5 w-3.5" />{isFullScreenMode ? 'Exit' : 'Full Screen'}</button></div>
    <div className="absolute right-4 top-[94px] z-40 w-[270px] rounded-md border border-[#C9D4DE] bg-[#F8FAFC]/96 p-2 shadow-lg"><div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#52606D]"><Activity className="h-3 w-3 text-[#12805C]" /> LIVE OPERATIONAL LAYERS</div><div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-bold text-[#52606D]"><span><i className="mr-1 inline-block h-2 w-7 rounded bg-[#123E73]" />UP track</span><span><i className="mr-1 inline-block h-2 w-7 rounded bg-[#087A86]" />DN track</span><span><i className="mr-1 inline-block h-2 w-7 rounded bg-[#1769AA]" />Possession</span><span><i className="mr-1 inline-block h-2 w-7 rounded border border-[#E45718] bg-[#FFF4E8]" />Pending job</span></div><div className="mt-2 grid grid-cols-3 divide-x border-t border-[#D6DEE6] pt-1.5 text-center"><div><div className="text-[8px] uppercase text-[#8796A5]">Jobs</div><div className="text-sm font-extrabold text-[#173E6C]">{counts.jobs}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Blocks</div><div className="text-sm font-extrabold text-[#12805C]">{counts.blocks}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Critical</div><div className="text-sm font-extrabold text-[#B42318]">{counts.critical}</div></div></div><div className="mt-1 grid grid-cols-3 divide-x border-t border-[#D6DEE6] pt-1.5 text-center"><div><div className="text-[8px] uppercase text-[#8796A5]">Scheduled</div><div className="text-[11px] font-extrabold text-[#1769AA]">{counts.scheduled}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Pending</div><div className="text-[11px] font-extrabold text-[#E45718]">{counts.pending}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Deferred</div><div className="text-[11px] font-extrabold text-[#6B7280]">{counts.deferred}</div></div></div></div>
    <div className="pointer-events-none absolute left-4 bottom-4 z-40 rounded-md border border-[#C9D4DE] bg-white/96 px-3 py-2 shadow-lg text-[9px] font-bold text-[#52606D]"><div className="mb-1 flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-[#8796A5]"><Clock3 className="h-3 w-3" /> CONTROL-CENTRE MAP KEY</div><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#123E73]" />UP</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#087A86]" />DN</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#1769AA]" />Possession</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded border border-[#E45718] bg-[#FFF4E8]" />Job</span><span><i className="mr-1 inline-block h-2 w-7 border-b border-dashed border-[#718294]" />Chainage</span><div className="mt-1 text-[8px] font-normal text-[#8796A5]">Maintenance is displayed at its recorded railway chainage. Train movement constraints remain protected by the planning model.</div></div>
    <div className="absolute right-4 bottom-4 z-40 rounded-md border border-[#C9D4DE] bg-white/96 px-3 py-2 shadow-lg text-[9px] font-semibold text-[#52606D]"><div className="flex items-center gap-2"><TrainFront className="h-3.5 w-3.5 text-[#B42318]" />Train paths: protected operational constraints</div><div className="mt-1 flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#173E6C]" />Stations: fixed corridor reference points</div></div>
    {!loaded && <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#E9EEF2]/55"><div className="rounded-md border border-[#C9D4DE] bg-white px-5 py-3 text-[10px] font-extrabold text-[#52606D] shadow-xl">Loading railway control-centre layers…</div></div>}
    {mapError && <div className="absolute left-4 bottom-24 z-50 max-w-[480px] rounded-md border border-[#F1B6B6] bg-white px-3 py-2 text-[9px] font-semibold text-[#B42318] shadow-lg">{mapError}</div>}
    {inspection && <aside className="absolute bottom-24 right-4 z-[60] w-[350px] rounded-lg border border-[#C9D4DE] bg-white p-3 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#8796A5]">{inspection.type === 'STATION' ? 'RAILWAY STATION' : 'MAINTENANCE ACTIVITY'}</div><div className="mt-0.5 text-sm font-extrabold text-[#173E6C]">{inspection.type === 'STATION' ? `${inspection.data.code} · ${inspection.data.name}` : inspection.data.block_id || inspection.data.job_id}</div></div><button onClick={() => setInspection(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div>{inspection.type === 'STATION' ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">Km {inspection.data.km.toFixed(2)}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Type</div><div className="font-bold">{inspection.data.category}</div></div></div> : <div className="mt-3 space-y-2 text-[10px]"><div className="grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Department</div><div className="font-bold">{inspection.data.department || 'Maintenance'}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Status</div><div className="font-bold">{inspection.data.status}</div></div></div><div className="grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">Km {Number(inspection.data.location_km || 0).toFixed(2)}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Track</div><div className="font-mono font-bold">{inspection.data.track_id || 'PUNE-LNL-UP'}</div></div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Asset / Defect</div><div className="font-bold">{inspection.data.asset_id || '—'} · {inspection.data.defect_type || 'Maintenance'}</div></div><button onClick={() => onOpenExplainability?.(inspection.data)} className="w-full rounded bg-[#173E6C] px-3 py-2 text-[10px] font-extrabold text-white">Open Block Details</button></div>}</aside>}
  </div>;
  return isFullScreenMode && typeof document !== 'undefined' ? createPortal(shell, document.body) : shell;
}
