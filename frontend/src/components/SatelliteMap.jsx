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

function fallbackRailwayGeoJSON() {
  const up = PUNE_LNL_STATIONS.map((s) => [s.lng, s.lat]);
  const dn = PUNE_LNL_STATIONS.map((s) => [s.lng + 0.00018, s.lat + 0.00012]);
  return { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { section_id: 'PUNE-LNL', track_id: 'PUNE-LNL-UP', direction: 'UP', source: 'station-alignment-fallback' }, geometry: { type: 'LineString', coordinates: up } },
    { type: 'Feature', properties: { section_id: 'PUNE-LNL', track_id: 'PUNE-LNL-DN', direction: 'DN', source: 'station-alignment-fallback' }, geometry: { type: 'LineString', coordinates: dn } },
  ] };
}

function possessionFeature(block) {
  const details = block.jobs_detail || [];
  const kms = details.map((j) => Number(j.location_km)).filter(Number.isFinite);
  const center = Number(block.location_km);
  const anchor = kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : (Number.isFinite(center) ? center : 210);
  const spread = kms.length > 1 ? Math.max(0.12, Math.min(0.55, (Math.max(...kms) - Math.min(...kms)) / 2 + 0.08)) : 0.18;
  const departments = departmentsOf(block);
  const status = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
  const trackId = block.track_id || details[0]?.track_id || 'PUNE-LNL-UP';
  return { type: 'Feature', properties: { entity_id: block.block_id, entity_type: 'BLOCK', block_id: block.block_id, color: status === 'DEFERRED' ? COLORS.Deferred : colorOf(departments), status, department: departments.join(' + '), job_count: details.length }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(anchor - spread, trackId), getCoordinatesForKm(anchor + spread, trackId)] } };
}

function jobFeature(job, status = 'PENDING') {
  const km = Number(job.location_km);
  if (!Number.isFinite(km)) return null;
  const trackId = job.track_id || 'PUNE-LNL-UP';
  const departments = departmentsOf(job);
  const halfLength = Math.max(0.10, Math.min(0.30, Number(job.duration_hours || job.duration || 1) * 0.08));
  return { type: 'Feature', properties: { entity_id: job.job_id, entity_type: 'JOB', job_id: job.job_id, color: status === 'DEFERRED' ? COLORS.Deferred : COLORS.Pending, status, department: departments.join(' + '), location_km: km, defect_type: job.defect_type || job.maintenance_type || 'Maintenance' }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(km - halfLength, trackId), getCoordinatesForKm(km + halfLength, trackId)] } };
}

function activityLabel(feature) {
  return feature?.properties?.entity_type === 'BLOCK' ? feature.properties.block_id : feature?.properties?.job_id;
}

