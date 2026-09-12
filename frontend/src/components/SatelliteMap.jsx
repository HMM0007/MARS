import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Maximize2, Search, X, MapPinned, TrainFront } from 'lucide-react';
import { PUNE_LNL_STATIONS, getCoordinatesForKm } from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.397, 18.515], [73.887, 18.775]];
const MAP_BOUNDS = [[73.36, 18.48], [73.93, 18.82]];
const COLORS = { Engineering: '#3B6EA5', 'S&T': '#2F8F6B', Traction: '#C9842A', Shared: '#6B5B95', Deferred: '#7B8794', Pending: '#D97706' };
const departmentsOf = (item) => [...new Set((item?.departments || item?.jobs_detail?.map((j) => j.department) || (item?.department ? [item.department] : [])).filter(Boolean))];
const colorOf = (departments) => departments.length > 1 ? COLORS.Shared : (COLORS[departments[0]] || COLORS.Engineering);

function fallbackRailwayGeoJSON() { return { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { track_id: 'PUNE-LNL-UP' }, geometry: { type: 'LineString', coordinates: PUNE_LNL_STATIONS.map((s) => [s.lng, s.lat]) } },
  { type: 'Feature', properties: { track_id: 'PUNE-LNL-DN' }, geometry: { type: 'LineString', coordinates: PUNE_LNL_STATIONS.map((s) => [s.lng + 0.00018, s.lat + 0.00012]) } },
] }; }

function possessionFeature(block) {
  const details = block.jobs_detail || [];
  const kms = details.map((j) => Number(j.location_km)).filter(Number.isFinite);
  const center = Number(block.location_km);
  const anchor = kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : (Number.isFinite(center) ? center : 210);
  const spread = kms.length > 1 ? Math.max(0.12, Math.min(0.55, (Math.max(...kms) - Math.min(...kms)) / 2 + 0.08)) : 0.18;
  const departments = departmentsOf(block);
  const status = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
  const trackId = block.track_id || details[0]?.track_id || 'PUNE-LNL-UP';
  return { type: 'Feature', properties: { entity_type: 'BLOCK', block_id: block.block_id, color: status === 'DEFERRED' ? COLORS.Deferred : colorOf(departments), status, department: departments.join(' + '), job_count: details.length }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(anchor - spread, trackId), getCoordinatesForKm(anchor + spread, trackId)] } };
}
function jobFeature(job) {
  const km = Number(job.location_km); if (!Number.isFinite(km)) return null;
  const departments = departmentsOf(job); const status = job.status === 'DEFERRED' ? 'DEFERRED' : 'PENDING';
  const half = Math.max(0.10, Math.min(0.30, Number(job.duration_hours || job.duration || 1) * 0.08)); const trackId = job.track_id || 'PUNE-LNL-UP';
  return { type: 'Feature', properties: { entity_type: 'JOB', job_id: job.job_id, color: status === 'DEFERRED' ? COLORS.Deferred : COLORS.Pending, status, department: departments.join(' + '), location_km: km, defect_type: job.defect_type || job.maintenance_type || 'Maintenance' }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(km - half, trackId), getCoordinatesForKm(km + half, trackId)] } };
}

