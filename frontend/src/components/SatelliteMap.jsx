import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, LocateFixed, Maximize2, RefreshCw, Search, X } from 'lucide-react';
import { PUNE_LNL_STATIONS, getCoordinatesForKm } from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.395, 18.515], [73.885, 18.775]];
const MAP_BOUNDS = [[73.385, 18.505], [73.895, 18.785]];
const COLORS = { Engineering: '#3B6EA5', 'S&T': '#2F8F6B', Traction: '#C9842A', Shared: '#6B5B95', Deferred: '#7B8794' };

const departmentsOf = (block) => [...new Set(block.departments || block.jobs_detail?.map((j) => j.department).filter(Boolean) || [])];
const colorOf = (departments) => departments.length > 1 ? COLORS.Shared : (COLORS[departments[0]] || COLORS.Engineering);
const jobStatus = (job, blocks) => blocks.some((b) => b.job_ids?.includes(job.job_id)) ? 'SCHEDULED' : (job.status === 'DEFERRED' ? 'DEFERRED' : 'PENDING');

function featureFor(entityId, type, startKm, endKm, trackId, color, status, label, departments) {
  return {
    type: 'Feature',
    properties: { entity_id: entityId, entity_type: type, color, status, label, departments: departments.join(' + ') },
    geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(startKm, trackId), getCoordinatesForKm(endKm, trackId)] },
  };
}