export default function SatelliteMap({ blocks = [], jobs = [], selectedBlock = null, onSelectBlock, onOpenExplainability, isFullScreenMode = false, onToggleFullScreen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const stationLabelRefs = useRef([]);
  const activityLabelRefs = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [dept, setDept] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [inspection, setInspection] = useState(null);

  const scheduledJobIds = useMemo(() => new Set(blocks.flatMap((b) => b.job_ids || [])), [blocks]);
  const activityFeatures = useMemo(() => {
    const blockFeatures = blocks.filter((block) => {
      const departments = departmentsOf(block);
      if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return false;
      if (dept === 'Shared' && departments.length < 2) return false;
      const blockStatus = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
      if (status !== 'ALL' && status !== blockStatus) return false;
      const haystack = `${block.block_id || ''} ${(block.job_ids || []).join(' ')} ${(block.jobs_detail || []).map((j) => `${j.asset_id || ''} ${j.defect_type || ''} ${j.location_km || ''}`).join(' ')}`.toLowerCase();
      return !query || haystack.includes(query.toLowerCase());
    }).map(possessionFeature);

    const jobFeatures = jobs.filter((job) => !scheduledJobIds.has(job.job_id)).map((job) => {
      const jobStatus = job.status === 'DEFERRED' ? 'DEFERRED' : 'PENDING';
      const departments = departmentsOf(job);
      if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return null;
      if (dept === 'Shared' && departments.length < 2) return null;
      if (status !== 'ALL' && status !== jobStatus) return null;
      const haystack = `${job.job_id || ''} ${job.asset_id || ''} ${job.asset_type || ''} ${job.section_id || ''} ${job.track_id || ''} ${job.defect_type || ''} ${job.location_km || ''}`.toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return null;
      return jobFeature(job, jobStatus);
    }).filter(Boolean);
    return [...blockFeatures, ...jobFeatures];
  }, [blocks, jobs, scheduledJobIds, dept, status, query]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }] },
      center: [73.64, 18.65], zoom: 10.45, minZoom: 10.25, maxZoom: 18, maxBounds: MAP_BOUNDS, maxBoundsViscosity: 1, renderWorldCopies: false, attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

    const updateStationLabels = () => stationLabelRefs.current.forEach(({ el, station }) => {
      if (!el || !map.isStyleLoaded()) return;
      const point = map.project([station.lng, station.lat]);
      el.style.transform = `translate(${point.x}px, ${point.y + 8}px) translate(-50%, 0)`;
    });
    const clearActivityLabels = () => { activityLabelRefs.current.forEach(({ el }) => el?.remove()); activityLabelRefs.current = []; };
    const updateActivityLabels = () => {
      clearActivityLabels();
      if (!map.isStyleLoaded() || map.getZoom() < 11.7) return;
      activityFeatures.forEach((feature) => {
        const coordinates = feature.geometry.coordinates;
        const midpoint = coordinates[Math.floor(coordinates.length / 2)];
        const point = map.project(midpoint);
        const el = document.createElement('button');
        el.type = 'button';
        el.textContent = activityLabel(feature);
        el.title = feature.properties?.defect_type || feature.properties?.department || 'Maintenance activity';
        el.style.cssText = `position:absolute;left:0;top:0;z-index:7;pointer-events:auto;transform:translate(${point.x}px,${point.y - 18}px) translate(-50%,-50%);background:#FFFFFF;border:1px solid ${feature.properties.color};border-radius:3px;padding:2px 4px;font:700 8px/11px Arial,sans-serif;color:#1F2933;box-shadow:0 1px 3px rgba(0,0,0,.18);white-space:nowrap;`;
        el.addEventListener('click', () => setInspection({ type: 'ACTIVITY', data: feature.properties }));
        map.getCanvasContainer().appendChild(el);
        activityLabelRefs.current.push({ el });
      });
    };

    map.once('load', async () => {
      try {
        const initialRailway = fallbackRailwayGeoJSON();
        map.addSource('mars-railway', { type: 'geojson', data: initialRailway });
        map.addLayer({ id: 'mars-railway-casing', type: 'line', source: 'mars-railway', paint: { 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': 0.98 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'mars-railway-up', type: 'line', source: 'mars-railway', filter: ['==', ['get', 'track_id'], 'PUNE-LNL-UP'], paint: { 'line-color': '#173E6C', 'line-width': ['interpolate', ['linear'], ['zoom'], 10.25, 3.2, 13, 4.2, 18, 6], 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'mars-railway-dn', type: 'line', source: 'mars-railway', filter: ['==', ['get', 'track_id'], 'PUNE-LNL-DN'], paint: { 'line-color': '#2F6F7E', 'line-width': ['interpolate', ['linear'], ['zoom'], 10.25, 2.8, 13, 3.8, 18, 5.5], 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

        const stations = { type: 'FeatureCollection', features: PUNE_LNL_STATIONS.map((s) => ({ type: 'Feature', properties: { code: s.code, name: s.name, km: s.km }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })) };
        map.addSource('real-stations', { type: 'geojson', data: stations });
        map.addLayer({ id: 'station-halo', type: 'circle', source: 'real-stations', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.25, 5, 14, 7, 18, 9], 'circle-color': '#FFFFFF', 'circle-stroke-color': '#173E6C', 'circle-stroke-width': 2.5 } });
        map.addLayer({ id: 'station-core', type: 'circle', source: 'real-stations', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.25, 2.2, 14, 3.2, 18, 4.2], 'circle-color': '#173E6C' } });

        map.addSource('maintenance-possessions', { type: 'geojson', data: { type: 'FeatureCollection', features: activityFeatures } });
        map.addLayer({ id: 'maintenance-casing', type: 'line', source: 'maintenance-possessions', paint: { 'line-color': '#FFFFFF', 'line-width': 13, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-scheduled', type: 'line', source: 'maintenance-possessions', filter: ['==', ['get', 'status'], 'SCHEDULED'], paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10.25, 5, 13, 7, 18, 10], 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-deferred', type: 'line', source: 'maintenance-possessions', filter: ['==', ['get', 'status'], 'DEFERRED'], paint: { 'line-color': COLORS.Deferred, 'line-width': 7, 'line-opacity': 0.9, 'line-dasharray': [1.2, 1.8] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-pending', type: 'line', source: 'maintenance-possessions', filter: ['==', ['get', 'status'], 'PENDING'], paint: { 'line-color': COLORS.Pending, 'line-width': 6, 'line-opacity': 0.95, 'line-dasharray': [0.6, 1.4] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

        stationLabelRefs.current = PUNE_LNL_STATIONS.map((station) => {
          const el = document.createElement('button');
          el.className = 'mars-station-label'; el.type = 'button'; el.textContent = station.code;
          el.title = `${station.name} • ${station.km.toFixed(2)} km`;
          el.style.cssText = 'position:absolute;left:0;top:0;z-index:5;pointer-events:auto;white-space:nowrap;transform-origin:top center;background:rgba(255,255,255,.96);border:1px solid #B8C6D3;border-radius:3px;padding:2px 4px;font:700 9px/12px Arial,sans-serif;color:#173E6C;box-shadow:0 1px 2px rgba(0,0,0,.14);cursor:pointer;';
          el.addEventListener('click', () => setInspection({ type: 'STATION', data: station }));
          map.getCanvasContainer().appendChild(el);
          return { el, station };
        });
        updateStationLabels();
        updateActivityLabels();
        map.on('move', () => { updateStationLabels(); updateActivityLabels(); });
        map.on('resize', () => { updateStationLabels(); updateActivityLabels(); });
        map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 80, right: 90, bottom: 80, left: 90 }, duration: 0 });
        requestAnimationFrame(() => map.resize());
        setLoaded(true);

        try {
          const response = await fetch('/geojson/pune_lonavala_railways.geojson', { cache: 'no-store' });
          if (!response.ok) throw new Error(`Railway geometry HTTP ${response.status}`);
          const railway = await response.json();
          if (railway?.features?.length) {
            map.getSource('mars-railway')?.setData(railway);
            const loopFeatures = railway.features.filter((f) => String(f.properties?.track_id || '').includes('LOOP') || String(f.properties?.track_id || '').includes('YARD'));
            if (loopFeatures.length && !map.getSource('mars-loops')) {
              map.addSource('mars-loops', { type: 'geojson', data: { type: 'FeatureCollection', features: loopFeatures } });
              map.addLayer({ id: 'mars-loops', type: 'line', source: 'mars-loops', paint: { 'line-color': '#52606D', 'line-width': 2.2, 'line-dasharray': [2, 2], 'line-opacity': 0.85 } });
            }
          }
          setMapError(null);
        } catch (error) {
          console.warn('Detailed railway geometry unavailable; operational station-alignment route retained.', error);
          setMapError('Detailed railway geometry unavailable — operational corridor alignment is shown.');
        }
      } catch (error) {
        console.error('Corridor overlay initialization failed:', error);
        setMapError(error?.message || 'Railway overlay could not be initialized.');
      } finally { setLoaded(true); }
    });

    const resize = () => map.resize();
    window.addEventListener('resize', resize);
    map.on('error', (event) => { if (event?.error) console.error('MARS map error:', event.error); });
    return () => {
      stationLabelRefs.current.forEach(({ el }) => el?.remove());
      activityLabelRefs.current.forEach(({ el }) => el?.remove());
      stationLabelRefs.current = []; activityLabelRefs.current = [];
      window.removeEventListener('resize', resize);
      map.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current; const source = map?.getSource('maintenance-possessions');
    if (source) source.setData({ type: 'FeatureCollection', features: activityFeatures });
    const refreshLabels = () => {
      if (!map) return;
      activityLabelRefs.current.forEach(({ el }) => el?.remove()); activityLabelRefs.current = [];
      if (map.isStyleLoaded() && map.getZoom() >= 11.7) {
        activityFeatures.forEach((feature) => {
          const coords = feature.geometry.coordinates; const p = map.project(coords[Math.floor(coords.length / 2)]);
          const el = document.createElement('button'); el.type = 'button'; el.textContent = activityLabel(feature);
          el.style.cssText = `position:absolute;left:0;top:0;z-index:7;pointer-events:auto;transform:translate(${p.x}px,${p.y - 18}px) translate(-50%,-50%);background:#FFFFFF;border:1px solid ${feature.properties.color};border-radius:3px;padding:2px 4px;font:700 8px/11px Arial,sans-serif;color:#1F2933;box-shadow:0 1px 3px rgba(0,0,0,.18);white-space:nowrap;`;
          el.addEventListener('click', () => setInspection({ type: 'ACTIVITY', data: feature.properties }));
          map.getCanvasContainer().appendChild(el); activityLabelRefs.current.push({ el });
        });
      }
    };
    requestAnimationFrame(refreshLabels);
  }, [activityFeatures]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return undefined;
    const refresh = () => map.resize();
    requestAnimationFrame(refresh); const timer = setTimeout(refresh, 150); const timer2 = setTimeout(refresh, 500);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, [isFullScreenMode]);

  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 80, right: 90, bottom: 80, left: 90 }, duration: 450 });
  const mapShell = (
    <div className={`relative overflow-hidden border border-[#C8D2DC] bg-[#DCE5E9] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[2147483000] h-screen w-screen rounded-none' : 'h-[calc(100vh-245px)] min-h-[620px] rounded-lg'}`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md"><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8796A5]">Central Railway • Pune Division</div><div className="text-sm font-bold text-[#173E6C]">Pune–Lonavala Corridor</div><div className="text-[10px] font-mono text-[#52606D]">Km 191.0 → 254.84 • Double Line • 25 kV AC</div></div>
      <div className="absolute left-4 top-[92px] z-20 flex flex-wrap gap-1 rounded-md border border-[#D6DEE6] bg-white/95 p-1.5 shadow-md">{['ALL', 'Engineering', 'S&T', 'Traction', 'Shared'].map((item) => <button key={item} onClick={() => setDept(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${dept === item ? 'bg-[#1E3A5F] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}<span className="mx-0.5 w-px bg-[#D6DEE6]" />{['ALL', 'SCHEDULED', 'DEFERRED', 'PENDING'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${status === item ? 'bg-[#2F6F7E] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}</div>
      <div className="absolute left-4 top-[138px] z-20 w-[290px]"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter maintenance by job, asset, defect or km" className="h-9 w-full rounded-md border border-[#D6DEE6] bg-white/95 pl-8 pr-8 text-[10px] font-mono shadow-md outline-none focus:border-[#1E3A5F]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div></div>
      <div className="absolute right-4 top-4 z-20 flex gap-2"><button onClick={resetView} className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md"><LocateFixed className="h-3.5 w-3.5" />Reset View</button><button onClick={onToggleFullScreen} className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md"><Maximize2 className="h-3.5 w-3.5" />{isFullScreenMode ? 'Exit' : 'Full Screen'}</button></div>
      <div className="absolute right-4 bottom-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md text-[9px] font-semibold text-[#52606D]"><div className="flex items-center gap-2"><TrainFront className="h-3.5 w-3.5 text-[#B42318]" />Protected train paths are fixed operational constraints</div><div className="mt-1 flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#173E6C]" />Station markers are fixed to the railway corridor</div></div>
      {!loaded && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#E9EEF2]/60"><div className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 text-[10px] font-bold text-[#52606D] shadow">Loading operational railway map…</div></div>}
      {mapError && <div className="absolute left-4 bottom-20 z-30 max-w-[460px] rounded-md border border-[#F1B6B6] bg-white px-3 py-2 text-[9px] font-semibold text-[#C92A2A] shadow-lg">{mapError}</div>}
      {inspection && <aside className="absolute bottom-20 right-4 z-40 w-[330px] rounded-lg border border-[#D6DEE6] bg-white p-3 shadow-xl"><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8796A5]">{inspection.type === 'STATION' ? 'Railway Station' : 'Maintenance Activity'}</div><div className="text-sm font-bold text-[#173E6C]">{inspection.type === 'STATION' ? inspection.data.name : inspection.data.block_id || inspection.data.job_id}</div></div><button onClick={() => setInspection(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div>{inspection.type === 'STATION' ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Code</div><div className="font-bold">{inspection.data.code}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">{inspection.data.km.toFixed(2)} km</div></div></div> : <div className="mt-3 space-y-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Department</div><div className="font-bold">{inspection.data.department || 'Maintenance'}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Status</div><div className="font-bold">{inspection.data.status || 'PENDING'}</div></div><button onClick={() => onOpenExplainability?.(inspection.data)} className="w-full rounded bg-[#1E3A5F] px-3 py-2 text-[10px] font-bold text-white">Open Block Details</button></div>}</aside>}
      <div className="absolute bottom-4 left-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md text-[9px] font-semibold text-[#52606D]"><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#173E6C]" />UP track</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#2F6F7E]" />DN track</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#3B6EA5]" />Engineering</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#2F8F6B]" />S&T</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#C9842A]" />Traction</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#6B5B95]" />Shared</span><span><i className="mr-1 inline-block h-2 w-5 rounded border border-[#D97706] bg-white" />Pending</span><div className="mt-1 text-[8px] font-normal text-[#8796A5]">Railway route remains visible even if detailed GeoJSON is unavailable. Maintenance is located along the corridor — never as arbitrary pins.</div></div>
    </div>
  );

  return isFullScreenMode && typeof document !== 'undefined' ? createPortal(mapShell, document.body) : mapShell;
}
