import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Maximize2, Search, X } from 'lucide-react';
import { PUNE_LNL_STATIONS, getCoordinatesForKm } from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.397, 18.515], [73.887, 18.775]];
const MAP_BOUNDS = [[73.37, 18.49], [73.92, 18.81]];
const COLORS = { Engineering: '#3B6EA5', 'S&T': '#2F8F6B', Traction: '#C9842A', Shared: '#6B5B95', Deferred: '#7B8794' };

const departmentsOf = (block) => [...new Set((block.departments || block.jobs_detail?.map((j) => j.department) || []).filter(Boolean))];
const colorOf = (departments) => departments.length > 1 ? COLORS.Shared : (COLORS[departments[0]] || COLORS.Engineering);

function possessionFeature(block) {
  const details = block.jobs_detail || [];
  const kms = details.map((j) => Number(j.location_km)).filter(Number.isFinite);
  const center = Number(block.location_km);
  const anchor = kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : (Number.isFinite(center) ? center : 210);
  const spread = kms.length > 1 ? Math.max(0.12, Math.min(0.55, (Math.max(...kms) - Math.min(...kms)) / 2 + 0.08)) : 0.18;
  const departments = departmentsOf(block);
  const status = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
  const trackId = block.track_id || details[0]?.track_id || 'PUNE-LNL-UP';
  return {
    type: 'Feature',
    properties: {
      entity_id: block.block_id,
      entity_type: 'BLOCK',
      color: status === 'DEFERRED' ? COLORS.Deferred : colorOf(departments),
      status,
      label: `${departments.join(' + ') || 'Maintenance'} possession`,
      departments: departments.join(' + '),
      job_ids: (block.job_ids || []).join(','),
    },
    geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(anchor - spread, trackId), getCoordinatesForKm(anchor + spread, trackId)] },
  };
}

