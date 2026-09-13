import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Activity,
  LocateFixed,
  Maximize2,
  Minimize2,
  Search,
  X,
  MapPinned,
  TrainFront,
  Compass,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Zap,
  Radio,
  Clock,
  ShieldAlert,
  CheckCircle2,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  PUNE_LNL_STATIONS,
  CONNECTED_CORRIDOR_TRACK,
  getCoordinatesForKm,
  getCoordinatesRangeForKm
} from '../utils/corridorGeo';

const CORRIDOR_BOUNDS = [[73.37, 18.46], [73.98, 18.79]];
const MAP_BOUNDS = [[73.20, 18.30], [74.25, 18.98]];

const CORRIDOR_ARROWS = [
  { label: '← Towards Mumbai CSMT / Kalyan (Central Railway)', lng: 73.345, lat: 18.756 },
  { label: 'Towards Daund & Solapur (Central Railway) →', lng: 74.035, lat: 18.514 },
  { label: 'Towards Satara & Miraj (Central Railway) ↓', lng: 73.895, lat: 18.452 },
];

export default function SatelliteMap({
  blocks = [],
  jobs = [],
  selectedBlock,
  onSelectBlock,
  isFullScreenMode = false,
  onToggleFullScreen
}) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const workZoneMarkersRef = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const [isNativeFs, setIsNativeFs] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(10.35);
  const [selectedDate, setSelectedDate] = useState('2026-09-13');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedZone, setSelectedZone] = useState(null);
  const [query, setQuery] = useState('');

  // Robust Fullscreen API handler: promotes map element to browser Top Layer or CSS fullscreen
  const handleToggleFullscreen = () => {
    const elem = wrapperRef.current;
    if (!elem) return;
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement || isNativeFs);
    if (!isFs) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err) => {
          console.warn('requestFullscreen error, activating CSS fullscreen:', err);
          setIsNativeFs(true);
          document.body.classList.add('map-fullscreen-active');
          if (onToggleFullScreen) onToggleFullScreen();
        });
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else {
        setIsNativeFs(true);
        document.body.classList.add('map-fullscreen-active');
        if (onToggleFullScreen) onToggleFullScreen();
      }
    } else {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => { });
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
      setIsNativeFs(false);
      document.body.classList.remove('map-fullscreen-active');
      if (onToggleFullScreen && isFullScreenMode) onToggleFullScreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsNativeFs(isFs);
      if (isFs) {
        document.body.classList.add('map-fullscreen-active');
      } else {
        document.body.classList.remove('map-fullscreen-active');
      }
      requestAnimationFrame(() => mapRef.current?.resize());
      setTimeout(() => mapRef.current?.resize(), 50);
      setTimeout(() => mapRef.current?.resize(), 150);
      setTimeout(() => mapRef.current?.resize(), 300);
      setTimeout(() => mapRef.current?.resize(), 500);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
        }
        setIsNativeFs(false);
        document.body.classList.remove('map-fullscreen-active');
        if (onToggleFullScreen && isFullScreenMode) onToggleFullScreen();
        setTimeout(() => mapRef.current?.resize(), 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('map-fullscreen-active');
    };
  }, [onToggleFullScreen, isFullScreenMode]);

  // Index jobs by job_id for fast lookup
  const jobsById = useMemo(() => {
    const map = {};
    if (Array.isArray(jobs)) {
      jobs.forEach((j) => {
        if (j?.job_id) map[j.job_id] = j;
      });
    }
    return map;
  }, [jobs]);

  // Filter scheduled blocks strictly by selectedDate
  const dayBlocks = useMemo(() => {
    if (!Array.isArray(blocks)) return [];
    return blocks.filter((b) => b.start_time?.startsWith(selectedDate));
  }, [blocks, selectedDate]);

  // Clustered operational work-zones for the selected date
  const workZones = useMemo(() => {
    if (!dayBlocks.length) return [];

    const zones = [];

    dayBlocks.forEach((b) => {
      const bJobs = (b.job_ids || []).map((id) => jobsById[id]).filter(Boolean);
      let km = 205;
      let sectionName = b.section_id || 'Corridor Section';

      if (b.section_id === 'CWD-YARD') {
        km = 210.6;
        sectionName = 'Chinchwad Yard';
      } else if (b.section_id === 'LNL-KJT') {
        km = 254.84;
        sectionName = 'Lonavala – Karjat Ghat';
      } else if (b.section_id === 'PUNE-DD') {
        km = 191.0;
        sectionName = 'Pune – Daund Junction';
      } else if (b.section_id === 'PUNE-MRJ') {
        km = 191.0;
        sectionName = 'Pune – Miraj Junction';
      } else if (bJobs.length > 0 && Number.isFinite(bJobs[0].location_km)) {
        km = bJobs[0].location_km;
        let nearest = PUNE_LNL_STATIONS[0];
        let minDist = 999;
        PUNE_LNL_STATIONS.forEach((s) => {
          const d = Math.abs(s.km - km);
          if (d < minDist) {
            minDist = d;
            nearest = s;
          }
        });
        sectionName = `${nearest.name} (${nearest.code})`;
      }

      // Group blocks that are in the same section or within 2.5 km of each other
      const existingZone = zones.find(
        (z) =>
          Math.abs(z.km - km) <= 2.5 ||
          (z.sectionId === b.section_id && String(b.section_id).includes('YARD'))
      );

      const blockDepts = b.departments || bJobs.map((j) => j.department).filter(Boolean);

      if (existingZone) {
        existingZone.blocks.push({ block: b, jobs: bJobs });
        blockDepts.forEach((d) => existingZone.departments.add(d));
        existingZone.minKm = Math.min(existingZone.minKm, km);
        existingZone.maxKm = Math.max(existingZone.maxKm, km);
      } else {
        const deptsSet = new Set(blockDepts);
        zones.push({
          id: `zone-${zones.length + 1}`,
          sectionId: b.section_id,
          sectionName,
          km,
          minKm: km,
          maxKm: km,
          trackId: b.track_id,
          departments: deptsSet,
          blocks: [{ block: b, jobs: bJobs }]
        });
      }
    });

    // Decorate zones with color codes and primary department styling
    return zones.map((z) => {
      const depts = [...z.departments].filter(Boolean);
      let primaryDept = 'Engineering';
      let color = '#DC2626'; // Engineering Crimson
      let glowColor = '#F87171';
      let bgLight = '#FEF2F2';
      let borderCol = '#EF4444';
      let textCol = '#991B1B';

      if (depts.length > 1) {
        primaryDept = 'Joint Block';
        color = '#6366F1'; // Multi-dept Indigo
        glowColor = '#A5B4FC';
        bgLight = '#EEF2FF';
        borderCol = '#818CF8';
        textCol = '#3730A3';
      } else if (depts.includes('Traction')) {
        primaryDept = 'Traction';
        color = '#D97706'; // Traction Amber
        glowColor = '#FBBF24';
        bgLight = '#FFFBEB';
        borderCol = '#F59E0B';
        textCol = '#92400E';
      } else if (depts.includes('S&T')) {
        primaryDept = 'S&T';
        color = '#059669'; // S&T Emerald
        glowColor = '#34D399';
        bgLight = '#ECFDF5';
        borderCol = '#10B981';
        textCol = '#065F46';
      }

      return {
        ...z,
        primaryDept,
        deptList: depts,
        color,
        glowColor,
        bgLight,
        borderCol,
        textCol
      };
    });
  }, [dayBlocks, jobsById]);

  // Filtered work zones based on department filter
  const visibleWorkZones = useMemo(() => {
    if (selectedDeptFilter === 'ALL') return workZones;
    return workZones.filter((z) => z.deptList.includes(selectedDeptFilter));
  }, [workZones, selectedDeptFilter]);

  // Department counts for the selected date
  const deptCounts = useMemo(() => {
    const counts = { ALL: dayBlocks.length, Engineering: 0, Traction: 0, 'S&T': 0 };
    dayBlocks.forEach((b) => {
      const depts = b.departments || [];
      if (depts.includes('Engineering')) counts.Engineering++;
      if (depts.includes('Traction')) counts.Traction++;
      if (depts.includes('S&T')) counts['S&T']++;
    });
    return counts;
  }, [dayBlocks]);

  // Date formatted display helper
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const changeDateBy = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setSelectedZone(null);
  };

  // Filter stations based on search query
  const filteredStations = useMemo(() => {
    if (!query) return PUNE_LNL_STATIONS;
    const q = query.toLowerCase();
    return PUNE_LNL_STATIONS.filter(
      (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || String(s.km).includes(q)
    );
  }, [query]);

  // Setup MapLibre instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }]
      },
      center: [73.66, 18.64],
      zoom: 10.35,
      minZoom: 9.2,
      maxZoom: 18,
      maxBounds: MAP_BOUNDS,
      maxBoundsViscosity: 1,
      renderWorldCopies: false,
      attributionControl: true
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
    });

    const addOperationalLayers = () => {
      if (map.getSource('corridor-blue-track')) return;

      // 1. Authoritative Railway Blue Track Source
      map.addSource('corridor-blue-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { name: 'Pune–Lonavala Railway Corridor' },
          geometry: {
            type: 'LineString',
            coordinates: CONNECTED_CORRIDOR_TRACK
          }
        }
      });

      // 2. Deep contrast dark outer casing
      map.addLayer({
        id: 'corridor-track-casing',
        type: 'line',
        source: 'corridor-blue-track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0B192C',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 6.0, 11, 8.5, 14, 12.0, 18, 16.0],
          'line-opacity': 0.95
        }
      });

      // 3. Vibrant Blue Corridor Track Line
      map.addLayer({
        id: 'corridor-track-blue',
        type: 'line',
        source: 'corridor-blue-track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2563EB',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3.8, 11, 5.5, 14, 8.0, 18, 11.5],
          'line-opacity': 1
        }
      });

      // 4. Inner Cyan Highlight Line
      map.addLayer({
        id: 'corridor-track-inner',
        type: 'line',
        source: 'corridor-blue-track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#93C5FD',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 11, 1.8, 14, 2.6, 18, 4.0],
          'line-opacity': 0.9
        }
      });

      // 5. Dynamic Work Zones Track Glow Source & Layers
      map.addSource('corridor-work-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'corridor-work-zones-glow',
        type: 'line',
        source: 'corridor-work-zones',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'glowColor'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 8, 12, 14, 16, 20],
          'line-opacity': 0.65,
          'line-blur': 2.5
        }
      });

      map.addLayer({
        id: 'corridor-work-zones-line',
        type: 'line',
        source: 'corridor-work-zones',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4.5, 12, 7.0, 16, 10.5],
          'line-opacity': 0.95
        }
      });

      // Directional Corridor Arrows
      CORRIDOR_ARROWS.forEach((arrow) => {
        const el = document.createElement('div');
        el.style.cssText =
          'background:#0B192C;color:#93C5FD;border:1.5px solid #2563EB;border-radius:4px;padding:3px 8px;font:bold 9px/13px sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.35);letter-spacing:0.04em;white-space:nowrap;pointer-events:none;';
        el.textContent = arrow.label;
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([arrow.lng, arrow.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });

      map.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 90, right: 100, bottom: 90, left: 90 }, duration: 0 });
      setLoaded(true);
    };

    if (map.isStyleLoaded()) {
      addOperationalLayers();
    } else {
      map.once('load', addOperationalLayers);
      map.once('styledata', addOperationalLayers);
    }

    const resize = () => map.resize();
    window.addEventListener('resize', resize);
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      workZoneMarkersRef.current.forEach((m) => m.remove());
      workZoneMarkersRef.current = [];
      window.removeEventListener('resize', resize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update station markers with intelligent Level-of-Detail (LOD)
  // When zoomed out (< 11.4), only key junctions show labels to prevent crowding.
  // When zoomed in (>= 11.4), all stations display their clear badges.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => {
      if (m._isStationMarker) m.remove();
    });
    markersRef.current = markersRef.current.filter((m) => !m._isStationMarker);

    const isZoomedOut = currentZoom < 11.4;

    filteredStations.forEach((s) => {
      const isHq = s.code === 'PUNE';
      const isTerminus = s.code === 'LNL';
      const isMajorJunction = s.code === 'CWD' || s.code === 'TGN';
      // At low zoom, only show labels for terminal/junctions or if searched
      const showLabel = !isZoomedOut || isHq || isTerminus || isMajorJunction || Boolean(query);

      const el = document.createElement('div');
      el.className = 'station-precision-marker';
      el.style.cssText = 'position:relative;width:0;height:0;cursor:pointer;pointer-events:auto;user-select:none;z-index:15;';

      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:${isHq ? '#F59E0B' : isTerminus ? '#EA580C' : '#FFFFFF'
        };border:2px solid #0B192C;box-shadow:0 0 0 1.5px #2563EB;`;

      if (showLabel) {
        const badge = document.createElement('div');
        badge.style.cssText = `position:absolute;left:50%;bottom:8px;transform:translateX(-50%);background:${isHq ? '#0B192C' : '#FFFFFF'
          };color:${isHq ? '#FDE047' : '#0B192C'};border:1.5px solid ${isHq ? '#F59E0B' : '#0B192C'
          };border-radius:4px;padding:2px 6px;font:800 10px/12px sans-serif;box-shadow:0 2px 5px rgba(0,0,0,0.3);letter-spacing:0.02em;white-space:nowrap;`;
        badge.textContent = isHq ? `◆ PUNE JN` : isTerminus ? `◆ LONAVALA` : `${s.code} • ${s.name}`;
        el.appendChild(badge);
      } else {
        // Subtle hover tooltip when zoomed out
        const tip = document.createElement('div');
        tip.style.cssText =
          'position:absolute;left:50%;bottom:9px;transform:translateX(-50%);display:none;background:#0B192C;color:#FFFFFF;border-radius:3px;padding:2px 5px;font:800 9px/11px sans-serif;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.35);pointer-events:none;z-index:25;';
        tip.textContent = `${s.code} • ${s.name}`;
        el.appendChild(tip);
        el.onmouseenter = () => { tip.style.display = 'block'; };
        el.onmouseleave = () => { tip.style.display = 'none'; };
      }

      el.appendChild(dot);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .addTo(map);

      marker._isStationMarker = true;
      markersRef.current.push(marker);
    });
  }, [filteredStations, currentZoom, query]);

  // Update Dynamic Work Zones along the railway track strictly for selectedDate
  // When zoomed out (< 11.4), render compact non-overlapping circular railway tokens.
  // When zoomed in (>= 11.4), expand to detailed railway possession pill badges.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    // 1. Update GeoJSON curved track highlights
    const source = map.getSource('corridor-work-zones');
    if (source) {
      const features = visibleWorkZones.map((z) => {
        const startKm = Math.max(191.0, z.minKm - 0.35);
        const endKm = Math.min(254.84, z.maxKm + 0.35);
        const coords = getCoordinatesRangeForKm(startKm, endKm, z.trackId);
        return {
          type: 'Feature',
          properties: {
            id: z.id,
            color: z.color,
            glowColor: z.glowColor
          },
          geometry: {
            type: 'LineString',
            coordinates: coords.length >= 2 ? coords : [getCoordinatesForKm(startKm), getCoordinatesForKm(endKm)]
          }
        };
      });
      source.setData({ type: 'FeatureCollection', features });
    }

    // 2. Clear old work zone HTML markers
    workZoneMarkersRef.current.forEach((m) => m.remove());
    workZoneMarkersRef.current = [];

    const isZoomedOut = currentZoom < 11.4;

    // 3. Render Level-of-Detail work zone markers
    visibleWorkZones.forEach((z) => {
      const centerCoords = getCoordinatesForKm(z.km, z.trackId);
      const isSelected = selectedZone?.id === z.id;
      const blockCount = z.blocks.length;
      const firstBlock = z.blocks[0].block;
      const firstJob = z.blocks[0].jobs[0];

      const startTimeStr = firstBlock?.start_time ? firstBlock.start_time.slice(11, 16) : '00:00';
      const endTimeStr = firstBlock?.end_time ? firstBlock.end_time.slice(11, 16) : '04:00';
      const timeWindow = blockCount === 1 ? `${startTimeStr}–${endTimeStr}` : `${blockCount} Possessions`;
      const titleLabel = blockCount === 1
        ? (firstJob?.defect_type || firstBlock?.section_id || 'Maintenance').replace(/_/g, ' ')
        : `${z.sectionName}`;

      const el = document.createElement('div');
      el.className = 'railway-possession-marker';
      el.style.cssText = `position:relative;width:0;height:0;cursor:pointer;pointer-events:auto;user-select:none;z-index:${isSelected ? 20 : 10
        };`;

      if (isZoomedOut) {
        // SLEEK COMPACT PLANNER JOB CAPSULE FOR ZOOMED-OUT OVERVIEW
        // High visibility with zero jargon: shows Department, Time Window, Work Type, and Track
        const pulseDot = document.createElement('div');
        pulseDot.style.cssText = `position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:${z.color};border:2px solid #FFFFFF;box-shadow:0 0 6px ${z.glowColor};`;

        const pill = document.createElement('div');
        const isUp = z.trackId?.includes('UP');
        const posStyle = isUp ? 'bottom:9px;' : 'top:9px;';
        pill.style.cssText = `position:absolute;left:50%;${posStyle}transform:translateX(-50%);display:flex;align-items:center;gap:4.5px;background:#FFFFFF;border:1.5px solid ${isSelected ? '#0B192C' : z.borderCol};border-left:3.5px solid ${z.color};border-radius:5px;padding:2px 6px;box-shadow:0 3px 8px rgba(0,0,0,0.26);white-space:nowrap;transition:transform 0.15s ease;`;

        const deptTag = document.createElement('span');
        deptTag.style.cssText = `font:900 8px/9px sans-serif;letter-spacing:0.03em;background:${z.color};color:#FFFFFF;padding:1.5px 4px;border-radius:2.5px;text-transform:uppercase;`;
        deptTag.textContent = z.deptList.length > 1 ? `JOINT (${z.deptList.length})` : z.primaryDept.slice(0, 4).toUpperCase();

        const timeSpan = document.createElement('span');
        timeSpan.style.cssText = 'font:800 9px/11px sans-serif;color:#0B192C;letter-spacing:0.01em;';
        timeSpan.textContent = timeWindow;

        const taskSpan = document.createElement('span');
        taskSpan.style.cssText = 'font:600 8px/10px sans-serif;color:#475569;max-width:115px;overflow:hidden;text-overflow:ellipsis;';
        taskSpan.textContent = titleLabel;

        const trackBadge = document.createElement('span');
        const trk = z.trackId?.includes('UP') ? 'UP' : z.trackId?.includes('DN') ? 'DN' : 'YD';
        trackBadge.style.cssText = 'font:800 8px/9px monospace;background:#F1F5F9;color:#334155;border:1px solid #CBD5E1;padding:1px 3.5px;border-radius:2.5px;';
        trackBadge.textContent = trk;

        pill.appendChild(deptTag);
        pill.appendChild(timeSpan);
        pill.appendChild(taskSpan);
        pill.appendChild(trackBadge);

        el.appendChild(pulseDot);
        el.appendChild(pill);

        el.onmouseenter = () => {
          pill.style.transform = 'translateX(-50%) scale(1.06)';
          pill.style.boxShadow = '0 5px 12px rgba(0,0,0,0.35)';
        };
        el.onmouseleave = () => {
          pill.style.transform = 'translateX(-50%) scale(1)';
          pill.style.boxShadow = '0 3px 8px rgba(0,0,0,0.26)';
        };
      } else {
        // FULL DETAILED PILL BADGE FOR ZOOMED-IN VIEW
        const pulseDot = document.createElement('div');
        pulseDot.style.cssText = `position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:50%;background:${z.color
          };border:2px solid #FFFFFF;box-shadow:0 0 10px ${z.color}, 0 0 0 2px ${z.color};`;

        const pill = document.createElement('div');
        pill.style.cssText = `position:absolute;left:50%;top:11px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;background:#FFFFFF;border:2px solid ${isSelected ? '#0B192C' : z.borderCol
          };border-radius:6px;padding:3px 7px;box-shadow:0 4px 10px rgba(0,0,0,0.3);white-space:nowrap;transition:transform 0.15s ease;`;

        const deptTag = document.createElement('span');
        deptTag.style.cssText = `font:900 9px/10px sans-serif;letter-spacing:0.04em;background:${z.color};color:#FFFFFF;padding:2px 5px;border-radius:3px;text-transform:uppercase;`;
        deptTag.textContent = z.deptList.length > 1 ? `JOINT (${z.deptList.length})` : z.primaryDept.slice(0, 4).toUpperCase();

        const infoSpan = document.createElement('div');
        infoSpan.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;';
        infoSpan.innerHTML = `
          <span style="font:800 10px/12px sans-serif;color:#0B192C;letter-spacing:0.02em;">${timeWindow}</span>
          <span style="font:600 8.5px/10px sans-serif;color:#475569;max-width:140px;overflow:hidden;text-overflow:ellipsis;">${titleLabel}</span>
        `;

        const trackBadge = document.createElement('span');
        const trk = z.trackId?.includes('UP') ? 'UP' : z.trackId?.includes('DN') ? 'DN' : 'YARD';
        trackBadge.style.cssText = 'font:800 8.5px/10px monospace;background:#F1F5F9;color:#334155;border:1px solid #CBD5E1;padding:2px 4px;border-radius:3px;';
        trackBadge.textContent = trk;

        pill.appendChild(deptTag);
        pill.appendChild(infoSpan);
        pill.appendChild(trackBadge);

        el.appendChild(pulseDot);
        el.appendChild(pill);
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedZone(z);
        if (onSelectBlock && z.blocks[0]?.block) {
          onSelectBlock(z.blocks[0].block);
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(centerCoords)
        .addTo(map);

      marker._isWorkZoneMarker = true;
      workZoneMarkersRef.current.push(marker);
    });
  }, [visibleWorkZones, selectedZone, currentZoom, loaded, onSelectBlock]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    requestAnimationFrame(() => map.resize());
    const a = setTimeout(() => map.resize(), 50);
    const b = setTimeout(() => map.resize(), 150);
    const c = setTimeout(() => map.resize(), 350);
    const d = setTimeout(() => map.resize(), 600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
      clearTimeout(d);
    };
  }, [isFullScreenMode, isNativeFs]);

  const resetView = () => {
    setSelectedZone(null);
    mapRef.current?.fitBounds(CORRIDOR_BOUNDS, { padding: { top: 90, right: 100, bottom: 90, left: 90 }, duration: 450 });
  };

  const flyToZone = (z) => {
    const coords = getCoordinatesForKm(z.km, z.trackId);
    mapRef.current?.flyTo({ center: coords, zoom: 13.8, duration: 800 });
  };

  const shell = (
    <div
      ref={wrapperRef}
      className="relative overflow-hidden rounded-lg border border-[#B8C5D0] bg-[#D6DEE5] shadow-sm h-[calc(100vh-245px)] min-h-[620px]"
    >
      {/* Background raster base map with real track line clearly visible */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Top Left: Compact Corridor Info */}
      <div className="pointer-events-none absolute left-4 top-4 z-30 w-[270px] rounded-md border border-[#0B192C]/20 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#52606D]">
          <Activity className="h-3 w-3 text-[#2563EB]" /> Central Railway • Pune Division
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs font-black text-[#0B192C]">Pune Division Network</span>
          <span className="rounded bg-[#EFF6FF] px-1.5 py-0.2 text-[8px] font-extrabold uppercase text-[#1D4ED8] border border-[#2563EB]">
            Blue Track
          </span>
        </div>
        <div className="text-[8.5px] font-mono text-[#64748B]">
          Km 191.0 (Pune) → Km 254.84 (LNL)
        </div>
      </div>

      {/* Station Search Input (Right below top-left title) */}
      <div className="absolute left-4 top-[78px] z-30 w-[270px]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3 w-3 text-[#64748B]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search station (e.g. Akurdi, Dehu Road)"
            className="h-7 w-full rounded border border-[#CBD5E1] bg-white/96 pl-7 pr-7 text-[9px] font-mono shadow-md outline-none focus:border-[#2563EB]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-2 text-[#64748B]">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Top Center-Right: DATE & SCHEDULE CONTROLLER */}
      <div className="absolute left-[295px] top-4 z-30 flex flex-col gap-1.5 rounded-lg border border-[#CBD5E1] bg-white/95 p-2 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {/* Formatted Date Pill */}
          <div className="flex items-center gap-1.5 rounded-md bg-[#EFF6FF] px-2.5 py-1 text-[#1D4ED8] border border-[#BFDBFE]">
            <Calendar className="h-3.5 w-3.5 text-[#2563EB]" />
            <span className="text-[11px] font-extrabold">{formattedDate}</span>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => changeDateBy(-1)}
              title="Previous Day"
              className="flex h-7 w-7 items-center justify-center rounded border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0B192C]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedZone(null);
              }}
              className="h-7 rounded border border-[#CBD5E1] bg-white px-2 text-[10px] font-mono text-[#0B192C] shadow-sm outline-none focus:border-[#2563EB]"
            />
            <button
              onClick={() => changeDateBy(1)}
              title="Next Day"
              className="flex h-7 w-7 items-center justify-center rounded border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0B192C]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Quick Date Toggles */}
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={() => {
                setSelectedDate('2026-09-13');
                setSelectedZone(null);
              }}
              className={`rounded px-2 py-1 text-[9px] font-bold ${selectedDate === '2026-09-13' ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'
                }`}
            >
              Today (13 Sep)
            </button>
            <button
              onClick={() => {
                setSelectedDate('2026-09-12');
                setSelectedZone(null);
              }}
              className={`rounded px-2 py-1 text-[9px] font-bold ${selectedDate === '2026-09-12' ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'
                }`}
            >
              Yesterday (12 Sep)
            </button>
          </div>

          {/* Active Possessions Count */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-[#E2E8F0]">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${dayBlocks.length > 0 ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]' : 'bg-[#F0FDF4] text-[#16A34A] border border-[#86EFAC]'
              }`}>
              {dayBlocks.length} {dayBlocks.length === 1 ? 'Possession' : 'Possessions'}
            </span>
          </div>
        </div>

        {/* Row 2: Department Filters or Clear Track Status */}
        {dayBlocks.length > 0 ? (
          <div className="flex items-center gap-1.5 pt-1 border-t border-[#F1F5F9]">
            <span className="text-[8.5px] font-bold uppercase tracking-wider text-[#64748B]">Filter Dept:</span>
            <button
              onClick={() => setSelectedDeptFilter('ALL')}
              className={`rounded px-2 py-0.5 text-[8.5px] font-bold ${selectedDeptFilter === 'ALL' ? 'bg-[#0B192C] text-white' : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
            >
              All ({deptCounts.ALL})
            </button>
            <button
              onClick={() => setSelectedDeptFilter('Engineering')}
              className={`rounded px-2 py-0.5 text-[8.5px] font-bold ${selectedDeptFilter === 'Engineering' ? 'bg-[#DC2626] text-white' : 'bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2]'
                }`}
            >
              ENG ({deptCounts.Engineering})
            </button>
            <button
              onClick={() => setSelectedDeptFilter('Traction')}
              className={`rounded px-2 py-0.5 text-[8.5px] font-bold ${selectedDeptFilter === 'Traction' ? 'bg-[#D97706] text-white' : 'bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]'
                }`}
            >
              TRD ({deptCounts.Traction})
            </button>
            <button
              onClick={() => setSelectedDeptFilter('S&T')}
              className={`rounded px-2 py-0.5 text-[8.5px] font-bold ${selectedDeptFilter === 'S&T' ? 'bg-[#059669] text-white' : 'bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5]'
                }`}
            >
              S&T ({deptCounts['S&T']})
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[9px] font-semibold text-[#15803D] pt-0.5 border-t border-[#F1F5F9]">
            <CheckCircle2 className="h-3 w-3 text-[#16A34A]" />
            All Tracks Clear • No maintenance blocks scheduled on {formattedDate}
          </div>
        )}
      </div>

      {/* Top Right Controls */}
      <div className="absolute right-4 top-4 z-30 flex gap-2">
        <button
          onClick={resetView}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 text-[10px] font-bold text-[#0B192C] shadow-lg hover:bg-[#F8FAFC]"
        >
          <LocateFixed className="h-3.5 w-3.5 text-[#2563EB]" />
          Reset View
        </button>
        <button
          onClick={handleToggleFullscreen}
          title={isNativeFs || isFullScreenMode ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 text-[10px] font-bold text-[#0B192C] shadow-lg hover:bg-[#F8FAFC]"
        >
          {isNativeFs || isFullScreenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isNativeFs || isFullScreenMode ? 'Exit' : 'Full Screen'}
        </button>
      </div>

      {/* Section Possession Inspector Card (Displays when a Work Zone is clicked) */}
      {selectedZone && (
        <div className="absolute right-4 top-[94px] z-40 w-[360px] max-h-[calc(100%-120px)] overflow-y-auto rounded-lg border border-[#CBD5E1] bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-3.5 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: selectedZone.color }}
                />
                <h3 className="text-xs font-bold text-[#0B192C]">{selectedZone.sectionName}</h3>
              </div>
              <div className="mt-0.5 text-[9px] font-mono text-[#64748B]">
                Track Km: {selectedZone.minKm.toFixed(1)} – {selectedZone.maxKm.toFixed(1)} • {selectedZone.trackId || 'Mainline'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => flyToZone(selectedZone)}
                title="Focus Track Section"
                className="flex h-6 items-center gap-1 rounded bg-[#EFF6FF] px-2 text-[9px] font-bold text-[#1D4ED8] hover:bg-[#DBEAFE]"
              >
                <LocateFixed className="h-3 w-3" /> Focus
              </button>
              <button
                onClick={() => setSelectedZone(null)}
                className="rounded p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0B192C]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
              <span>{selectedZone.blocks.length} Possessions Scheduled</span>
              <span>{selectedDate}</span>
            </div>

            {selectedZone.blocks.map(({ block, jobs: bJobs }, idx) => {
              const startT = block?.start_time ? block.start_time.slice(11, 16) : '00:00';
              const endT = block?.end_time ? block.end_time.slice(11, 16) : '04:00';
              const jobItem = bJobs[0];

              return (
                <div
                  key={block?.block_id || idx}
                  className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-[10px] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#0B192C]">{block?.block_id}</span>
                    <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[9px] font-extrabold text-[#1D4ED8]">
                      {startT} – {endT} ({block?.duration_hours || 2}h)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(block?.departments || (jobItem ? [jobItem.department] : [])).map((d) => (
                      <span
                        key={d}
                        className="rounded px-1.5 py-0.2 text-[8px] font-bold uppercase text-white"
                        style={{
                          backgroundColor:
                            d === 'Engineering' ? '#DC2626' : d === 'Traction' ? '#D97706' : '#059669'
                        }}
                      >
                        {d}
                      </span>
                    ))}
                    <span className="font-semibold text-[#334155]">
                      {(jobItem?.defect_type || 'TRACK MAINTENANCE').replace(/_/g, ' ')}
                    </span>
                  </div>

                  {jobItem?.work_type && (
                    <div className="text-[9px] text-[#475569]">
                      <b className="text-[#0B192C]">Work Type:</b> {jobItem.work_type.replace(/_/g, ' ')}
                    </div>
                  )}

                  {block?.explanation && (
                    <div className="rounded bg-white p-1.5 text-[8.5px] leading-relaxed text-[#475569] border border-[#E2E8F0]">
                      {block.explanation}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0] text-[8.5px] text-[#64748B]">
                    <span>Line: <b>{block?.track_id || 'Corridor Main'}</b></span>
                    <span>AI Priority: <b className="text-[#0B192C]">{jobItem?.ai_priority_score || 90}/100</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Station Count / Network Legend (Shown when Inspector is closed) */}
      {!selectedZone && (
        <div className="absolute right-4 top-[94px] z-30 w-[270px] rounded-md border border-[#CBD5E1] bg-white/96 px-3.5 py-2.5 text-[9px] font-semibold text-[#334155] shadow-lg">
          <div className="mb-2 flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
            <div className="flex items-center gap-1.5 font-extrabold uppercase tracking-wider text-[#0B192C]">
              <Compass className="h-3.5 w-3.5 text-[#2563EB]" />
              Corridor Network Legend
            </div>
            <span className="rounded bg-[#EFF6FF] px-1.5 py-0.2 text-[8px] font-bold text-[#1D4ED8]">17 Stations</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-7 rounded border border-[#0B192C] bg-[#2563EB]" />
                <span className="font-bold text-[#0B192C]">Corridor Track Line</span>
              </span>
              <span className="text-[8px] text-[#64748B]">Real Curve</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-[#0B192C] bg-[#F59E0B] shadow-sm" />
                <span className="font-bold text-[#0B192C]">Pune Jn (Divisional HQ)</span>
              </span>
              <span className="text-[8px] text-[#64748B]">Km 191.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-[#0B192C] bg-[#EA580C] shadow-sm" />
                <span>Lonavala Terminal Jn</span>
              </span>
              <span className="text-[8px] text-[#64748B]">Km 254.84</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-[#0B192C] bg-[#FFFFFF] shadow-sm" />
                <span>Way & Suburban Stations</span>
              </span>
              <span className="text-[8px] text-[#64748B]">
                {currentZoom < 11.4 ? 'Zoom in to view all' : '15 Hubs'}
              </span>
            </div>
            <div className="border-t border-[#E2E8F0] pt-1.5 space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#64748B]">
                Active Possessions ({selectedDate})
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626] text-white text-[7px] font-bold flex items-center justify-center">E</span>
                  <span>Engineering (ENGG)</span>
                </span>
                <span className="text-[8px] text-[#64748B]">{deptCounts.Engineering}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D97706] text-white text-[7px] font-bold flex items-center justify-center">T</span>
                  <span>Traction / OHE (TRD)</span>
                </span>
                <span className="text-[8px] text-[#64748B]">{deptCounts.Traction}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#059669] text-white text-[7px] font-bold flex items-center justify-center">S</span>
                  <span>Signal & Telecom (S&T)</span>
                </span>
                <span className="text-[8px] text-[#64748B]">{deptCounts['S&T']}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Left Info Badge */}
      <div className="absolute bottom-4 left-4 z-30 rounded-md border border-[#CBD5E1] bg-white/96 px-3 py-1.5 text-[9px] font-semibold text-[#334155] shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-5 rounded border border-[#0B192C] bg-[#2563EB]" />
            <b>Corridor Line</b>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border border-[#0B192C] bg-white" />
            <b>Stations</b>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#DC2626]" />
            <b>Possessions</b>
          </span>
          <span className="text-[8px] font-mono text-[#64748B]">Zoom: {currentZoom.toFixed(1)}x</span>
        </div>
      </div>

      {/* Bottom Right Info Badge */}
      <div className="absolute bottom-4 right-4 z-30 rounded-md border border-[#CBD5E1] bg-white/96 px-3.5 py-1.5 text-[9px] font-semibold text-[#334155] shadow-lg">
        <div className="flex items-center gap-2">
          <TrainFront className="h-3.5 w-3.5 text-[#DC2626]" />
          <span>Central Railway • Pune Division Operations Control</span>
        </div>
      </div>
    </div>
  );

  return shell;
}
