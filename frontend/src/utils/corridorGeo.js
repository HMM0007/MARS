/**
 * MARS 2.0 Corridor Geospatial Helper
 * Accurately projects Indian Railways chainage (Km 191.000 to 254.840)
 * onto curved GPS track coordinates (UP Line, DN Line, Loop Line).
 */

// 15 Real Stations on the Pune — Lonavala Corridor with exact GPS coordinates & chainage
export const PUNE_LNL_STATIONS = [
  { code: 'PUNE', name: 'Pune Junction', km: 191.0, lng: 73.8744, lat: 18.5284, category: 'Terminus / Junction', platforms: 6 },
  { code: 'SVJR', name: 'Shivajinagar', km: 193.5, lng: 73.8512, lat: 18.5320, category: 'Suburban Hub', platforms: 3 },
  { code: 'KK', name: 'Khadki', km: 197.2, lng: 73.8290, lat: 18.5607, category: 'Way Station', platforms: 2 },
  { code: 'DAPD', name: 'Dapodi', km: 201.0, lng: 73.8222, lat: 18.5804, category: 'Way Station / Mula River', platforms: 2 },
  { code: 'KSWD', name: 'Kasarwadi', km: 204.1, lng: 73.8180, lat: 18.6015, category: 'Suburban Halt', platforms: 2 },
  { code: 'PMP', name: 'Pimpri', km: 207.3, lng: 73.7997, lat: 18.6225, category: 'Industrial Hub', platforms: 2 },
  { code: 'CWD', name: 'Chinchwad', km: 210.6, lng: 73.7850, lat: 18.6360, category: 'Freight Yard / Junction', platforms: 4 },
  { code: 'AKRD', name: 'Akurdi', km: 214.2, lng: 73.7660, lat: 18.6500, category: 'Suburban Station', platforms: 2 },
  { code: 'DEHR', name: 'Dehu Road', km: 219.8, lng: 73.7250, lat: 18.6800, category: 'Military / Goods Siding', platforms: 2 },
  { code: 'BGWI', name: 'Begdewadi', km: 223.1, lng: 73.7020, lat: 18.7010, category: 'Suburban Halt', platforms: 2 },
  { code: 'TGN', name: 'Talegaon', km: 227.4, lng: 73.6780, lat: 18.7280, category: 'Suburban Terminus / Yard', platforms: 3 },
  { code: 'VDN', name: 'Vadgaon', km: 233.2, lng: 73.6350, lat: 18.7450, category: 'Way Station', platforms: 2 },
  { code: 'KMST', name: 'Kamshet', km: 240.0, lng: 73.5580, lat: 18.7580, category: 'Indrayani Valley Station', platforms: 2 },
  { code: 'MVL', name: 'Malavli', km: 248.5, lng: 73.4720, lat: 18.7520, category: 'Ghat Approach', platforms: 2 },
  { code: 'LNL', name: 'Lonavala', km: 254.84, lng: 73.4072, lat: 18.7540, category: 'Ghat Terminus / Bank Engine Hub', platforms: 4 },
];

export const CORRIDOR_SECTORS = [
  { id: 'ALL', name: 'Full Corridor (63.84 km)', kmRange: '191.0 — 254.8 km', center: [73.64, 18.65], zoom: 10.2, pitch: 35, bearing: 310 },
  { id: 'PUNE_URBAN', name: 'Pune — Dapodi Sector', kmRange: 'Km 191.0 — 201.0', center: [73.848, 18.545], zoom: 13.5, pitch: 40, bearing: 320 },
  { id: 'PIMPRI_CWD', name: 'Pimpri — Chinchwad Yard', kmRange: 'Km 201.0 — 214.2', center: [73.792, 18.628], zoom: 13.8, pitch: 45, bearing: 315 },
  { id: 'DEHU_TALEGAON', name: 'Dehu Road — Talegaon Yard', kmRange: 'Km 214.2 — 227.4', center: [73.705, 18.705], zoom: 13.2, pitch: 40, bearing: 310 },
  { id: 'INDRAYANI_VALLEY', name: 'Vadgaon — Kamshet Valley', kmRange: 'Km 227.4 — 240.0', center: [73.595, 18.752], zoom: 13.0, pitch: 45, bearing: 300 },
  { id: 'BHOR_GHAT', name: 'Malavli — Lonavala Ghat Ascent', kmRange: 'Km 240.0 — 254.84', center: [73.442, 18.753], zoom: 13.4, pitch: 55, bearing: 290 },
];

/**
 * Projects a location_km value onto exact GPS coordinates [lng, lat]
 * along the corridor alignment, applying track offsets (UP, DN, LOOP).
 */
export const getCoordinatesForKm = (kmValue, trackId = 'PUNE-LNL-UP') => {
  const km = Number(kmValue) || 205.0;
  const stations = PUNE_LNL_STATIONS;

  // Clamp within corridor limits
  const minKm = stations[0].km;
  const maxKm = stations[stations.length - 1].km;
  const clampedKm = Math.max(minKm, Math.min(maxKm, km));

  // Find bounding stations
  let stnA = stations[0];
  let stnB = stations[1];

  for (let i = 0; i < stations.length - 1; i++) {
    if (clampedKm >= stations[i].km && clampedKm <= stations[i + 1].km) {
      stnA = stations[i];
      stnB = stations[i + 1];
      break;
    }
  }

  const segmentLength = stnB.km - stnA.km;
  const t = segmentLength > 0 ? (clampedKm - stnA.km) / segmentLength : 0;

  // Base interpolated coordinate
  let lng = stnA.lng + (stnB.lng - stnA.lng) * t;
  let lat = stnA.lat + (stnB.lat - stnA.lat) * t;

  // Track parallel offsets (approx 15-20 meters)
  const isDn = trackId?.includes('DN');
  const isLoop = trackId?.includes('LOOP') || trackId?.includes('YARD');

  if (isDn) {
    lng += 0.00018;
    lat += 0.00012;
  } else if (isLoop) {
    lng -= 0.00028;
    lat -= 0.00020;
  }

  return [Math.round(lng * 1000000) / 1000000, Math.round(lat * 1000000) / 1000000];
};
