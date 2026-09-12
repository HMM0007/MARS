import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Maximize2, Search, X, MapPinned, TrainFront, ShieldCheck, Activity, Clock3 } from 'lucide-react';
import { PUNE_LNL_STATIONS, getCoordinatesForKm } from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.397, 18.515], [73.887, 18.775]];
const MAP_BOUNDS = [[73.36, 18.48], [73.93, 18.82]];
const MIN_KM = 191;
const MAX_KM = 254.84;
const COLORS = { Engineering: '#1769AA', 'S&T': '#12805C', Traction: '#C46A12', Shared: '#66539A', Deferred: '#6B7280', Pending: '#E45718' };

const jobKey = (id) => String(id ?? '').trim();
const clampKm = (km) => Math.max(MIN_KM, Math.min(MAX_KM, Number(km)));
const departmentsOf = (item) => {
  const list = item?.departments || item?.jobs_detail?.map((j) => j.department) || (item?.department ? [item.department] : []);
  return [...new Set((Array.isArray(list) ? list : [list]).filter(Boolean))];
};
const departmentColor = (departments) => departments.length > 1 ? COLORS.Shared : (COLORS[departments[0]] || COLORS.Engineering);
const normaliseStatus = (job, scheduledIds) => job?.status === 'DEFERRED' ? 'DEFERRED' : job?.status === 'COMPLETED' ? 'COMPLETED' : scheduledIds.has(jobKey(job?.job_id)) ? 'SCHEDULED' : 'PENDING';
const safeCoord = (km, trackId) => {
  const p = getCoordinatesForKm(clampKm(km), trackId || 'PUNE-LNL-UP');
  return Array.isArray(p) && p.length >= 2 ? p : [73.64, 18.65];
};

function blockJobs(block, jobsById) {
  const direct = Array.isArray(block?.jobs_detail) ? block.jobs_detail : [];
  const ids = Array.isArray(block?.job_ids) ? block.job_ids : [];
  const resolved = [...direct, ...ids.map((id) => jobsById.get(jobKey(id))).filter(Boolean)];
  const seen = new Set();
  return resolved.filter((job) => { const id = jobKey(job?.job_id); if (!id || seen.has(id)) return false; seen.add(id); return true; });
}

function makeBlockFeature(block, jobsById) {
  const details = blockJobs(block, jobsById);
  const kms = details.map((j) => Number(j?.location_km)).filter(Number.isFinite);
  const ownKm = Number(block?.location_km);
  const anchor = kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : ownKm;
  if (!Number.isFinite(anchor)) return null;
  const start = kms.length ? Math.min(...kms) : anchor - 0.25;
  const end = kms.length ? Math.max(...kms) : anchor + 0.25;
  const trackId = block?.track_id || details.find((j) => j?.track_id)?.track_id || 'PUNE-LNL-UP';
  const departments = departmentsOf(block).length ? departmentsOf(block) : departmentsOf(details[0]);
  const status = block?.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
  return { type: 'Feature', properties: { entity_type: 'BLOCK', block_id: block?.block_id || 'BLOCK', track_id: trackId, department: departments.join(' + '), status, color: status === 'DEFERRED' ? COLORS.Deferred : departmentColor(departments), location_km: anchor, start_km: clampKm(start), end_km: clampKm(end), job_count: details.length || (Array.isArray(block?.job_ids) ? block.job_ids.length : 0), job_ids: Array.isArray(block?.job_ids) ? block.job_ids : details.map((j) => j.job_id), start_time: block?.start_time || block?.planned_start || block?.possession_start || '', end_time: block?.end_time || block?.planned_end || block?.possession_end || '' }, geometry: { type: 'LineString', coordinates: [safeCoord(start, trackId), safeCoord(end, trackId)] } };
}