export default function SatelliteMap({ blocks = [], jobs = [], onOpenExplainability, isFullScreenMode = false, onToggleFullScreen }) {
  const containerRef = useRef(null), mapRef = useRef(null), overlayRef = useRef(null);
  const railwayRef = useRef(fallbackRailwayGeoJSON().features), stationLabelRefs = useRef([]), activityLabelRefs = useRef([]);
  const [loaded, setLoaded] = useState(false), [mapError, setMapError] = useState(null), [dept, setDept] = useState('ALL'), [status, setStatus] = useState('ALL'), [query, setQuery] = useState(''), [inspection, setInspection] = useState(null);
  const scheduledJobIds = useMemo(() => new Set(blocks.flatMap((b) => b.job_ids || [])), [blocks]);
  const activityFeatures = useMemo(() => {
    const blockFeatures = blocks.filter((block) => {
      const departments = departmentsOf(block); if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return false; if (dept === 'Shared' && departments.length < 2) return false;
      const blockStatus = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED'; if (status !== 'ALL' && status !== blockStatus) return false;
      const text = `${block.block_id || ''} ${(block.job_ids || []).join(' ')} ${(block.jobs_detail || []).map((j) => `${j.asset_id || ''} ${j.defect_type || ''} ${j.location_km || ''}`).join(' ')}`.toLowerCase(); return !query || text.includes(query.toLowerCase());
    }).map(possessionFeature);
    const jobFeatures = jobs.filter((job) => !scheduledJobIds.has(job.job_id)).map((job) => {
      const departments = departmentsOf(job); if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return null; if (dept === 'Shared' && departments.length < 2) return null;
      const jobStatus = job.status === 'DEFERRED' ? 'DEFERRED' : 'PENDING'; if (status !== 'ALL' && status !== jobStatus) return null;
      const text = `${job.job_id || ''} ${job.asset_id || ''} ${job.asset_type || ''} ${job.section_id || ''} ${job.track_id || ''} ${job.defect_type || ''} ${job.location_km || ''}`.toLowerCase(); if (query && !text.includes(query.toLowerCase())) return null;
      return jobFeature(job);
    }).filter(Boolean); return [...blockFeatures, ...jobFeatures];
  }, [blocks, jobs, scheduledJobIds, dept, status, query]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({ container: containerRef.current, style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }] }, center: [73.64, 18.65], zoom: 10.45, minZoom: 10.25, maxZoom: 18, maxBounds: MAP_BOUNDS, maxBoundsViscosity: 1, renderWorldCopies: false, attributionControl: true });
    mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

    const renderOperationalOverlay = () => {
      const svg = overlayRef.current; if (!svg || !map.isStyleLoaded()) return;
      const width = map.getCanvasContainer().clientWidth, height = map.getCanvasContainer().clientHeight;
      svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height)); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const ns = 'http://www.w3.org/2000/svg';
      const addPolyline = (coordinates, stroke, strokeWidth, opacity, dash = '') => {
        const points = coordinates.map(([lng, lat]) => { const p = map.project([lng, lat]); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
        const el = document.createElementNS(ns, 'polyline'); el.setAttribute('points', points); el.setAttribute('fill', 'none'); el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', String(strokeWidth)); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round'); el.setAttribute('opacity', String(opacity)); if (dash) el.setAttribute('stroke-dasharray', dash); svg.appendChild(el);
      };
      railwayRef.current.forEach((feature) => addPolyline(feature.geometry.coordinates, feature.properties?.track_id === 'PUNE-LNL-DN' ? '#2F6F7E' : '#173E6C', 4, 1));
      activityFeatures.forEach((feature) => { const p = feature.geometry.coordinates, c = feature.properties.color; const dash = feature.properties.status === 'PENDING' ? '5 5' : feature.properties.status === 'DEFERRED' ? '3 5' : ''; addPolyline(p, '#FFFFFF', feature.properties.status === 'SCHEDULED' ? 11 : 8, 0.92); addPolyline(p, c, feature.properties.status === 'SCHEDULED' ? 7 : 5, 1, dash); });
      PUNE_LNL_STATIONS.forEach((station) => { const p = map.project([station.lng, station.lat]); const halo = document.createElementNS(ns, 'circle'); halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y); halo.setAttribute('r', '7'); halo.setAttribute('fill', '#FFFFFF'); halo.setAttribute('stroke', '#173E6C'); halo.setAttribute('stroke-width', '2'); svg.appendChild(halo); const core = document.createElementNS(ns, 'circle'); core.setAttribute('cx', p.x); core.setAttribute('cy', p.y); core.setAttribute('r', '3'); core.setAttribute('fill', '#173E6C'); svg.appendChild(core); });
    };
    const updateStationLabels = () => stationLabelRefs.current.forEach(({ el, station }) => { const p = map.project([station.lng, station.lat]); el.style.transform = `translate(${p.x}px,${p.y + 9}px) translate(-50%,0)`; });
    const updateActivityLabels = () => { activityLabelRefs.current.forEach(({ el }) => el.remove()); activityLabelRefs.current = []; if (map.getZoom() < 11.7) return; activityFeatures.forEach((feature) => { const coords = feature.geometry.coordinates, p = map.project(coords[Math.floor(coords.length / 2)]); const el = document.createElement('button'); el.type = 'button'; el.textContent = feature.properties.entity_type === 'BLOCK' ? feature.properties.block_id : feature.properties.job_id; el.style.cssText = `position:absolute;left:0;top:0;z-index:8;pointer-events:auto;transform:translate(${p.x}px,${p.y - 16}px) translate(-50%,-50%);background:#fff;border:1px solid ${feature.properties.color};border-radius:3px;padding:2px 4px;font:700 8px/11px Arial;color:#1F2933;box-shadow:0 1px 3px rgba(0,0,0,.18);white-space:nowrap;`; el.addEventListener('click', () => setInspection({ type: 'ACTIVITY', data: feature.properties })); map.getCanvasContainer().appendChild(el); activityLabelRefs.current.push({ el }); }); };

    map.once('load', async () => {
      try {
        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); overlay.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none;overflow:visible;'; map.getCanvasContainer().appendChild(overlay); overlayRef.current = overlay;
        try { const response = await fetch('/geojson/pune_lonavala_railways.geojson', { cache: 'no-store' }); if (response.ok) { const railway = await response.json(); if (railway?.features?.length) railwayRef.current = railway.features.filter((f) => f.geometry?.type === 'LineString'); } } catch (error) { console.warn('Detailed railway geometry unavailable; fixed corridor alignment retained.', error); }
        stationLabelRefs.current = PUNE_LNL_STATIONS.map((station) => { const el = document.createElement('button'); el.type = 'button'; el.textContent = station.code; el.title = `${station.name} • ${station.km.toFixed(2)} km`; el.style.cssText = 'position:absolute;left:0;top:0;z-index:6;pointer-events:auto;background:rgba(255,255,255,.96);border:1px solid #B8C6D3;border-radius:3px;padding:2px 4px;font:700 9px/12px Arial,sans-serif;color:#173E6C;box-shadow:0 1px 2px rgba(0,0,0,.14);cursor:pointer;white-space:nowrap;'; el.addEventListener('click', () => setInspection({ type: 'STATION', data: station })); map.getCanvasContainer().appendChild(el); return { el, station }; });
        const refreshOverlay = () => { renderOperationalOverlay(); updateStationLabels(); updateActivityLabels(); };
        const handleMove = () => refreshOverlay(); const handleResize = () => refreshOverlay();
        map.on('move', handleMove); map.on('resize', handleResize); map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 80, right: 90, bottom: 80, left: 90 }, duration: 0 }); requestAnimationFrame(refreshOverlay); setLoaded(true); setMapError(null);
      } catch (error) { console.error('Corridor overlay initialization failed:', error); setMapError(error?.message || 'Railway overlay could not be initialized.'); setLoaded(true); }
    });
    const resize = () => map.resize(); window.addEventListener('resize', resize);
    return () => { stationLabelRefs.current.forEach(({ el }) => el.remove()); activityLabelRefs.current.forEach(({ el }) => el.remove()); overlayRef.current?.remove(); stationLabelRefs.current = []; activityLabelRefs.current = []; overlayRef.current = null; window.removeEventListener('resize', resize); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { const map = mapRef.current; if (!map || !overlayRef.current) return; const refresh = () => { const svg = overlayRef.current; if (!svg) return; const w = map.getCanvasContainer().clientWidth, h = map.getCanvasContainer().clientHeight; svg.setAttribute('width', String(w)); svg.setAttribute('height', String(h)); }; requestAnimationFrame(refresh); }, [activityFeatures]);
  useEffect(() => { const map = mapRef.current; if (!map) return undefined; const refresh = () => map.resize(); requestAnimationFrame(refresh); const a = setTimeout(refresh, 150), b = setTimeout(refresh, 500); return () => { clearTimeout(a); clearTimeout(b); }; }, [isFullScreenMode]);

  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 80, right: 90, bottom: 80, left: 90 }, duration: 450 });
  const shell = <div className={`relative overflow-hidden border border-[#C8D2DC] bg-[#DCE5E9] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[2147483000] h-screen w-screen rounded-none' : 'h-[calc(100vh-245px)] min-h-[620px] rounded-lg'}`}>
    <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md"><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8796A5]">Central Railway • Pune Division</div><div className="text-sm font-bold text-[#173E6C]">Pune–Lonavala Corridor</div><div className="text-[10px] font-mono text-[#52606D]">Km 191.0 → 254.84 • Double Line • 25 kV AC</div></div>
    <div className="absolute left-4 top-[92px] z-20 flex flex-wrap gap-1 rounded-md border border-[#D6DEE6] bg-white/95 p-1.5 shadow-md">{['ALL','Engineering','S&T','Traction','Shared'].map((item) => <button key={item} onClick={() => setDept(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${dept === item ? 'bg-[#1E3A5F] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}<span className="mx-0.5 w-px bg-[#D6DEE6]" />{['ALL','SCHEDULED','DEFERRED','PENDING'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${status === item ? 'bg-[#2F6F7E] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}</div>
    <div className="absolute left-4 top-[138px] z-20 w-[290px]"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter maintenance by job, asset, defect or km" className="h-9 w-full rounded-md border border-[#D6DEE6] bg-white/95 pl-8 pr-8 text-[10px] font-mono shadow-md outline-none focus:border-[#1E3A5F]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div></div>
    <div className="absolute right-4 top-4 z-20 flex gap-2"><button onClick={resetView} className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md"><LocateFixed className="h-3.5 w-3.5" />Reset View</button><button onClick={onToggleFullScreen} className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md"><Maximize2 className="h-3.5 w-3.5" />{isFullScreenMode ? 'Exit' : 'Full Screen'}</button></div>
    {!loaded && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#E9EEF2]/60"><div className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 text-[10px] font-bold text-[#52606D] shadow">Loading operational railway map…</div></div>}
    {mapError && <div className="absolute left-4 bottom-20 z-30 max-w-[460px] rounded-md border border-[#F1B6B6] bg-white px-3 py-2 text-[9px] font-semibold text-[#C92A2A] shadow-lg">{mapError}</div>}
    {inspection && <aside className="absolute bottom-20 right-4 z-40 w-[330px] rounded-lg border border-[#D6DEE6] bg-white p-3 shadow-xl"><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8796A5]">{inspection.type === 'STATION' ? 'Railway Station' : 'Maintenance Activity'}</div><div className="text-sm font-bold text-[#173E6C]">{inspection.type === 'STATION' ? inspection.data.name : inspection.data.block_id || inspection.data.job_id}</div></div><button onClick={() => setInspection(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div>{inspection.type === 'STATION' ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Code</div><div className="font-bold">{inspection.data.code}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">{inspection.data.km.toFixed(2)} km</div></div></div> : <div className="mt-3 space-y-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Department</div><div className="font-bold">{inspection.data.department || 'Maintenance'}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Status</div><div className="font-bold">{inspection.data.status || 'PENDING'}</div></div><button onClick={() => onOpenExplainability?.(inspection.data)} className="w-full rounded bg-[#1E3A5F] px-3 py-2 text-[10px] font-bold text-white">Open Block Details</button></div>}</aside>}
    <div className="absolute bottom-4 left-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md text-[9px] font-semibold text-[#52606D]"><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#173E6C]" />UP track</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#2F6F7E]" />DN track</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#3B6EA5]" />Engineering</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#2F8F6B]" />S&T</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#C9842A]" />Traction</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#6B5B95]" />Shared</span><span><i className="mr-1 inline-block h-2 w-5 rounded border border-[#D97706] bg-white" />Pending</span><div className="mt-1 text-[8px] font-normal text-[#8796A5]">Railway route, stations and maintenance are rendered directly over the operational map.</div></div>
    <div className="absolute right-4 bottom-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md text-[9px] font-semibold text-[#52606D]"><div className="flex items-center gap-2"><TrainFront className="h-3.5 w-3.5 text-[#B42318]" />Protected train paths are fixed operational constraints</div><div className="mt-1 flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#173E6C]" />Station markers are fixed to the railway corridor</div></div>
  </div>;
  return isFullScreenMode && typeof document !== 'undefined' ? createPortal(shell, document.body) : shell;
}
