import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Activity, LocateFixed, Maximize2, Search, X, MapPinned, TrainFront, ShieldCheck } from 'lucide-react';
import { PUNE_LNL_STATIONS, getCoordinatesForKm } from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.397, 18.515], [73.887, 18.775]];
const MAP_BOUNDS = [[73.36, 18.48], [73.93, 18.82]];
const RAILWAY_GEOJSON_URL = `${import.meta.env.BASE_URL || '/'}geojson/pune_lonavala_railways.geojson`;
const COLORS = { Engineering: '#2F6EA6', 'S&T': '#14866B', Traction: '#C77918', Shared: '#66539A', Deferred: '#6B7785', Pending: '#E06B18' };

const departmentsOf = (item) => [...new Set((item?.departments || item?.jobs_detail?.map((j) => j.department) || (item?.department ? [item.department] : [])).filter(Boolean))];
const colorOf = (departments) => departments.length > 1 ? COLORS.Shared : (COLORS[departments[0]] || COLORS.Engineering);

function corridorTrackFeatures() {
  return [
    { type: 'Feature', properties: { track_id: 'PUNE-LNL-UP', direction: 'UP' }, geometry: { type: 'LineString', coordinates: PUNE_LNL_STATIONS.map((s) => [s.lng, s.lat]) } },
    { type: 'Feature', properties: { track_id: 'PUNE-LNL-DN', direction: 'DN' }, geometry: { type: 'LineString', coordinates: PUNE_LNL_STATIONS.map((s) => [s.lng + 0.00018, s.lat + 0.00012]) } },
  ];
}

function possessionFeature(block) {
  const details = block.jobs_detail || [];
  const kms = details.map((j) => Number(j.location_km)).filter(Number.isFinite);
  const center = Number(block.location_km);
  const anchor = kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : (Number.isFinite(center) ? center : 210);
  const spread = kms.length > 1 ? Math.max(0.18, Math.min(0.90, (Math.max(...kms) - Math.min(...kms)) / 2 + 0.12)) : 0.28;
  const departments = departmentsOf(block);
  const status = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
  const trackId = block.track_id || details[0]?.track_id || 'PUNE-LNL-UP';
  return { type: 'Feature', properties: { entity_type: 'BLOCK', block_id: block.block_id || 'BLOCK', color: status === 'DEFERRED' ? COLORS.Deferred : colorOf(departments), status, department: departments.join(' + '), job_count: details.length, track_id: trackId, location_km: anchor, start_km: anchor - spread, end_km: anchor + spread }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(anchor - spread, trackId), getCoordinatesForKm(anchor + spread, trackId)] } };
}

function jobFeature(job) {
  const km = Number(job.location_km);
  if (!Number.isFinite(km)) return null;
  const departments = departmentsOf(job);
  const status = job.status === 'DEFERRED' ? 'DEFERRED' : 'PENDING';
  const trackId = job.track_id || 'PUNE-LNL-UP';
  return { type: 'Feature', properties: { entity_type: 'JOB', job_id: job.job_id || 'JOB', color: status === 'DEFERRED' ? COLORS.Deferred : COLORS.Pending, status, department: departments.join(' + '), location_km: km, track_id: trackId, defect_type: job.defect_type || job.maintenance_type || 'Maintenance', asset_id: job.asset_id || '', criticality: job.criticality_level || job.criticality || '' }, geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(km - 0.18, trackId), getCoordinatesForKm(km + 0.18, trackId)] } };
}

