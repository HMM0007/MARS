import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Maximize2, Search, X } from 'lucide-react';
import { PUNE_LNL_STATIONS, getCoordinatesForKm } from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.397, 18.515], [73.887, 18.775]];
const MAP_BOUNDS = [[73.36, 18.48], [73.93, 18.82]];
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
    properties: { entity_id: block.block_id, entity_type: 'BLOCK', color: status === 'DEFERRED' ? COLORS.Deferred : colorOf(departments), status },
    geometry: { type: 'LineString', coordinates: [getCoordinatesForKm(anchor - spread, trackId), getCoordinatesForKm(anchor + spread, trackId)] },
  };
}

export default function SatelliteMap({ blocks = [], jobs = [], selectedBlock = null, onSelectBlock, onOpenExplainability, isFullScreenMode = false, onToggleFullScreen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const stationLabelRefs = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [dept, setDept] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [inspection, setInspection] = useState(null);

  const activityFeatures = useMemo(() => blocks.filter((block) => {
    const departments = departmentsOf(block);
    if (dept !== 'ALL' && dept !== 'Shared' && !departments.includes(dept)) return false;
    if (dept === 'Shared' && departments.length < 2) return false;
    const blockStatus = block.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED';
    if (status !== 'ALL' && status !== blockStatus) return false;
    const haystack = `${block.block_id || ''} ${(block.job_ids || []).join(' ')} ${(block.jobs_detail || []).map((j) => `${j.asset_id || ''} ${j.defect_type || ''} ${j.location_km || ''}`).join(' ')}`.toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  }).map(possessionFeature), [blocks, dept, status, query]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    // Inline raster style: no remote style JSON, glyph manifest, or style dependency.
    // MapLibre officially supports this raster-source pattern.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }],
      },
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

    const updateStationLabels = () => {
      stationLabelRefs.current.forEach(({ el, station }) => {
        if (!el || !map.isStyleLoaded()) return;
        const point = map.project([station.lng, station.lat]);
        el.style.transform = `translate(${point.x}px, ${point.y + 8}px) translate(-50%, 0)`;
      });
    };

    map.once('load', async () => {
      try {
        const railway = await fetch('/geojson/pune_lonavala_railways.geojson').then((r) => {
          if (!r.ok) throw new Error(`Railway geometry HTTP ${r.status}`);
          return r.json();
        });
        map.addSource('mars-railway', { type: 'geojson', data: railway });
        map.addLayer({ id: 'mars-railway-casing', type: 'line', source: 'mars-railway', paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'mars-railway-up', type: 'line', source: 'mars-railway', filter: ['==', ['get', 'track_id'], 'PUNE-LNL-UP'], paint: { 'line-color': '#1E3A5F', 'line-width': 3.1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'mars-railway-dn', type: 'line', source: 'mars-railway', filter: ['==', ['get', 'track_id'], 'PUNE-LNL-DN'], paint: { 'line-color': '#2F6F7E', 'line-width': 2.8 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

        const stations = {
          type: 'FeatureCollection',
          features: PUNE_LNL_STATIONS.map((s) => ({ type: 'Feature', properties: { code: s.code, name: s.name, km: s.km }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })),
        };
        map.addSource('real-stations', { type: 'geojson', data: stations });
        map.addLayer({ id: 'station-halo', type: 'circle', source: 'real-stations', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.25, 4, 14, 6, 18, 8], 'circle-color': '#FFFFFF', 'circle-stroke-color': '#173E6C', 'circle-stroke-width': 2 } });
        map.addLayer({ id: 'station-core', type: 'circle', source: 'real-stations', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.25, 2, 14, 3, 18, 4], 'circle-color': '#173E6C' } });

        map.addSource('maintenance-possessions', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'maintenance-casing', type: 'line', source: 'maintenance-possessions', paint: { 'line-color': '#FFFFFF', 'line-width': 12, 'line-opacity': 0.92 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-scheduled', type: 'line', source: 'maintenance-possessions', filter: ['==', ['get', 'status'], 'SCHEDULED'], paint: { 'line-color': ['get', 'color'], 'line-width': 8, 'line-opacity': 0.98 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'maintenance-deferred', type: 'line', source: 'maintenance-possessions', filter: ['==', ['get', 'status'], 'DEFERRED'], paint: { 'line-color': COLORS.Deferred, 'line-width': 7, 'line-opacity': 0.75, 'line-dasharray': [1.2, 1.8] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

        // Station names are DOM labels, not MapLibre glyph labels, so they cannot fail because of a font/glyph endpoint.
        stationLabelRefs.current = PUNE_LNL_STATIONS.map((station) => {
          const el = document.createElement('div');
          el.className = 'mars-station-label';
          el.textContent = station.code;
          el.style.cssText = 'position:absolute;left:0;top:0;z-index:5;pointer-events:auto;white-space:nowrap;transform-origin:top center;background:rgba(255,255,255,.94);border:1px solid #D6DEE6;border-radius:3px;padding:1px 4px;font:700 9px/12px Arial,sans-serif;color:#173E6C;box-shadow:0 1px 2px rgba(0,0,0,.12);cursor:pointer;';
          el.addEventListener('click', () => setInspection({ type: 'STATION', data: station }));
          map.getCanvasContainer().appendChild(el);
          return { el, station };
        });
        updateStationLabels();
        map.on('move', updateStationLabels);
        map.on('resize', updateStationLabels);
        map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 80, right: 90, bottom: 80, left: 90 }, duration: 0 });
        requestAnimationFrame(() => map.resize());
        setLoaded(true);
        setMapError(null);
      } catch (error) {
        console.error('Corridor map data load failed:', error);
        // Keep the base OSM map visible even if the MARS railway overlay fails.
        setMapError(`Railway overlay unavailable: ${error?.message || 'unknown error'}`);
        setLoaded(true);
      }
    });

    map.on('error', (event) => {
      if (event?.error) console.error('MARS map error:', event.error);
    });
    const resize = () => map.resize();
    window.addEventListener('resize', resize);

    return () => {
      stationLabelRefs.current.forEach(({ el }) => el?.remove());
      stationLabelRefs.current = [];
      window.removeEventListener('resize', resize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('maintenance-possessions');
    if (source) source.setData({ type: 'FeatureCollection', features: activityFeatures });
  }, [activityFeatures]);

  const resetView = () => mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 80, right: 90, bottom: 80, left: 90 }, duration: 450 });

  return (
    <div className={`relative overflow-hidden rounded-lg border border-[#C8D2DC] bg-[#DCE5E9] shadow-sm ${isFullScreenMode ? 'fixed inset-0 z-[100]' : 'h-[calc(100vh-245px)] min-h-[620px]'}`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md">
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
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#718294]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter maintenance by job, asset, defect or km" className="h-9 w-full rounded-md border border-[#D6DEE6] bg-white/95 pl-8 pr-8 text-[10px] font-mono shadow-md outline-none focus:border-[#1E3A5F]" />{query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-[#718294]"><X className="h-3.5 w-3.5" /></button>}</div>
      </div>

      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button onClick={resetView} className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md"><LocateFixed className="h-3.5 w-3.5" />Reset View</button>
        <button onClick={onToggleFullScreen} className="flex h-9 items-center gap-1.5 rounded-md border border-[#D6DEE6] bg-white px-3 text-[10px] font-bold text-[#173E6C] shadow-md"><Maximize2 className="h-3.5 w-3.5" />{isFullScreenMode ? 'Exit' : 'Full Screen'}</button>
      </div>

      {!loaded && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#E9EEF2]/60"><div className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 text-[10px] font-bold text-[#52606D] shadow">Loading operational railway map…</div></div>}
      {mapError && <div className="absolute left-4 bottom-20 z-30 max-w-[420px] rounded-md border border-[#F1B6B6] bg-white px-3 py-2 text-[9px] font-semibold text-[#C92A2A] shadow-lg">{mapError}</div>}

      {inspection && <aside className="absolute bottom-4 right-4 z-30 w-[320px] rounded-lg border border-[#D6DEE6] bg-white/96 p-3 shadow-xl"><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8796A5]">{inspection.type === 'STATION' ? 'Railway Station' : 'Maintenance Possession'}</div><div className="text-sm font-bold text-[#173E6C]">{inspection.type === 'STATION' ? inspection.data.name : inspection.data.block_id}</div></div><button onClick={() => setInspection(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div>{inspection.type === 'STATION' ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Code</div><div className="font-bold">{inspection.data.code}</div></div><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Chainage</div><div className="font-mono font-bold">{inspection.data.km.toFixed(2)} km</div></div></div> : <div className="mt-3 space-y-2 text-[10px]"><div className="rounded bg-[#F4F6F8] p-2"><div className="text-[#8796A5]">Departments</div><div className="font-bold">{departmentsOf(inspection.data).join(' + ') || 'Maintenance'}</div></div><button onClick={() => onOpenExplainability?.(inspection.data)} className="w-full rounded bg-[#1E3A5F] px-3 py-2 text-[10px] font-bold text-white">Open Block Details</button></div>}</aside>}

      <div className="absolute bottom-4 left-4 z-20 rounded-md border border-[#D6DEE6] bg-white/95 px-3 py-2 shadow-md text-[9px] font-semibold text-[#52606D]"><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#1E3A5F]" />Railway track</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#3B6EA5]" />Engineering</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#2F8F6B]" />S&T</span><span className="mr-3"><i className="mr-1 inline-block h-2 w-5 rounded bg-[#C9842A]" />Traction</span><span><i className="mr-1 inline-block h-2 w-5 rounded bg-[#6B5B95]" />Shared</span><div className="mt-1 text-[8px] font-normal text-[#8796A5]">Stations are fixed to railway coordinates. Maintenance appears only as corridor possession lines — never as job pins.</div></div>
    </div>
  );
}
