/**
 * MARS 2.0 Satellite Railway Corridor Geospatial Map
 * Powered by MapLibre GL JS (Zero API token required, ultra-resilient tile engine)
 * 
 * Features:
 * - Real High-Resolution Esri World Imagery Satellite Tiles & Clean White Railway GIS Basemap
 * - Professional Government Railway White Theme (Railway Blue accents, Charcoal typography)
 * - Real Double-Track Railway Alignment (UP Line, DN Line, Loops, 15 Stations, 5km Milestones)
 * - Exact Chainage Projection for All 150 Jobs across Engineering, S&T, Traction
 * - Scheduled CP-SAT Block Possession Highlights with Pulsing Radar Rings
 * - 3D Terrain Tilt, Sector Quick-Jump, and Slide-Out White Telemetry Drawer
 */

import { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Navigation,
  Compass,
  Eye,
  SlidersHorizontal,
  ShieldCheck,
  Activity,
  Zap,
  Wrench,
  Radio,
  Filter,
  ExternalLink,
  ChevronRight,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  Globe,
  Sun,
} from 'lucide-react';
import {
  PUNE_LNL_STATIONS,
  CORRIDOR_SECTORS,
  getCoordinatesForKm,
} from '../utils/corridorGeo';

const SatelliteMap = ({
  blocks = [],
  jobs = [],
  selectedBlock = null,
  selectedJob = null,
  onSelectBlock,
  onSelectJob,
  onOpenExplainability,
  isFullScreenMode = false,
  onToggleFullScreen,
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [satellitePitch, setSatellitePitch] = useState(false);
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [activeLayerMode, setActiveLayerMode] = useState('SATELLITE'); // SATELLITE, WHITE_GIS

  // Filters
  const [deptFilter, setDeptFilter] = useState('ALL'); // ALL, Engineering, S&T, Traction, Consolidated
  const [trackFilter, setTrackFilter] = useState('ALL'); // ALL, UP, DN, LOOP
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, SCHEDULED, PENDING

  // Inspection Drawer
  const [inspectedEntity, setInspectedEntity] = useState(null); // { type: 'BLOCK'|'JOB'|'STATION', data: ... }
  const [showFilters, setShowFilters] = useState(false);

  // Corridor Center (Pune to Lonavala midpoint)
  const CORRIDOR_CENTER = [73.64, 18.65];

  // Basemap Styles using resilient open tile servers
  const mapStyles = {
    SATELLITE: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
    WHITE_GIS: {
      version: 8,
      sources: {
        'carto-light': {
          type: 'raster',
          tiles: [
            'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          attribution: 'CARTO, OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'light-tiles',
          type: 'raster',
          source: 'carto-light',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  };

  // 1. Initialize MapLibre GL Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyles[activeLayerMode],
      center: CORRIDOR_CENTER,
      zoom: 10.2,
      pitch: 35, // 35-degree angle for Ghats 3D perspective
      bearing: 310, // Oriented along Pune-Mumbai alignment
      attributionControl: false,
    });

    mapRef.current = map;

    // Add navigation controls (Zoom in/out, compass)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left');

    map.on('load', () => {
      setMapLoaded(true);
      loadRailwayLayers(map, activeLayerMode);
    });

    return () => {
      map.remove();
    };
  }, []);

  // Helper to load GeoJSON tracks & vector layers
  const loadRailwayLayers = (map, basemapMode) => {
    fetch('/geojson/pune_lonavala_railways.geojson')
      .then((res) => res.json())
      .then((geoData) => {
        if (!map.getSource('corridor-railway')) {
          map.addSource('corridor-railway', {
            type: 'geojson',
            data: geoData,
          });

          // 1. Track Bed Casing (Dark Ballast Base)
          map.addLayer({
            id: 'railway-ballast',
            type: 'line',
            source: 'corridor-railway',
            filter: ['==', '$type', 'LineString'],
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': basemapMode === 'SATELLITE' ? '#0B132B' : '#334155',
              'line-width': 8,
              'line-opacity': 0.9,
            },
          });

          // 2. UP Line (Electric Sky Blue / Towards Mumbai)
          map.addLayer({
            id: 'railway-track-up',
            type: 'line',
            source: 'corridor-railway',
            filter: ['==', 'track_id', 'PUNE-LNL-UP'],
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': basemapMode === 'SATELLITE' ? '#38BDF8' : '#1E3A5F',
              'line-width': 3.8,
            },
          });

          // 3. DN Line (High-Contrast White on satellite, Dark Teal on white map)
          map.addLayer({
            id: 'railway-track-dn',
            type: 'line',
            source: 'corridor-railway',
            filter: ['==', 'track_id', 'PUNE-LNL-DN'],
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': basemapMode === 'SATELLITE' ? '#FFFFFF' : '#0D9488',
              'line-width': 3.5,
            },
          });

          // 4. Station Loops & Yard Lines
          map.addLayer({
            id: 'railway-track-loop',
            type: 'line',
            source: 'corridor-railway',
            filter: ['==', 'track_id', 'PUNE-LNL-LOOP'],
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#F59E0B',
              'line-width': 3.0,
              'line-dasharray': [2, 1],
            },
          });

          // 5. Track Sleepers / Rail Ties Pattern
          map.addLayer({
            id: 'railway-sleepers',
            type: 'line',
            source: 'corridor-railway',
            filter: ['==', '$type', 'LineString'],
            paint: {
              'line-color': basemapMode === 'SATELLITE' ? '#FFFFFF' : '#1E293B',
              'line-width': 5,
              'line-dasharray': [0.2, 0.8],
              'line-opacity': 0.7,
            },
          });
        }
      })
      .catch((err) => console.warn('Corridor track GeoJSON notice:', err));
  };

  // Re-render markers (Stations + Jobs + Scheduled Blocks)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Clear old DOM markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Add 15 Real Stations with White Theme Badges
    PUNE_LNL_STATIONS.forEach((stn) => {
      const el = document.createElement('div');
      el.className = 'station-marker group cursor-pointer z-10 select-none';
      el.innerHTML = `
        <div class="flex flex-col items-center select-none transform transition-transform hover:scale-125">
          <div class="w-4 h-4 rounded-full bg-white border-2 border-[#1E3A5F] shadow-md flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-[#1E3A5F]"></div>
          </div>
          <div class="mt-1 bg-white text-[#1E3A5F] border border-[#D6DEE6] px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono shadow-md whitespace-nowrap">
            ${stn.code} <span class="text-[#52606D] font-normal">(${stn.km}k)</span>
          </div>
        </div>
      `;

      el.addEventListener('click', () => {
        setInspectedEntity({ type: 'STATION', data: stn });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stn.lng, stn.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // 2. Add Scheduled CP-SAT Blocks as Active Possession Highlights
    if (statusFilter !== 'PENDING') {
      blocks.forEach((blk) => {
        const depts = blk.departments || ['Engineering'];
        const isConsolidated = blk.is_consolidated || depts.length > 1;

        // Apply filters
        if (deptFilter !== 'ALL') {
          if (deptFilter === 'Consolidated' && !isConsolidated) return;
          if (deptFilter !== 'Consolidated' && !depts.includes(deptFilter)) return;
        }
        if (trackFilter !== 'ALL' && !blk.track_id?.includes(trackFilter)) return;

        // Determine color
        let color = '#3B6EA5'; // Engineering Blue
        if (isConsolidated) color = '#6B5B95'; // Purple Consolidated
        else if (depts.includes('S&T')) color = '#2F8F6B'; // S&T Green
        else if (depts.includes('Traction')) color = '#C9842A'; // Traction Amber

        // Determine chainage
        const primaryJob = blk.jobs_detail?.[0];
        const km = primaryJob?.location_km || 210.0;
        const [lng, lat] = getCoordinatesForKm(km, blk.track_id);

        const isSelected = selectedBlock?.block_id === blk.block_id;

        const blkEl = document.createElement('div');
        blkEl.className = 'possession-marker cursor-pointer z-30 select-none';
        blkEl.innerHTML = `
          <div class="flex flex-col items-center select-none transform transition-transform hover:scale-125">
            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background-color: ${color}; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${color}; border: 2.5px solid #FFFFFF; box-shadow: 0 0 10px ${color};"></div>
            </div>
            <div style="margin-top: 2px; background-color: #FFFFFF; color: #1E3A5F; border: 1.5px solid ${isSelected ? '#38BDF8' : color}; padding: 1.5px 5px; border-radius: 3px; font-size: 9px; font-weight: bold; font-family: monospace; box-shadow: 0 2px 6px rgba(0,0,0,0.2); white-space: nowrap;">
              ${blk.block_id}
            </div>
          </div>
        `;

        blkEl.addEventListener('click', () => {
          onSelectBlock?.(blk);
          setInspectedEntity({ type: 'BLOCK', data: blk });
        });

        const blockMarker = new maplibregl.Marker({ element: blkEl })
          .setLngLat([lng, lat])
          .addTo(map);

        markersRef.current.push(blockMarker);
      });
    }

    // 3. Add Individual Maintenance Jobs along Chainage
    if (jobs && jobs.length > 0) {
      jobs.forEach((job) => {
        // Apply filters
        if (deptFilter !== 'ALL' && job.department !== deptFilter) return;
        if (trackFilter !== 'ALL' && !job.track_id?.includes(trackFilter)) return;

        const isScheduled = blocks.some((b) => b.job_ids?.includes(job.job_id));
        if (statusFilter === 'SCHEDULED' && !isScheduled) return;
        if (statusFilter === 'PENDING' && isScheduled) return;

        let deptColor = '#3B6EA5';
        if (job.department === 'S&T') deptColor = '#2F8F6B';
        if (job.department === 'Traction') deptColor = '#C9842A';

        const critColor =
          job.criticality_level === 'CRITICAL'
            ? '#C92A2A'
            : job.criticality_level === 'HIGH'
            ? '#F08C00'
            : '#2F9E44';

        const [lng, lat] = getCoordinatesForKm(job.location_km, job.track_id);
        const isJobSelected = selectedJob?.job_id === job.job_id;

        const jobEl = document.createElement('div');
        jobEl.className = 'job-marker cursor-pointer z-20 select-none';
        jobEl.innerHTML = `
          <div class="group relative flex flex-col items-center select-none transform transition-transform hover:scale-130">
            <div style="width: 11px; height: 11px; border-radius: 2px; background-color: ${deptColor}; border: 1.5px solid ${critColor}; box-shadow: 0 0 5px ${deptColor};"></div>
            <!-- Clean White Hover Tooltip -->
            <div class="hidden group-hover:block absolute bottom-full mb-1.5 bg-white text-[#1F2933] border border-[#D6DEE6] p-2 rounded shadow-xl text-[9px] whitespace-nowrap z-50 pointer-events-none">
              <div class="font-bold font-mono text-[#1E3A5F]">${job.job_id} • Km ${Number(job.location_km).toFixed(2)}</div>
              <div class="text-[#52606D] font-medium">${job.defect_type}</div>
              <div class="text-[8px] text-[#52606D] mt-0.5">${job.department} • <span style="color: ${critColor}; font-weight: bold;">${job.criticality_level}</span></div>
            </div>
          </div>
        `;

        jobEl.addEventListener('click', () => {
          onSelectJob?.(job);
          setInspectedEntity({ type: 'JOB', data: job });
        });

        const jobMarker = new maplibregl.Marker({ element: jobEl })
          .setLngLat([lng, lat])
          .addTo(map);

        markersRef.current.push(jobMarker);
      });
    }
  }, [mapLoaded, blocks, jobs, selectedBlock, selectedJob, deptFilter, trackFilter, statusFilter, activeLayerMode]);

  // 4. Bidirectional Camera Tracking when a block is selected externally
  useEffect(() => {
    if (!mapRef.current || !selectedBlock) return;

    const primaryJob = selectedBlock.jobs_detail?.[0];
    const km = primaryJob?.location_km || 210.0;
    const [lng, lat] = getCoordinatesForKm(km, selectedBlock.track_id);

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 14.5,
      pitch: 45,
      bearing: 310,
      duration: 1600,
      essential: true,
    });

    setInspectedEntity({ type: 'BLOCK', data: selectedBlock });
  }, [selectedBlock]);

  // Handle Sector Quick-Jump
  const handleSectorJump = (sectorId) => {
    setSelectedSector(sectorId);
    if (!mapRef.current) return;

    const sector = CORRIDOR_SECTORS.find((s) => s.id === sectorId) || CORRIDOR_SECTORS[0];
    mapRef.current.flyTo({
      center: sector.center,
      zoom: sector.zoom,
      pitch: sector.pitch,
      bearing: sector.bearing,
      duration: 1500,
    });
  };

  // Toggle 3D Pitch
  const togglePitch = () => {
    if (!mapRef.current) return;
    const newPitch = satellitePitch ? 0 : 55;
    setSatellitePitch(!satellitePitch);
    mapRef.current.easeTo({ pitch: newPitch, duration: 700 });
  };

  // Toggle Basemap (Satellite vs. Clean White Railway GIS)
  const toggleBasemap = (mode) => {
    if (!mapRef.current || activeLayerMode === mode) return;
    setActiveLayerMode(mode);
    mapRef.current.setStyle(mapStyles[mode]);
    mapRef.current.once('style.load', () => {
      loadRailwayLayers(mapRef.current, mode);
    });
  };

  return (
    <div className="bg-white border border-[#D6DEE6] rounded-md shadow-sm overflow-hidden select-none flex flex-col">
      {/* 1. CLEAN WHITE INSTITUTIONAL TOOLBAR */}
      <div className="bg-white text-[#1F2933] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#D6DEE6]">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded bg-[#1E3A5F] flex items-center justify-center text-white shadow-xs">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                Corridor Railway Geospatial View
              </h3>
              <span className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded font-mono font-bold">
                PUNE — LONAVALA (63.84 KM)
              </span>
              <span className="text-[10px] bg-[#2F9E44]/10 text-[#2F9E44] border border-[#2F9E44]/30 px-1.5 py-0.5 rounded font-mono font-bold">
                {activeLayerMode === 'SATELLITE' ? 'ESRI SATELLITE TILES' : 'WHITE RAILWAY GIS'}
              </span>
            </div>
            <p className="text-[11px] text-[#52606D] mt-0.5">
              Double Track Mainline • 25kV AC Electrification • 15 Stations • Real Chainage Mapping
            </p>
          </div>
        </div>

        {/* Map GIS Interactive Controls */}
        <div className="flex items-center space-x-2">
          {/* Sector Quick Jump */}
          <div className="flex items-center space-x-1 bg-[#F4F6F8] px-2.5 py-1 rounded border border-[#D6DEE6] text-xs">
            <span className="text-[10px] text-[#52606D] uppercase font-bold">Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => handleSectorJump(e.target.value)}
              className="bg-transparent text-[11px] font-mono font-bold text-[#1F2933] focus:outline-none cursor-pointer"
            >
              {CORRIDOR_SECTORS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} ({sec.kmRange})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
              showFilters
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-[#52606D] border-[#D6DEE6] hover:bg-[#F4F6F8]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          {/* Basemap Toggle: Satellite vs Clean White GIS */}
          <div className="flex items-center space-x-0.5 bg-[#F4F6F8] p-0.5 rounded border border-[#D6DEE6] text-[11px]">
            <button
              onClick={() => toggleBasemap('SATELLITE')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded font-bold transition-colors ${
                activeLayerMode === 'SATELLITE'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-[#52606D] hover:text-[#1F2933]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Satellite</span>
            </button>
            <button
              onClick={() => toggleBasemap('WHITE_GIS')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded font-bold transition-colors ${
                activeLayerMode === 'WHITE_GIS'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-[#52606D] hover:text-[#1F2933]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>White GIS</span>
            </button>
          </div>

          {/* 3D Pitch Button */}
          <button
            onClick={togglePitch}
            className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
              satellitePitch
                ? 'bg-[#2F9E44] text-white border-[#2F9E44]'
                : 'bg-white text-[#52606D] border-[#D6DEE6] hover:bg-[#F4F6F8]'
            }`}
            title="Toggle 3D Sahyadri Terrain Perspective"
          >
            3D Tilt
          </button>

          {/* Fullscreen / Expand Button */}
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-1.5 bg-white hover:bg-[#F4F6F8] text-[#1E3A5F] rounded border border-[#D6DEE6]"
              title={isFullScreenMode ? 'Collapse View' : 'Open Dedicated Full-Screen Corridor Map'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. COLLAPSIBLE FILTER STRIP (Clean White / Light Theme) */}
      {showFilters && (
        <div className="bg-[#F8FAFC] text-[#1F2933] px-4 py-2.5 border-b border-[#D6DEE6] flex flex-wrap items-center gap-4 text-xs animate-in fade-in duration-150">
          {/* Department Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-[#52606D] uppercase font-bold">Dept:</span>
            {['ALL', 'Engineering', 'S&T', 'Traction', 'Consolidated'].map((dept) => (
              <button
                key={dept}
                onClick={() => setDeptFilter(dept)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  deptFilter === dept
                    ? 'bg-[#1E3A5F] text-white font-bold shadow-xs'
                    : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#F1F5F9]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Track Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-[#52606D] uppercase font-bold">Track:</span>
            {['ALL', 'UP', 'DN', 'LOOP'].map((tr) => (
              <button
                key={tr}
                onClick={() => setTrackFilter(tr)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  trackFilter === tr
                    ? 'bg-[#1E3A5F] text-white font-bold shadow-xs'
                    : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#F1F5F9]'
                }`}
              >
                {tr === 'ALL' ? 'All Tracks' : `${tr} Line`}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-[#52606D] uppercase font-bold">Status:</span>
            {['ALL', 'SCHEDULED', 'PENDING'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-[#2F6F7E] text-white font-bold shadow-xs'
                    : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#F1F5F9]'
                }`}
              >
                {st === 'ALL' ? 'All Jobs' : st === 'SCHEDULED' ? 'Scheduled Blocks' : 'Pending Queue'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. OPERATIONAL LEGEND BAR (Light Theme) */}
      <div className="bg-[#F8FAFC] text-[#52606D] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-[10px] border-b border-[#D6DEE6]">
        <div className="flex items-center space-x-4 font-mono">
          <span className="flex items-center space-x-1.5 text-[#1F2933]">
            <span className="w-3 h-1.5 bg-[#38BDF8] rounded-xs border border-[#0284C7]" />
            <span className="font-bold">TRACK 1 UP (To Mumbai)</span>
          </span>
          <span className="flex items-center space-x-1.5 text-[#1F2933]">
            <span className="w-3 h-1.5 bg-[#FFFFFF] border border-[#94A3B8] rounded-xs" />
            <span className="font-bold">TRACK 2 DN (To Pune)</span>
          </span>
          <span className="flex items-center space-x-1.5 text-[#1F2933]">
            <span className="w-3 h-1.5 bg-[#F59E0B] rounded-xs" />
            <span className="font-bold">LOOP LINES</span>
          </span>
          <span className="text-[#2F9E44] font-bold">
            ⚡ 25kV AC TRACTION ELECTRIFIED
          </span>
        </div>

        <div className="flex items-center space-x-4 text-[10px] font-mono">
          <span className="flex items-center space-x-1 text-[#1F2933]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6B5B95]" />
            <span className="font-bold">Purple Consolidated</span>
          </span>
          <span className="flex items-center space-x-1 text-[#1F2933]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B6EA5]" />
            <span className="font-bold">Engineering</span>
          </span>
          <span className="flex items-center space-x-1 text-[#1F2933]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F8F6B]" />
            <span className="font-bold">S&T</span>
          </span>
          <span className="flex items-center space-x-1 text-[#1F2933]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C9842A]" />
            <span className="font-bold">Traction</span>
          </span>
          <span className="text-[#1E3A5F] font-bold">
            Blocks: {blocks.length} | Total Jobs: {jobs.length || 150}
          </span>
        </div>
      </div>

      {/* 4. MAPLIBRE GL WEBGL CANVAS CONTAINER */}
      <div className={`relative w-full ${isFullScreenMode ? 'h-[750px]' : 'h-[400px]'} bg-[#E2E8F0]`}>
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* 5. SLIDE-OUT WHITE DCO INSPECTION TELEMETRY DRAWER */}
        {inspectedEntity && (
          <div className="absolute top-3 right-3 bg-white/98 border border-[#D6DEE6] p-4 rounded-md shadow-2xl max-w-sm w-full text-xs text-[#1F2933] z-30 backdrop-blur-md animate-in fade-in slide-in-from-right-3 duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#D6DEE6] pb-2 mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1E3A5F] animate-pulse" />
                <span className="font-mono font-bold text-[#1E3A5F] text-xs">
                  {inspectedEntity.type === 'BLOCK'
                    ? inspectedEntity.data.block_id
                    : inspectedEntity.type === 'JOB'
                    ? inspectedEntity.data.job_id
                    : `${inspectedEntity.data.name} (${inspectedEntity.data.code})`}
                </span>
              </div>
              <button
                onClick={() => setInspectedEntity(null)}
                className="text-[#52606D] hover:text-[#1F2933] text-xs font-bold px-1.5 py-0.5 rounded hover:bg-[#F4F6F8]"
              >
                ✕
              </button>
            </div>

            {/* BLOCK INSPECTION VIEW */}
            {inspectedEntity.type === 'BLOCK' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F2933]">
                    {(inspectedEntity.data.departments || ['Engineering']).join(', ')} Block
                  </span>
                  <span className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded font-mono font-bold">
                    {inspectedEntity.data.track_id}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#D6DEE6] space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Time Window:</span>
                    <span className="text-[#1F2933] font-bold">
                      {inspectedEntity.data.start_time?.slice(11, 16)} → {inspectedEntity.data.end_time?.slice(11, 16)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Duration:</span>
                    <span className="text-[#1F2933] font-bold">{inspectedEntity.data.duration_hours || 2.5} Hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Consolidation:</span>
                    <span className={inspectedEntity.data.is_consolidated ? 'text-[#6B5B95] font-bold' : 'text-[#52606D]'}>
                      {inspectedEntity.data.is_consolidated ? 'YES (Purple Consolidated)' : 'Single Department'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Bundled Jobs:</span>
                    <span className="text-[#1E3A5F] font-bold">{inspectedEntity.data.job_ids?.length || 1} Jobs</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#52606D] leading-relaxed italic bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                  {inspectedEntity.data.explanation || 'Optimal conflict-free window scheduled by CP-SAT solver.'}
                </p>

                {/* Mathematical Explainability Action Button */}
                <button
                  type="button"
                  onClick={() => onOpenExplainability?.(inspectedEntity.data)}
                  className="w-full mt-2 py-2 bg-[#1E3A5F] hover:bg-[#2F6F7E] text-white text-[11px] font-bold rounded transition-colors text-center shadow-xs flex items-center justify-center space-x-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-[#2F9E44]" />
                  <span>Inspect Mathematical Explainability</span>
                </button>
              </div>
            )}

            {/* JOB INSPECTION VIEW */}
            {inspectedEntity.type === 'JOB' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F2933] truncate">
                    {inspectedEntity.data.defect_type}
                  </span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono ${
                      inspectedEntity.data.criticality_level === 'CRITICAL'
                        ? 'bg-[#C92A2A] text-white'
                        : inspectedEntity.data.criticality_level === 'HIGH'
                        ? 'bg-[#F08C00] text-white'
                        : 'bg-[#2F9E44] text-white'
                    }`}
                  >
                    {inspectedEntity.data.criticality_level}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#D6DEE6] space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Asset ID:</span>
                    <span className="text-[#1F2933] font-bold">{inspectedEntity.data.asset_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Chainage:</span>
                    <span className="text-[#1E3A5F] font-bold">Km {Number(inspectedEntity.data.location_km).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Track:</span>
                    <span className="text-[#1F2933]">{inspectedEntity.data.track_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Department:</span>
                    <span className="text-[#1F2933] font-bold">{inspectedEntity.data.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Estimated Window:</span>
                    <span className="text-[#1F2933]">{inspectedEntity.data.estimated_duration_hours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">OHE Power Block:</span>
                    <span className={inspectedEntity.data.power_block_required ? 'text-[#C92A2A] font-bold' : 'text-[#52606D]'}>
                      {inspectedEntity.data.power_block_required ? 'REQUIRED (25kV Off)' : 'Not Required'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Heavy Machine:</span>
                    <span className="text-[#1F2933]">{inspectedEntity.data.machine_required || 'Manual Gang'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">AI Priority Score:</span>
                    <span className="text-[#2F9E44] font-bold">{inspectedEntity.data.ai_priority_score || 70} / 100</span>
                  </div>
                </div>

                {/* Zoom on Track */}
                <button
                  onClick={() => {
                    const [lng, lat] = getCoordinatesForKm(inspectedEntity.data.location_km, inspectedEntity.data.track_id);
                    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, pitch: 45, duration: 1200 });
                  }}
                  className="w-full py-1.5 bg-[#1E3A5F] hover:bg-[#2F6F7E] text-white text-[11px] font-bold rounded text-center transition-colors"
                >
                  Zoom Directly to Track Location
                </button>
              </div>
            )}

            {/* STATION INSPECTION VIEW */}
            {inspectedEntity.type === 'STATION' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F2933]">
                    {inspectedEntity.data.name} ({inspectedEntity.data.code})
                  </span>
                  <span className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded font-mono font-bold">
                    Km {inspectedEntity.data.km}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#D6DEE6] space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Category:</span>
                    <span className="text-[#1F2933] font-bold">{inspectedEntity.data.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Platforms:</span>
                    <span className="text-[#1F2933] font-bold">{inspectedEntity.data.platforms} Platforms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52606D]">Section:</span>
                    <span className="text-[#1F2933]">Pune — Lonavala (CR)</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    mapRef.current?.flyTo({
                      center: [inspectedEntity.data.lng, inspectedEntity.data.lat],
                      zoom: 15.5,
                      pitch: 50,
                      duration: 1400,
                    });
                  }}
                  className="w-full py-1.5 bg-[#1E3A5F] hover:bg-[#2F6F7E] text-white text-[11px] font-bold rounded text-center transition-colors"
                >
                  Inspect Station Yard & Crossovers
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SatelliteMap;