export default function SatelliteMap({ blocks = [], jobs = [], onOpenExplainability, isFullScreenMode = false, onToggleFullScreen }) {
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
      const text = `${block.block_id || ''} ${(block.job_ids || []).join(' ')} ${(block.jobs_detail || []).map((j) => `${j.asset_id || ''} ${j.defect_type || ''} ${j.location_km || ''}`).join(' ')}`.toLowerCase();
      return !query || text.includes(query.toLowerCase());
    }).map(possessionFeature);
    const jobFeatures = jobs.filter((job) => !scheduledJobIds.has(job.job_id)).map((job) => {
      const departments = departmentsOf(job);
      if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return null;
      if (dept === 'Shared' && departments.length < 2) return null;
      const jobStatus = job.status === 'DEFERRED' ? 'DEFERRED' : 'PENDING';
      if (status !== 'ALL' && status !== jobStatus) return null;
      const text = `${job.job_id || ''} ${job.asset_id || ''} ${job.asset_type || ''} ${job.section_id || ''} ${job.track_id || ''} ${job.defect_type || ''} ${job.location_km || ''}`.toLowerCase();
      if (query && !text.includes(query.toLowerCase())) return null;
      return jobFeature(job);
    }).filter(Boolean);
    return [...blockFeatures, ...jobFeatures];
  }, [blocks, jobs, scheduledJobIds, dept, status, query]);

  const counts = useMemo(() => ({ blocks: blocks.length, scheduled: blocks.filter((b) => b.status !== 'DEFERRED').length, deferred: blocks.filter((b) => b.status === 'DEFERRED').length, pending: jobs.filter((j) => !scheduledJobIds.has(j.job_id) && j.status !== 'DEFERRED').length, critical: jobs.filter((j) => (j.criticality_level || j.criticality) === 'CRITICAL').length }), [blocks, jobs, scheduledJobIds]);

  const updateStationLabels = () => {
    const map = mapRef.current;
    if (!map) return;
    stationLabelRefs.current.forEach(({ el, station }) => { const p = map.project([station.lng, station.lat]); el.style.transform = `translate(${p.x}px,${p.y - 14}px) translate(-50%,-100%)`; });
  };
  const updateActivityLabels = () => {
    const map = mapRef.current;
    if (!map) return;
    activityLabelRefs.current.forEach(({ el }) => el.remove()); activityLabelRefs.current = [];
    const zoom = map.getZoom();
    if (zoom < 10.45) return;
    activityFeatures.forEach((feature, index) => {
      const coords = feature.geometry.coordinates; const mid = coords[Math.floor(coords.length / 2)]; const p = map.project(mid); const isBlock = feature.properties.entity_type === 'BLOCK'; const critical = !isBlock && feature.properties.criticality === 'CRITICAL';
      const el = document.createElement('button'); el.type = 'button'; el.textContent = isBlock ? `${feature.properties.block_id}  •  ${feature.properties.job_count || 0} JOBS` : feature.properties.job_id; el.title = isBlock ? `${feature.properties.block_id} • ${feature.properties.status} • ${feature.properties.start_km?.toFixed?.(2) || ''}-${feature.properties.end_km?.toFixed?.(2) || ''} km` : `${feature.properties.job_id} • ${feature.properties.defect_type} • Km ${Number(feature.properties.location_km).toFixed(2)}`;
      const offset = (index % 3 - 1) * 18; el.style.cssText = `position:absolute;left:0;top:0;z-index:18;pointer-events:auto;transform:translate(${p.x + offset}px,${p.y - (isBlock ? 20 : 15)}px) translate(-50%,-50%);background:${isBlock ? feature.properties.color : '#FFF7ED'};color:${isBlock ? '#FFFFFF' : '#9A3412'};border:2px solid ${feature.properties.color};border-radius:4px;padding:3px 6px;font:800 ${isBlock ? 8 : 7}px/11px Arial,sans-serif;box-shadow:0 2px 5px rgba(0,0,0,.24);white-space:nowrap;cursor:pointer;${critical ? 'box-shadow:0 0 0 2px #B42318,0 2px 6px rgba(0,0,0,.25);' : ''}`;
      el.addEventListener('click', () => setInspection({ type: 'ACTIVITY', data: feature.properties })); map.getCanvasContainer().appendChild(el); activityLabelRefs.current.push({ el });
    });
  };
  useEffect(() => { const map = mapRef.current; if (!map || !map.isStyleLoaded()) return; const source = map.getSource('operational-activity'); if (source) source.setData({ type: 'FeatureCollection', features: activityFeatures }); requestAnimationFrame(() => updateActivityLabels()); }, [activityFeatures]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({ container: containerRef.current, style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }] }, center: [73.64, 18.65], zoom: 10.45, minZoom: 10.25, maxZoom: 18, maxBounds: MAP_BOUNDS, maxBoundsViscosity: 1, renderWorldCopies: false, attributionControl: true });
    mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');
    const refreshLabels = () => { updateStationLabels(); updateActivityLabels(); };
    const addOperationalLayers = () => {
      map.addSource('railway', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('stations-corridor', { type: 'geojson', data: { type: 'FeatureCollection', features: PUNE_LNL_STATIONS.map((s) => ({ type: 'Feature', properties: { code: s.code, name: s.name, km: s.km }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })) } });
      map.addSource('operational-activity', { type: 'geojson', data: { type: 'FeatureCollection', features: activityFeatures } });
      map.addLayer({ id: 'rail-route-halo', type: 'line', source: 'railway', minzoom: 8.5, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, 6, 11, 7.5, 14, 10, 18, 13], 'line-opacity': 0.94, 'line-blur': 0.25 } });
      map.addLayer({ id: 'rail-route-up', type: 'line', source: 'railway', minzoom: 8.5, filter: ['==', ['get', 'direction'], 'UP'], paint: { 'line-color': '#0B4F8A', 'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, 3, 11, 3.6, 14, 4.8, 18, 6.5], 'line-opacity': 0.98, 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'rail-route-dn', type: 'line', source: 'railway', minzoom: 8.5, filter: ['==', ['get', 'direction'], 'DN'], paint: { 'line-color': '#00838F', 'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, 3, 11, 3.6, 14, 4.8, 18, 6.5], 'line-opacity': 0.98, 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'rail-route-inner-up', type: 'line', source: 'railway', minzoom: 13, filter: ['==', ['get', 'direction'], 'UP'], paint: { 'line-color': '#8FC4E8', 'line-width': 1.1, 'line-opacity': 0.95, 'line-cap': 'round' } });
      map.addLayer({ id: 'rail-route-inner-dn', type: 'line', source: 'railway', minzoom: 13, filter: ['==', ['get', 'direction'], 'DN'], paint: { 'line-color': '#8AD8DC', 'line-width': 1.1, 'line-opacity': 0.95, 'line-cap': 'round' } });
      map.addLayer({ id: 'station-halo', type: 'circle', source: 'stations-corridor', paint: { 'circle-radius': 9, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#173E6C', 'circle-stroke-width': 2.5 } });
      map.addLayer({ id: 'station-core', type: 'circle', source: 'stations-corridor', paint: { 'circle-radius': 3.5, 'circle-color': '#173E6C' } });
      map.addLayer({ id: 'station-code', type: 'symbol', source: 'stations-corridor', layout: { 'text-field': ['get', 'code'], 'text-size': 10, 'text-font': ['Open Sans Bold'], 'text-offset': [0, -1.9], 'text-anchor': 'bottom', 'text-allow-overlap': true }, paint: { 'text-color': '#173E6C', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2.5 } });
      map.addLayer({ id: 'possession-halo', type: 'line', source: 'operational-activity', filter: ['==', ['get', 'entity_type'], 'BLOCK'], paint: { 'line-color': '#FFFFFF', 'line-width': 17, 'line-opacity': 0.98 } });
      map.addLayer({ id: 'possession-block', type: 'line', source: 'operational-activity', filter: ['==', ['get', 'entity_type'], 'BLOCK'], paint: { 'line-color': ['get', 'color'], 'line-width': 11, 'line-opacity': 0.98 } });
      map.addLayer({ id: 'possession-endpoints', type: 'circle', source: 'operational-activity', filter: ['==', ['get', 'entity_type'], 'BLOCK'], paint: { 'circle-radius': 5.5, 'circle-color': '#FFFFFF', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5 } });
      map.addLayer({ id: 'job-halo', type: 'line', source: 'operational-activity', filter: ['==', ['get', 'entity_type'], 'JOB'], paint: { 'line-color': '#FFFFFF', 'line-width': 10, 'line-opacity': 1 } });
      map.addLayer({ id: 'job-marker-line', type: 'line', source: 'operational-activity', filter: ['==', ['get', 'entity_type'], 'JOB'], paint: { 'line-color': ['get', 'color'], 'line-width': 5.5, 'line-opacity': 1, 'line-dasharray': [0.8, 0.8] } });
      map.addLayer({ id: 'job-core', type: 'circle', source: 'operational-activity', filter: ['==', ['get', 'entity_type'], 'JOB'], paint: { 'circle-radius': ['case', ['==', ['get', 'criticality'], 'CRITICAL'], 7, 5.5], 'circle-color': '#FFFFFF', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3 } });
      map.addLayer({ id: 'job-dot', type: 'circle', source: 'operational-activity', filter: ['==', ['get', 'entity_type'], 'JOB'], paint: { 'circle-radius': 2.5, 'circle-color': ['get', 'color'] } });
      const inspect = (e) => { const features = map.queryRenderedFeatures(e.point, { layers: ['possession-block', 'job-marker-line', 'job-core'] }); if (features[0]) setInspection({ type: 'ACTIVITY', data: features[0].properties }); };
      map.on('click', inspect); map.on('move', refreshLabels); map.on('zoom', refreshLabels); map.on('resize', refreshLabels); map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 100, right: 110, bottom: 95, left: 95 }, duration: 0 }); requestAnimationFrame(refreshLabels); setLoaded(true); setMapError(null);

      fetch(RAILWAY_GEOJSON_URL, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`Railway geometry HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          const candidates = (data?.features || []).filter((feature) => feature?.geometry?.type === 'LineString' && Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length > 1 && feature.properties?.section_id === 'PUNE-LNL');
          const directions = new Set(candidates.map((feature) => String(feature.properties?.direction || '').toUpperCase()));
          if (!directions.has('UP') || !directions.has('DN')) throw new Error('PUNE-LNL UP/DN route geometry not found');
          const route = candidates.filter((feature) => ['UP', 'DN'].includes(String(feature.properties?.direction || '').toUpperCase())).map((feature) => ({ ...feature, properties: { ...(feature.properties || {}), direction: String(feature.properties.direction).toUpperCase() } }));
          if (route.length < 2) throw new Error('PUNE-LNL double-line geometry is incomplete');
          map.getSource('railway')?.setData({ type: 'FeatureCollection', features: route });
          setMapError(null);
        })
        .catch((error) => {
          console.error('Authoritative PUNE-LNL railway geometry could not be loaded:', error);
          setMapError('Authoritative Pune–Lonavala railway geometry could not be loaded. The map remains available without a fabricated route.');
        });
    };
    map.once('load', () => { try { addOperationalLayers(); } catch (error) { console.error('Operational railway layers failed:', error); setMapError(error?.message || 'Railway control-centre layers could not be initialized.'); setLoaded(true); } });
    const resize = () => map.resize(); window.addEventListener('resize', resize);
    return () => { stationLabelRefs.current.forEach(({ el }) => el.remove()); activityLabelRefs.current.forEach(({ el }) => el.remove()); stationLabelRefs.current = []; activityLabelRefs.current = []; window.removeEventListener('resize', resize); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { const map = mapRef.current; if (!map) return undefined; requestAnimationFrame(() => map.resize()); const a = setTimeout(() => map.resize(), 150); const b = setTimeout(() => map.resize(), 500); return () => { clearTimeout(a); clearTimeout(b); }; }, [isFullScreenMode]);
  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 100, right: 110, bottom: 95, left: 95 }, duration: 450 });
  const shell = <div className={`relative overflow-hidden border border-[#C8D2DC] bg-[#DCE5E9] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[2147483000] h-screen w-screen rounded-none' : 'h-[calc(100vh-245px)] min-h-[620px] rounded-lg'}`}>
    <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-md border border-[#BFCBD6] bg-[#F8FAFC]/96 px-3 py-2 shadow-lg"><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#52606D]"><Activity className="h-3.5 w-3.5 text-[#173E6C]" /> Central Railway • Operations Control</div><div className="text-sm font-extrabold text-[#102A43]">Pune–Lonavala Double Line</div><div className="text-[10px] font-mono text-[#52606D]">Km 191.00 → 254.84 • UP / DN • 25 kV AC</div></div>
    <div className="absolute left-4 top-[88px] z-30 flex flex-wrap gap-1 rounded-md border border-[#C7D1DA] bg-white/96 p-1.5 shadow-lg">{['ALL','Engineering','S&T','Traction','Shared'].map((item) => <button key={item} onClick={() => setDept(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${dept === item ? 'bg-[#173E6C] text-white' : 'text-[#52606D] hover:bg-[#EEF3F7]'}`}>{item}</button>)}<span className="mx-0.5 w-px bg-[#D6DEE6]" />{['ALL','SCHEDULED','DEFERRED','PENDING'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${status === item ? 'bg-[#0B7189] text-white' : 'text-[#52606D] hover:bg-[#EEF3F7]'}`}>{item}</button>)}</div>
    <div className="absolute left-4 top-[134px] z-30 w-[300px]"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job, asset, defect, block or chainage" className="h-9 w-full rounded-md border border-[#C7D1DA] bg-white/96 pl-8 pr-8 text-[10px] font-mono shadow-lg outline-none focus:border-[#173E6C]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div></div>
    <div className="absolute right-4 top-4 z-30 flex gap-2"><button onClick={resetView} className="flex h-9 items-center gap-1.5 rounded-md border border-[#C7D1DA] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-lg"><LocateFixed className="h-3.5 w-3.5" />Reset</button><button onClick={onToggleFullScreen} className="flex h-9 items-center gap-1.5 rounded-md border border-[#C7D1DA] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-lg"><Maximize2 className="h-3.5 w-3.5" />{isFullScreenMode ? 'Exit' : 'Full Screen'}</button></div>
    <div className="absolute right-4 top-[88px] z-30 w-[250px] rounded-md border border-[#C7D1DA] bg-[#F8FAFC]/96 px-3 py-2 shadow-lg text-[9px] font-semibold text-[#52606D]"><div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#52606D]"><ShieldCheck className="h-3 w-3 text-[#14866B]" />Live operational layers</div><div className="grid grid-cols-2 gap-x-2 gap-y-1"><span><i className="mr-1 inline-block h-2 w-6 rounded bg-[#0B4F8A]" />UP track</span><span><i className="mr-1 inline-block h-2 w-6 rounded bg-[#087F8C]" />DN track</span><span><i className="mr-1 inline-block h-2 w-6 rounded bg-[#2F6EA6]" />Possession</span><span><i className="mr-1 inline-block h-2 w-6 rounded bg-[#E06B18]" />Pending job</span></div></div>
    <div className="absolute right-4 top-[145px] z-30 grid w-[250px] grid-cols-3 gap-1.5"><div className="rounded border border-[#C7D1DA] bg-white/96 p-2 shadow-md"><div className="text-[8px] font-bold uppercase text-[#7B8794]">Blocks</div><div className="text-base font-extrabold text-[#173E6C]">{counts.blocks}</div></div><div className="rounded border border-[#C7D1DA] bg-white/96 p-2 shadow-md"><div className="text-[8px] font-bold uppercase text-[#7B8794]">Pending</div><div className="text-base font-extrabold text-[#C05621]">{counts.pending}</div></div><div className="rounded border border-[#C7D1DA] bg-white/96 p-2 shadow-md"><div className="text-[8px] font-bold uppercase text-[#7B8794]">Critical</div><div className="text-base font-extrabold text-[#B42318]">{counts.critical}</div></div></div>
    {!loaded && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#E9EEF2]/60"><div className="rounded-md border border-[#C7D1DA] bg-white px-4 py-3 text-[10px] font-bold text-[#52606D] shadow">Loading railway control-centre layers…</div></div>}
    {mapError && <div className="absolute left-4 bottom-24 z-40 max-w-[520px] rounded-md border border-[#F1B6B6] bg-white px-3 py-2 text-[9px] font-semibold text-[#B42318] shadow-lg">{mapError}</div>}
    {inspection && <aside className="absolute bottom-20 right-4 z-50 w-[350px] rounded-lg border border-[#C7D1DA] bg-white p-3 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#7B8794]">Maintenance Activity</div><div className="text-sm font-extrabold text-[#173E6C]">{inspection.data.block_id || inspection.data.job_id}</div></div><button onClick={() => setInspection(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div><div className="mt-3 space-y-2 text-[10px]"><div className="grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Department</div><div className="font-bold">{inspection.data.department || 'Maintenance'}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Status</div><div className="font-bold">{inspection.data.status || 'PENDING'}</div></div></div><div className="grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">{Number(inspection.data.location_km || 0).toFixed(2)} km</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Track</div><div className="font-mono font-bold">{inspection.data.track_id || 'UP'}</div></div></div><div className="rounded bg-[#FFF7ED] p-2"><div className="text-[#9A3412]">Work / Defect</div><div className="font-bold text-[#7C2D12]">{inspection.data.defect_type || `${inspection.data.job_count || 0} jobs in possession`}</div></div><button onClick={() => onOpenExplainability?.(inspection.data)} className="w-full rounded bg-[#173E6C] px-3 py-2 text-[10px] font-bold text-white">Open Block Details</button></div></aside>}
    <div className="absolute bottom-4 left-4 z-30 rounded-md border border-[#C7D1DA] bg-white/96 px-3 py-2 shadow-lg text-[9px] font-semibold text-[#52606D]"><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#0B4F8A]" />UP</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#087F8C]" />DN</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-7 rounded bg-[#2F6EA6]" />Possession</span><span><i className="mr-1 inline-block h-2 w-7 rounded bg-[#E06B18]" />Job</span><div className="mt-1 text-[8px] font-normal text-[#8796A5]">Authoritative PUNE-LNL railway alignment is highlighted over the geographic basemap.</div></div>
    <div className="absolute right-4 bottom-4 z-30 rounded-md border border-[#C7D1DA] bg-white/96 px-3 py-2 shadow-lg text-[9px] font-semibold text-[#52606D]"><div className="flex items-center gap-2"><TrainFront className="h-3.5 w-3.5 text-[#B42318]" />Protected train paths remain operational constraints</div><div className="mt-1 flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-[#173E6C]" />Stations and blocks follow corridor chainage</div></div>
  </div>;
  return isFullScreenMode && typeof document !== 'undefined' ? createPortal(shell, document.body) : shell;
}