function makeJobFeature(job, scheduledIds) {
  const km = Number(job?.location_km);
  if (!Number.isFinite(km)) return null;
  const id = jobKey(job?.job_id) || 'JOB';
  const status = normaliseStatus(job, scheduledIds);
  const trackId = job?.track_id || 'PUNE-LNL-UP';
  const departments = departmentsOf(job);
  const color = status === 'DEFERRED' ? COLORS.Deferred : status === 'PENDING' ? COLORS.Pending : departmentColor(departments);
  return { type: 'Feature', properties: { entity_type: 'JOB', job_id: id, track_id: trackId, department: departments.join(' + '), status, color, location_km: km, section_id: job?.section_id || 'PUNE-LNL', defect_type: job?.defect_type || job?.maintenance_type || 'Maintenance', asset_id: job?.asset_id || '', asset_type: job?.asset_type || '', criticality: job?.criticality_level || job?.criticality || '', due_date: job?.due_date || '', duration_hours: job?.estimated_duration_hours ?? '', work_type: job?.work_type || '', power_block_required: Boolean(job?.power_block_required) }, geometry: { type: 'LineString', coordinates: [safeCoord(km - 0.10, trackId), safeCoord(km + 0.10, trackId)] } };
}

export default function SatelliteMap({ blocks = [], jobs = [], onOpenExplainability, isFullScreenMode = false, onToggleFullScreen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const jobMarkersRef = useRef([]);
  // The map itself must never be blocked by external raster-tile timing.
  const [loaded, setLoaded] = useState(true);
  const [mapError, setMapError] = useState(null);
  const [dept, setDept] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [inspection, setInspection] = useState(null);

  const jobsById = useMemo(() => new Map(jobs.map((j) => [jobKey(j?.job_id), j])), [jobs]);
  const scheduledIds = useMemo(() => new Set(blocks.flatMap((b) => Array.isArray(b?.job_ids) ? b.job_ids : []).map(jobKey).filter(Boolean)), [blocks]);
  const features = useMemo(() => {
    const matches = (p) => {
      const departments = p.department ? p.department.split(' + ') : [];
      if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return false;
      if (dept === 'Shared' && departments.length < 2) return false;
      if (status !== 'ALL' && p.status !== status) return false;
      const text = `${p.job_id || ''} ${p.block_id || ''} ${p.asset_id || ''} ${p.asset_type || ''} ${p.defect_type || ''} ${p.track_id || ''} ${p.location_km || ''}`.toLowerCase();
      return !query || text.includes(query.toLowerCase());
    };
    return [...blocks.map((b) => makeBlockFeature(b, jobsById)).filter(Boolean), ...jobs.map((j) => makeJobFeature(j, scheduledIds)).filter(Boolean)].filter((f) => matches(f.properties));
  }, [blocks, jobs, jobsById, scheduledIds, dept, status, query]);

  const counts = useMemo(() => ({ jobs: jobs.length, blocks: blocks.length, scheduled: jobs.filter((j) => scheduledIds.has(jobKey(j?.job_id))).length, pending: jobs.filter((j) => !scheduledIds.has(jobKey(j?.job_id)) && j?.status !== 'DEFERRED' && j?.status !== 'COMPLETED').length, deferred: jobs.filter((j) => j?.status === 'DEFERRED').length, critical: jobs.filter((j) => (j?.criticality_level || j?.criticality) === 'CRITICAL').length }), [jobs, blocks, scheduledIds]);

  const clearMarkers = (ref) => { ref.current.forEach((m) => m.remove()); ref.current = []; };

  const renderStations = () => {
    const map = mapRef.current; if (!map) return;
    clearMarkers(stationMarkersRef);
    stationMarkersRef.current = (PUNE_LNL_STATIONS || []).map((station, index) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.title = `${station.name} • ${station.code} • Km ${Number(station.km).toFixed(2)}`;
      el.setAttribute('aria-label', `${station.name}, ${station.code}, Km ${Number(station.km).toFixed(2)}`);
      el.style.cssText = 'display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.97);border:1px solid #6B7F91;border-radius:5px;padding:3px 6px 3px 4px;color:#123E73;font:800 10px/12px Arial,sans-serif;box-shadow:0 2px 7px rgba(0,0,0,.32);white-space:nowrap;cursor:pointer;pointer-events:auto;z-index:25;';
      const dot = document.createElement('span');
      dot.textContent = '●';
      dot.style.cssText = 'display:inline-block;color:#B42318;font-size:10px;line-height:10px;';
      const label = document.createElement('span');
      label.textContent = `${station.code} · ${station.name}`;
      el.append(dot, label);
      el.onclick = () => setInspection({ type: 'STATION', data: station });
      const xOffset = index % 2 === 0 ? -10 : 10;
      return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [xOffset, -2] }).setLngLat([station.lng, station.lat]).addTo(map);
    });
  };

  const renderJobs = () => {
    const map = mapRef.current; if (!map) return;
    clearMarkers(jobMarkersRef);
    const visibleJobs = features.filter((f) => f.properties.entity_type === 'JOB');
    visibleJobs.forEach((feature, index) => {
      const p = feature.properties; const point = safeCoord(p.location_km, p.track_id); const critical = p.criticality === 'CRITICAL';
      const el = document.createElement('button'); el.type = 'button'; el.textContent = p.job_id; el.title = `${p.job_id} • ${p.department || 'Maintenance'} • Km ${Number(p.location_km).toFixed(2)} • ${p.defect_type}`;
      const bg = p.status === 'PENDING' ? '#fff4e8' : p.status === 'DEFERRED' ? '#f3f4f6' : '#eef7ff'; const fg = p.status === 'PENDING' ? '#9a3412' : p.status === 'DEFERRED' ? '#4b5563' : '#12528a';
      el.style.cssText = `background:${bg};border:2px solid ${p.color};border-radius:4px;padding:3px 5px;color:${fg};font:900 9px/11px Arial,sans-serif;box-shadow:${critical ? '0 0 0 2px #b42318,' : ''}0 2px 6px rgba(0,0,0,.28);white-space:nowrap;cursor:pointer;`;
      el.onclick = () => setInspection({ type: 'ACTIVITY', data: p });
      jobMarkersRef.current.push(new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [((index % 3) - 1) * 8, -5] }).setLngLat(point).addTo(map));
    });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    let map;
    let disposed = false;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' },
            // No fabricated fallback line: the highlighted corridor comes only from the real PUNE-LNL geometry.
            railway: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            maintenance: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          },
          layers: [
            { id: 'osm-base', type: 'raster', source: 'osm' },
            // Broad corridor casing keeps the real alignment visible at control-centre zoom levels.
            { id: 'rail-route-halo', type: 'line', source: 'railway', minzoom: 8.5, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, 6, 11, 8, 14, 11, 18, 14], 'line-opacity': 0.96, 'line-blur': 0.25 } },
            { id: 'rail-route-up', type: 'line', source: 'railway', minzoom: 8.5, filter: ['==', ['get', 'direction'], 'UP'], paint: { 'line-color': '#0B4F8A', 'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, 2.7, 11, 3.2, 14, 4.4, 18, 6.2], 'line-opacity': 0.98, 'line-cap': 'round', 'line-join': 'round' } },
            { id: 'rail-route-dn', type: 'line', source: 'railway', minzoom: 8.5, filter: ['==', ['get', 'direction'], 'DN'], paint: { 'line-color': '#00838F', 'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, 2.7, 11, 3.2, 14, 4.4, 18, 6.2], 'line-opacity': 0.98, 'line-cap': 'round', 'line-join': 'round' } },
            { id: 'rail-route-inner-up', type: 'line', source: 'railway', minzoom: 13, filter: ['==', ['get', 'direction'], 'UP'], paint: { 'line-color': '#8FC4E8', 'line-width': 1, 'line-opacity': 0.95, 'line-cap': 'round' } },
            { id: 'rail-route-inner-dn', type: 'line', source: 'railway', minzoom: 13, filter: ['==', ['get', 'direction'], 'DN'], paint: { 'line-color': '#8AD8DC', 'line-width': 1, 'line-opacity': 0.95, 'line-cap': 'round' } },
            { id: 'block-casing', type: 'line', source: 'maintenance', minzoom: 9, filter: ['==', ['get', 'entity_type'], 'BLOCK'], paint: { 'line-color': '#FFFFFF', 'line-width': 11, 'line-opacity': 0.96 } },
            { id: 'block-line', type: 'line', source: 'maintenance', minzoom: 9, filter: ['==', ['get', 'entity_type'], 'BLOCK'], paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.98 } },
            { id: 'job-casing', type: 'line', source: 'maintenance', minzoom: 9, filter: ['==', ['get', 'entity_type'], 'JOB'], paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.96 } },
            { id: 'job-line', type: 'line', source: 'maintenance', minzoom: 9, filter: ['==', ['get', 'entity_type'], 'JOB'], paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': 1 } },
          ],
        },
        center: [73.64, 18.65], zoom: 10.45, minZoom: 10.25, maxZoom: 18, maxBounds: MAP_BOUNDS, maxBoundsViscosity: 1, renderWorldCopies: false, attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

      // style.load is independent of external OSM raster-tile completion. This prevents the map UI
      // from getting stuck behind a loading overlay while still using the real railway geometry.
      const initializeRailwayLayers = () => {
        if (disposed) return;
        try {
          map.getSource('maintenance')?.setData({ type: 'FeatureCollection', features });
          renderStations();
          renderJobs();
          map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 96, right: 100, bottom: 96, left: 100 }, duration: 0 });
        } catch (error) {
          console.error('Railway corridor layer rendering failed:', error);
          setMapError(error?.message || 'Railway corridor layers could not be rendered.');
        }

        fetch('/geojson/pune_lonavala_railways.geojson', { cache: 'no-store' })
          .then((response) => { if (!response.ok) throw new Error(`Railway geometry HTTP ${response.status}`); return response.json(); })
          .then((data) => {
            if (disposed) return;
            const candidates = (data?.features || []).filter((f) => f?.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length > 1 && f.properties?.section_id === 'PUNE-LNL');
            const directions = new Set(candidates.map((f) => String(f.properties?.direction || '').toUpperCase()));
            if (!directions.has('UP') || !directions.has('DN')) throw new Error('PUNE-LNL UP/DN route geometry not found');
            const route = candidates
              .filter((f) => ['UP', 'DN'].includes(String(f.properties?.direction || '').toUpperCase()))
              .map((f) => ({ ...f, properties: { ...(f.properties || {}), direction: String(f.properties.direction).toUpperCase() } }));
            if (route.length < 2) throw new Error('PUNE-LNL double-line geometry is incomplete');
            map.getSource('railway')?.setData({ type: 'FeatureCollection', features: route });
          })
          .catch((error) => {
            console.error('Authoritative PUNE-LNL railway geometry could not be loaded:', error);
            setMapError('Authoritative Pune–Lonavala railway geometry could not be loaded. The map remains available without a fabricated route.');
          });
      };

      if (map.isStyleLoaded()) initializeRailwayLayers();
      else map.once('style.load', initializeRailwayLayers);
    
      map.on('error', (event) => { if (event?.error?.message) console.warn('MapLibre:', event.error.message); });
    } catch (error) {
      console.error('Corridor map initialization failed:', error);
      setMapError(error?.message || 'Railway map could not be initialized.');
      setLoaded(true);
    }

    const resize = () => map?.resize();
    window.addEventListener('resize', resize);
    return () => { disposed = true; clearMarkers(stationMarkersRef); clearMarkers(jobMarkersRef); map?.remove(); mapRef.current = null; window.removeEventListener('resize', resize); };
  }, []);

  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    try {
      map.getSource('maintenance')?.setData({ type: 'FeatureCollection', features });
      renderJobs();
    } catch (error) {
      console.warn('Maintenance layer update failed:', error);
    }
  }, [features]);

  useEffect(() => { const map = mapRef.current; if (!map) return; requestAnimationFrame(() => map.resize()); }, [isFullScreenMode]);

  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 96, right: 100, bottom: 96, left: 100 }, duration: 400 });
  const shell = <div className={`relative overflow-hidden border border-[#B9C6D1] bg-[#DDE5E9] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[2147483000] h-screen w-screen rounded-none' : 'h-[calc(100vh-245px)] min-h-[620px] rounded-lg'}`}>
    <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    <div className="pointer-events-none absolute left-4 top-4 z-40 rounded-md border border-[#C9D4DE] bg-white/96 px-3 py-2 shadow-lg"><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#68798A]"><ShieldCheck className="h-3 w-3 text-[#12805C]" /> CENTRAL RAILWAY • PUNE DIVISION</div><div className="mt-0.5 text-sm font-extrabold text-[#123E73]">PUNE–LONAVALA OPERATIONAL CORRIDOR</div><div className="mt-0.5 text-[9px] font-mono text-[#52606D]">Km 191.00 → 254.84 • DOUBLE LINE • 25 kV AC</div></div>
    <div className="absolute left-4 top-[94px] z-40 flex max-w-[720px] flex-wrap gap-1 rounded-md border border-[#C9D4DE] bg-white/96 p-1.5 shadow-lg">{['ALL', 'Engineering', 'S&T', 'Traction', 'Shared'].map((item) => <button key={item} onClick={() => setDept(item)} className={`rounded px-2.5 py-1.5 text-[9px] font-extrabold ${dept === item ? 'bg-[#173E6C] text-white' : 'text-[#52606D] hover:bg-[#EDF3F7]'}`}>{item}</button>)}<span className="mx-1 w-px bg-[#CBD5DF]" />{['ALL', 'SCHEDULED', 'DEFERRED', 'PENDING'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded px-2.5 py-1.5 text-[9px] font-extrabold ${status === item ? 'bg-[#087A86] text-white' : 'text-[#52606D] hover:bg-[#EDF3F7]'}`}>{item}</button>)}</div>
    <div className="absolute left-4 top-[140px] z-40 w-[330px]"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job / asset / defect / block / chainage" className="h-9 w-full rounded-md border border-[#C9D4DE] bg-white/96 pl-8 pr-8 text-[10px] font-mono shadow-lg outline-none focus:border-[#173E6C]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div></div>
    <div className="absolute right-4 top-4 z-40 flex gap-2"><button onClick={resetView} className="flex h-9 items-center gap-1.5 rounded-md border border-[#C9D4DE] bg-white px-3 text-[10px] font-extrabold text-[#173E6C] shadow-lg"><LocateFixed className="h-3.5 w-3.5" />Reset</button><button onClick={onToggleFullScreen} className="flex h-9 items-center gap-1.5 rounded-md border border-[#C9D4DE] bg-white px-3 text-[10px] font-extrabold text-[#173E6C] shadow-lg"><Maximize2 className="h-3.5 w-3.5" />{isFullScreenMode ? 'Exit' : 'Full Screen'}</button></div>
    <div className="absolute right-4 top-[94px] z-40 w-[270px] rounded-md border border-[#C9D4DE] bg-[#F8FAFC]/96 p-2 shadow-lg"><div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#52606D]"><Activity className="h-3 w-3 text-[#12805C]" /> LIVE OPERATIONAL LAYERS</div><div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-bold text-[#52606D]"><span><i className="mr-1 inline-block h-2 w-7 rounded bg-[#0B4F8A]" />UP route</span><span><i className="mr-1 inline-block h-2 w-7 rounded bg-[#00838F]" />DN route</span><span><i className="mr-1 inline-block h-2 w-7 rounded bg-[#1769AA]" />Possession</span><span><i className="mr-1 inline-block h-2 w-7 rounded border border-[#E45718] bg-[#FFF4E8]" />Maintenance job</span></div><div className="mt-2 grid grid-cols-3 divide-x border-t border-[#D6DEE6] pt-1.5 text-center"><div><div className="text-[8px] uppercase text-[#8796A5]">Jobs</div><div className="text-sm font-extrabold text-[#173E6C]">{counts.jobs}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Blocks</div><div className="text-sm font-extrabold text-[#12805C]">{counts.blocks}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Critical</div><div className="text-sm font-extrabold text-[#B42318]">{counts.critical}</div></div></div><div className="mt-1 grid grid-cols-3 divide-x border-t border-[#D6DEE6] pt-1.5 text-center"><div><div className="text-[8px] uppercase text-[#8796A5]">Scheduled</div><div className="text-[11px] font-extrabold text-[#1769AA]">{counts.scheduled}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Pending</div><div className="text-[11px] font-extrabold text-[#E45718]">{counts.pending}</div></div><div><div className="text-[8px] uppercase text-[#8796A5]">Deferred</div><div className="text-[11px] font-extrabold text-[#6B7280]">{counts.deferred}</div></div></div></div>
    <div className="pointer-events-none absolute left-4 bottom-4 z-40 rounded-md border border-[#C9D4DE] bg-white/96 px-3 py-2 shadow-lg text-[9px] font-bold text-[#52606D]"><div className="mb-1 flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-[#8796A5]"><Clock3 className="h-3 w-3" /> CONTROL-CENTRE MAP KEY</div><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#0B4F8A]" />UP route</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#00838F]" />DN route</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#1769AA]" />Possession</span><span><i className="mr-1 inline-block h-2 w-7 rounded border border-[#E45718] bg-[#FFF4E8]" />Job</span><div className="mt-1 text-[8px] font-normal text-[#8796A5]">Route highlight follows the authoritative PUNE-LNL railway GeoJSON alignment.</div></div>
    <div className="absolute right-4 bottom-4 z-40 rounded-md border border-[#C9D4DE] bg-white/96 px-3 py-2 shadow-lg text-[9px] font-semibold text-[#52606D]"><div className="flex items-center gap-2"><TrainFront className="h-3.5 w-3.5 text-[#B42318]" />Train paths: protected operational constraints</div><div className="mt-1 flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#173E6C]" />Stations: fixed corridor reference points</div></div>
    {!loaded && <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#E9EEF2]/35"><div className="rounded-md border border-[#C9D4DE] bg-white px-5 py-3 text-[10px] font-extrabold text-[#52606D] shadow-xl">Initializing railway control-centre…</div></div>}
    {mapError && <div className="absolute left-4 bottom-24 z-50 max-w-[480px] rounded-md border border-[#F1B6B6] bg-white px-3 py-2 text-[9px] font-semibold text-[#B42318] shadow-lg">{mapError}</div>}
    {inspection && <aside className="absolute bottom-24 right-4 z-[60] w-[350px] rounded-lg border border-[#C9D4DE] bg-white p-3 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#8796A5]">{inspection.type === 'STATION' ? 'RAILWAY STATION' : 'MAINTENANCE ACTIVITY'}</div><div className="mt-0.5 text-sm font-extrabold text-[#173E6C]">{inspection.type === 'STATION' ? `${inspection.data.code} · ${inspection.data.name}` : inspection.data.block_id || inspection.data.job_id}</div></div><button onClick={() => setInspection(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div>{inspection.type === 'STATION' ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">Km {Number(inspection.data.km).toFixed(2)}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Type</div><div className="font-bold">{inspection.data.category}</div></div></div> : <div className="mt-3 space-y-2 text-[10px]"><div className="grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Department</div><div className="font-bold">{inspection.data.department || 'Maintenance'}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Status</div><div className="font-bold">{inspection.data.status}</div></div></div><div className="grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">Km {Number(inspection.data.location_km || 0).toFixed(2)}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Track</div><div className="font-mono font-bold">{inspection.data.track_id || 'PUNE-LNL-UP'}</div></div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Asset / Defect</div><div className="font-bold">{inspection.data.asset_id || '—'} · {inspection.data.defect_type || 'Maintenance'}</div></div><button onClick={() => onOpenExplainability?.(inspection.data)} className="w-full rounded bg-[#173E6C] px-3 py-2 text-[10px] font-extrabold text-white">Open Block Details</button></div>}</aside>}
  </div>;
  return isFullScreenMode && typeof document !== 'undefined' ? createPortal(shell, document.body) : shell;
}