export default function SatelliteMap({ blocks = [], jobs = [], selectedBlock = null, selectedJob = null, onSelectBlock, onSelectJob, onOpenExplainability, isFullScreenMode = false, onToggleFullScreen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [dept, setDept] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [track, setTrack] = useState('ALL');
  const [query, setQuery] = useState('');
  const [inspection, setInspection] = useState(null);

  const activityFeatures = useMemo(() => {
    const result = [];
    blocks.forEach((block) => {
      const departments = departmentsOf(block);
      if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return;
      if (dept === 'Shared' && departments.length < 2) return;
      if (track !== 'ALL' && !block.track_id?.includes(track)) return;
      if (status === 'PENDING' || status === 'DEFERRED') return;
      const details = block.jobs_detail || [];
      const kms = details.map((j) => Number(j.location_km)).filter(Number.isFinite);
      const center = Number.isFinite(Number(block.location_km)) ? Number(block.location_km) : 210;
      const startKm = Math.max(191, (kms.length ? Math.min(...kms) : center) - (kms.length > 1 ? 0.12 : 0.18));
      const endKm = Math.min(254.84, (kms.length ? Math.max(...kms) : center) + (kms.length > 1 ? 0.12 : 0.18));
      result.push(featureFor(block.block_id, 'BLOCK', startKm, endKm, block.track_id || details[0]?.track_id || 'PUNE-LNL-UP', colorOf(departments), 'SCHEDULED', `${departments.join(' + ') || 'Engineering'} possession`, departments));
    });

    jobs.forEach((job) => {
      const jobState = jobStatus(job, blocks);
      if (jobState === 'SCHEDULED') return;
      if (dept !== 'ALL' && job.department !== dept) return;
      if (track !== 'ALL' && !job.track_id?.includes(track)) return;
      if (status !== 'ALL' && status !== jobState) return;
      const haystack = `${job.job_id} ${job.asset_id || ''} ${job.defect_type || ''} ${job.location_km || ''}`.toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return;
      const km = Number(job.location_km);
      if (!Number.isFinite(km)) return;
      result.push(featureFor(job.job_id, 'JOB', Math.max(191, km - 0.10), Math.min(254.84, km + 0.10), job.track_id || 'PUNE-LNL-UP', jobState === 'DEFERRED' ? COLORS.Deferred : colorOf([job.department]), jobState, `${job.department || 'Maintenance'} • ${job.defect_type || 'Maintenance'}`, [job.department || 'Engineering']));
    });
    return status === 'SCHEDULED' ? result.filter((f) => f.properties.status === 'SCHEDULED') : result;
  }, [blocks, jobs, dept, status, track, query]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
      center: [73.64, 18.65], zoom: 10.4, minZoom: 10.2, maxZoom: 18, maxBounds: MAP_BOUNDS, maxBoundsViscosity: 1, attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

    map.on('load', async () => {
      try {
        const railway = await fetch('/geojson/pune_lonavala_railways.geojson').then((r) => r.json());
        map.addSource('railway', { type: 'geojson', data: railway });
        map.addLayer({ id: 'railway-bed', type: 'line', source: 'railway', paint: { 'line-color': '#1E3A5F', 'line-width': 7, 'line-opacity': 0.82 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'railway-up', type: 'line', source: 'railway', filter: ['==', 'track_id', 'PUNE-LNL-UP'], paint: { 'line-color': '#1E3A5F', 'line-width': 3.2 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'railway-dn', type: 'line', source: 'railway', filter: ['==', 'track_id', 'PUNE-LNL-DN'], paint: { 'line-color': '#2F6F7E', 'line-width': 3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'railway-loop', type: 'line', source: 'railway', filter: ['==', 'track_id', 'PUNE-LNL-LOOP'], paint: { 'line-color': '#8A6D3B', 'line-width': 2.5, 'line-dasharray': [2, 1.5] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

        map.addSource('stations', { type: 'geojson', data: { type: 'FeatureCollection', features: PUNE_LNL_STATIONS.map((s) => ({ type: 'Feature', properties: { code: s.code, name: s.name, km: s.km }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })) } });
        map.addLayer({ id: 'station-dots', type: 'circle', source: 'stations', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.2, 4, 14, 6], 'circle-color': '#FFFFFF', 'circle-stroke-color': '#1E3A5F', 'circle-stroke-width': 2 } });
        map.addLayer({ id: 'station-labels', type: 'symbol', source: 'stations', layout: { 'text-field': ['get', 'code'], 'text-size': 11, 'text-offset': [0, 1.15], 'text-anchor': 'top', 'text-allow-overlap': true }, paint: { 'text-color': '#173E6C', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } });

        map.addSource('maintenance', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'maintenance-casing', type: 'line', source: 'maintenance', paint: { 'line-color': '#FFFFFF', 'line-width': 12, 'line-opacity': 0.92 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-solid', type: 'line', source: 'maintenance', filter: ['==', 'status', 'SCHEDULED'], paint: { 'line-color': ['get', 'color'], 'line-width': 8, 'line-opacity': 0.96 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-pending', type: 'line', source: 'maintenance', filter: ['==', 'status', 'PENDING'], paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.72, 'line-dasharray': [1.5, 1.5] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-deferred', type: 'line', source: 'maintenance', filter: ['==', 'status', 'DEFERRED'], paint: { 'line-color': COLORS.Deferred, 'line-width': 6, 'line-opacity': 0.6, 'line-dasharray': [0.8, 1.8] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 70, right: 70, bottom: 70, left: 70 }, duration: 0 });
        setLoaded(true);
      } catch (error) { console.error('Corridor map data load failed:', error); setLoaded(true); }
    });

    map.on('click', (event) => {
      const features = map.queryRenderedFeatures(event.point, { layers: ['maintenance-solid', 'maintenance-pending', 'maintenance-deferred', 'station-dots'] });
      if (!features.length) return;
      const props = features[0].properties || {};
      if (features[0].layer.id === 'station-dots') {
        const station = PUNE_LNL_STATIONS.find((s) => s.code === props.code);
        if (station) setInspection({ type: 'STATION', data: station });
        return;
      }
      if (props.entity_type === 'BLOCK') {
        const block = blocks.find((b) => b.block_id === props.entity_id);
        if (block) { onSelectBlock?.(block); setInspection({ type: 'BLOCK', data: block }); }
      } else {
        const job = jobs.find((j) => j.job_id === props.entity_id);
        if (job) { onSelectJob?.(job); setInspection({ type: 'JOB', data: job }); }
      }
    });
    ['maintenance-solid', 'maintenance-pending', 'maintenance-deferred'].forEach((layer) => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded && map.getSource('maintenance')) map.getSource('maintenance').setData({ type: 'FeatureCollection', features: activityFeatures });
  }, [activityFeatures, loaded]);

  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 70, right: 70, bottom: 70, left: 70 }, duration: 650 });
  const inspectionTitle = inspection?.type === 'STATION' ? inspection.data?.code : inspection?.type === 'BLOCK' ? inspection.data?.block_id : inspection?.data?.job_id;

  return <div className={`relative overflow-hidden rounded-lg border border-[#C8D2DC] bg-[#E9EEF2] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[100]' : 'h-[calc(100vh-245px)] min-h-[620px]'}`}>
    <div ref={containerRef} className="absolute inset-0" />

    <div className="absolute left-4 top-4 z-10 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md backdrop-blur">
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8796A5]">Central Railway • Pune Division</div>
      <div className="text-sm font-bold text-[#173E6C]">Pune–Lonavala Corridor</div>
      <div className="text-[10px] font-mono text-[#52606D]">Km 191.0 → 254.84 • Double Line • 25 kV AC</div>
    </div>

    <div className="absolute left-4 top-[90px] z-10 flex flex-wrap gap-1.5 rounded-md border border-[#D6DEE6] bg-white/95 p-1.5 shadow-md backdrop-blur">
      {['ALL', 'Engineering', 'S&T', 'Traction', 'Shared'].map((item) => <button key={item} onClick={() => setDept(item)} className={`rounded px-2.5 py-1 text-[9px] font-bold ${dept === item ? 'bg-[#1E3A5F] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}
      <span className="mx-0.5 w-px bg-[#D6DEE6]" />
      {['ALL', 'SCHEDULED', 'PENDING', 'DEFERRED'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded px-2.5 py-1 text-[9px] font-bold ${status === item ? 'bg-[#2F6F7E] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}
    </div>

    <div className="absolute left-4 top-[136px] z-10 w-[280px]">
      <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job, asset, defect or chainage" className="h-9 w-full rounded-md border border-[#D6DEE6] bg-white/95 pl-8 pr-8 text-[10px] font-mono shadow-md outline-none focus:border-[#1E3A5F]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div>
    </div>

    <div className="absolute right-4 top-4 z-10 flex gap-2">
      <button onClick={resetView} className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md hover:bg-[#F4F6F8]"><LocateFixed className="h-3.5 w-3.5" /> Reset View</button>
      {onToggleFullScreen && <button onClick={onToggleFullScreen} className="flex h-9 items-center rounded-md border border-[#D6DEE6] bg-white px-2.5 text-[#173E6C] shadow-md"><Maximize2 className="h-3.5 w-3.5" /></button>}
      <button onClick={() => setLayersOpen((v) => !v)} className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-[10px] font-bold shadow-md ${layersOpen ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-[#D6DEE6] bg-white text-[#173E6C]'}`}><Layers className="h-3.5 w-3.5" /> Layers</button>
    </div>

    {layersOpen && <div className="absolute right-4 top-[54px] z-20 w-[225px] rounded-md border border-[#D6DEE6] bg-white/97 p-3 text-[10px] text-[#40546A] shadow-xl">
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8796A5]">Operational Layers</div>
      <div className="space-y-1.5"><div className="flex justify-between"><span>Railway alignment</span><i className="h-1.5 w-8 rounded-full bg-[#1E3A5F]" /></div><div className="flex justify-between"><span>Stations</span><i className="h-3 w-3 rounded-full border-2 border-[#1E3A5F] bg-white" /></div><div className="flex justify-between"><span>Engineering</span><i className="h-2 w-8 rounded-full bg-[#3B6EA5]" /></div><div className="flex justify-between"><span>S&T</span><i className="h-2 w-8 rounded-full bg-[#2F8F6B]" /></div><div className="flex justify-between"><span>Traction</span><i className="h-2 w-8 rounded-full bg-[#C9842A]" /></div><div className="flex justify-between"><span>Shared possession</span><i className="h-2 w-8 rounded-full bg-[#6B5B95]" /></div><div className="flex justify-between"><span>Pending / Deferred</span><i className="h-2 w-8 border-t-2 border-dashed border-[#7B8794]" /></div></div>
    </div>}

    {inspection && <div className="absolute bottom-4 left-4 z-20 w-[315px] rounded-lg border border-[#D6DEE6] bg-white/97 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between border-b border-[#D6DEE6] px-3 py-2.5"><div><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8796A5]">{inspection.type === 'BLOCK' ? 'Scheduled Possession' : inspection.type === 'JOB' ? 'Maintenance Activity' : 'Railway Station'}</div><div className="mt-0.5 text-sm font-bold text-[#173E6C]">{inspectionTitle}</div></div><button onClick={() => setInspection(null)} className="text-[#718294]"><X className="h-4 w-4" /></button></div>
      <div className="space-y-2 px-3 py-3 text-[10px] text-[#52606D]">{inspection.type === 'STATION' ? <><b className="text-[#1F2933]">{inspection.data?.name}</b><div>Km <b>{inspection.data?.km}</b> • {inspection.data?.category}</div></> : <><b className="text-[#1F2933]">{inspection.data?.defect_type || inspection.data?.block_id}</b><div className="grid grid-cols-2 gap-2"><span>Department<b className="block text-[#1F2933]">{inspection.type === 'BLOCK' ? departmentsOf(inspection.data).join(' + ') || '—' : inspection.data?.department}</b></span><span>Track<b className="block font-mono text-[#1F2933]">{inspection.data?.track_id || inspection.data?.jobs_detail?.[0]?.track_id || '—'}</b></span><span>Location<b className="block font-mono text-[#1F2933]">Km {inspection.data?.location_km ?? inspection.data?.jobs_detail?.[0]?.location_km ?? '—'}</b></span><span>Status<b className="block text-[#1F2933]">{inspection.type === 'BLOCK' ? 'SCHEDULED' : jobStatus(inspection.data, blocks)}</b></span></div>{inspection.type === 'BLOCK' && onOpenExplainability && <button onClick={() => onOpenExplainability(inspection.data)} className="w-full rounded bg-[#1E3A5F] px-3 py-2 text-[10px] font-bold text-white">Why this block?</button>}</>}</div>
    </div>}

    <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md border border-[#D6DEE6] bg-white/96 px-3 py-2 shadow-lg backdrop-blur"><div className="flex items-center gap-3 whitespace-nowrap text-[9px] font-semibold text-[#52606D]"><span>━ Railway</span><span className="text-[#3B6EA5]">━ Engineering</span><span className="text-[#2F8F6B]">━ S&T</span><span className="text-[#C9842A]">━ Traction</span><span className="text-[#6B5B95]">━ Shared</span><span className="text-[#7B8794]">┄ Pending/Deferred</span></div></div>

    {!loaded && <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70"><div className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 text-xs font-semibold text-[#173E6C] shadow-lg"><RefreshCw className="mr-2 inline h-3.5 w-3.5 animate-spin" /> Loading corridor map…</div></div>}
  </div>;
}