export default function SatelliteMap({
  blocks = [], jobs = [], selectedBlock = null, selectedJob = null, onSelectBlock, onSelectJob, onOpenExplainability,
  isFullScreenMode = false, onToggleFullScreen,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [dept, setDept] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [inspection, setInspection] = useState(null);

  const activityFeatures = useMemo(() => {
    return blocks.filter((block) => {
      const departments = departmentsOf(block);
      if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return false;
      if (dept === 'Shared' && departments.length < 2) return false;
      const blockStatus = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
      if (status !== 'ALL' && status !== blockStatus) return false;
      const haystack = `${block.block_id || ''} ${(block.job_ids || []).join(' ')} ${(block.jobs_detail || []).map((j) => `${j.asset_id || ''} ${j.defect_type || ''} ${j.location_km || ''}`).join(' ')}`.toLowerCase();
      return !query || haystack.includes(query.toLowerCase());
    }).map(possessionFeature);
  }, [blocks, dept, status, query]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // OpenFreeMap is OSM-based, keyless, and avoids the blank raster-tile failure.
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: [73.64, 18.65],
      zoom: 10.45,
      minZoom: 10.25,
      maxZoom: 18,
      maxBounds: MAP_BOUNDS,
      maxBoundsViscosity: 1,
      renderWorldCopies: false,
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

    const onError = (event) => {
      if (event?.error?.message) console.error('MARS corridor map error:', event.error);
      if (!map.isStyleLoaded()) setMapError('Map base layer could not be loaded. Check network access to the map tile service.');
    };
    map.on('error', onError);

    map.on('load', async () => {
      try {
        const railway = await fetch('/geojson/pune_lonavala_railways.geojson').then((r) => {
          if (!r.ok) throw new Error(`Railway geometry HTTP ${r.status}`);
          return r.json();
        });

        map.addSource('mars-railway', { type: 'geojson', data: railway });
        map.addLayer({ id: 'mars-railway-casing', type: 'line', source: 'mars-railway', paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'mars-railway-up', type: 'line', source: 'mars-railway', filter: ['==', ['get', 'track_id'], 'PUNE-LNL-UP'], paint: { 'line-color': '#1E3A5F', 'line-width': 3.1, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'mars-railway-dn', type: 'line', source: 'mars-railway', filter: ['==', ['get', 'track_id'], 'PUNE-LNL-DN'], paint: { 'line-color': '#2F6F7E', 'line-width': 2.8, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

        const stationFeatures = PUNE_LNL_STATIONS.map((station) => ({
          type: 'Feature',
          properties: { code: station.code, name: station.name, km: station.km },
          geometry: { type: 'Point', coordinates: [station.lng, station.lat] },
        }));
        map.addSource('real-stations', { type: 'geojson', data: { type: 'FeatureCollection', features: stationFeatures } });
        map.addLayer({ id: 'real-station-halo', type: 'circle', source: 'real-stations', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.25, 4, 14, 6.5, 18, 8], 'circle-color': '#FFFFFF', 'circle-opacity': 0.98, 'circle-stroke-color': '#173E6C', 'circle-stroke-width': 2 } });
        map.addLayer({ id: 'real-station-core', type: 'circle', source: 'real-stations', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.25, 1.8, 14, 2.8, 18, 3.5], 'circle-color': '#173E6C' } });
        map.addLayer({ id: 'real-station-labels', type: 'symbol', source: 'real-stations', minzoom: 10.25, layout: { 'text-field': ['get', 'code'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10.25, 9, 14, 11, 18, 13], 'text-offset': [0, 1.15], 'text-anchor': 'top', 'text-allow-overlap': true }, paint: { 'text-color': '#173E6C', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } });

        map.addSource('maintenance-possessions', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'maintenance-casing', type: 'line', source: 'maintenance-possessions', paint: { 'line-color': '#FFFFFF', 'line-width': 12, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-scheduled', type: 'line', source: 'maintenance-possessions', filter: ['==', ['get', 'status'], 'SCHEDULED'], paint: { 'line-color': ['get', 'color'], 'line-width': 8, 'line-opacity': 0.98 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-deferred', type: 'line', source: 'maintenance-possessions', filter: ['==', ['get', 'status'], 'DEFERRED'], paint: { 'line-color': COLORS.Deferred, 'line-width': 7, 'line-opacity': 0.75, 'line-dasharray': [1.2, 1.8] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

        map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 75, right: 75, bottom: 75, left: 75 }, duration: 0 });
        setMapError(null);
        setLoaded(true);
        requestAnimationFrame(() => map.resize());
        setTimeout(() => map.resize(), 150);
      } catch (error) {
        console.error('Corridor map data load failed:', error);
        setMapError(error?.message || 'Corridor map data could not be loaded.');
        setLoaded(true);
      }
    });

    const handleResize = () => map.resize();
    window.addEventListener('resize', handleResize);

    map.on('click', (event) => {
      const features = map.queryRenderedFeatures(event.point, { layers: ['maintenance-scheduled', 'maintenance-deferred', 'real-station-core', 'real-station-halo'] });
      if (!features.length) return;
      const props = features[0].properties || {};
      if (String(props.code || '').length) {
        const station = PUNE_LNL_STATIONS.find((s) => s.code === props.code);
        if (station) setInspection({ type: 'STATION', data: station });
        return;
      }
      const block = blocks.find((b) => b.block_id === props.entity_id);
      if (block) { onSelectBlock?.(block); setInspection({ type: 'BLOCK', data: block }); }
    });

    ['maintenance-scheduled', 'maintenance-deferred'].forEach((layer) => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, [blocks, onSelectBlock]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('maintenance-possessions');
    if (map && loaded && source) source.setData({ type: 'FeatureCollection', features: activityFeatures });
  }, [activityFeatures, loaded]);

  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 75, right: 75, bottom: 75, left: 75 }, duration: 500 });
  const inspectionTitle = inspection?.type === 'STATION' ? inspection.data?.name : inspection?.data?.block_id;
  const selectedJobCount = selectedBlock?.job_ids?.length || selectedJob?.job_id ? 1 : 0;

  return (
    <div className={`relative overflow-hidden rounded-lg border border-[#C8D2DC] bg-[#DCE5E9] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[100]' : 'h-[calc(100vh-245px)] min-h-[620px]'}`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md">
        <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8796A5]">Central Railway • Pune Division</div>
        <div className="text-sm font-bold text-[#173E6C]">Pune–Lonavala Corridor</div>
        <div className="text-[10px] font-mono text-[#52606D]">Km 191.0 → 254.84 • Double Line • 25 kV AC</div>
      </div>

      <div className="absolute left-4 top-[92px] z-20 flex flex-wrap gap-1 rounded-md border border-[#D6DEE6] bg-white/95 p-1.5 shadow-md">
        {['ALL', 'Engineering', 'S&T', 'Traction', 'Shared'].map((item) => <button key={item} onClick={() => setDept(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${dept === item ? 'bg-[#1E3A5F] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}
        <span className="mx-0.5 w-px bg-[#D6DEE6]" />
        {['ALL', 'SCHEDULED', 'DEFERRED'].map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded px-2 py-1 text-[9px] font-bold ${status === item ? 'bg-[#2F6F7E] text-white' : 'text-[#52606D] hover:bg-[#F4F6F8]'}`}>{item}</button>)}
      </div>

      <div className="absolute left-4 top-[138px] z-20 w-[290px]">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter possession by job, asset, defect or km" className="h-9 w-full rounded-md border border-[#D6DEE6] bg-white/95 pl-8 pr-8 text-[10px] font-mono shadow-md outline-none focus:border-[#1E3A5F]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div>
      </div>

      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button onClick={resetView} title="Reset corridor view" className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md hover:bg-[#F4F6F8]"><LocateFixed className="h-3.5 w-3.5" />Reset View</button>
        <button onClick={onToggleFullScreen} title="Full screen" className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md hover:bg-[#F4F6F8]"><Maximize2 className="h-3.5 w-3.5" />{isFullScreenMode ? 'Exit' : 'Full Screen'}</button>
      </div>

      {!loaded && !mapError && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#E9EEF2]/80"><div className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 text-[10px] font-bold text-[#52606D] shadow">Loading operational railway map…</div></div>}
      {mapError && <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-md border border-[#F1B6B6] bg-white px-4 py-3 text-center text-[10px] font-semibold text-[#C92A2A] shadow-lg">{mapError}</div>}

      {inspection && <aside className="absolute bottom-4 right-4 z-30 w-[320px] rounded-lg border border-[#D6DEE6] bg-white/96 p-3 shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8796A5]">{inspection.type === 'STATION' ? 'Railway Station' : 'Maintenance Possession'}</div><div className="text-sm font-bold text-[#173E6C]">{inspectionTitle}</div></div><button onClick={() => setInspection(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div>
        {inspection.type === 'STATION' ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Code</div><div className="font-bold text-[#1F2933]">{inspection.data.code}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold text-[#1F2933]">{inspection.data.km.toFixed(2)} km</div></div><div className="col-span-2 rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Location</div><div className="font-semibold text-[#1F2933]">{inspection.data.name}</div></div></div> : <div className="mt-3 space-y-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Departments</div><div className="font-bold text-[#1F2933]">{departmentsOf(inspection.data).join(' + ') || 'Maintenance'}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Work</div><div className="font-semibold text-[#1F2933]">{(inspection.data.jobs_detail || []).map((j) => j.defect_type || j.maintenance_type || j.job_id).filter(Boolean).join(' • ') || 'Planned maintenance possession'}</div></div><button onClick={() => onOpenExplainability?.(inspection.data)} className="w-full rounded bg-[#1E3A5F] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#2F6F7E]">Open Block Details</button></div>}
      </aside>}

      <div className="absolute bottom-4 left-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#8796A5]">Operational legend</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-semibold text-[#52606D]"><span><i className="mr-1 inline-block h-2 w-5 rounded bg-[#1E3A5F]" />Railway track</span><span><i className="mr-1 inline-block h-2 w-5 rounded bg-[#3B6EA5]" />Engineering</span><span><i className="mr-1 inline-block h-2 w-5 rounded bg-[#2F8F6B]" />S&T</span><span><i className="mr-1 inline-block h-2 w-5 rounded bg-[#C9842A]" />Traction</span><span><i className="mr-1 inline-block h-2 w-5 rounded bg-[#6B5B95]" />Shared</span><span><i className="mr-1 inline-block h-2 w-5 rounded border border-[#7B8794] bg-white" />Deferred</span></div>
        <div className="mt-1 text-[8px] text-[#8796A5]">Station marks are fixed to railway station coordinates. Maintenance is shown only as corridor possession lines — no job pins.</div>
      </div>
    </div>
  );
}
