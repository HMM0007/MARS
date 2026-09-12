/**
 * MARS 2.0 Corridor Geospatial Helper
 * Station coordinates are fixed to the real Pune–Lonavala railway stations.
 * Maintenance work is rendered along the corridor by railway chainage; jobs are
 * never rendered as arbitrary map pins.
 */

// Passenger-service stations on the Pune–Lonavala corridor, in railway order.
// Coordinates are based on OpenStreetMap / Wikidata railway-station locations.
export const PUNE_LNL_STATIONS = [
  { code: 'PUNE', name: 'Pune Junction', km: 191.0, lng: 73.8743, lat: 18.5289, category: 'Junction', platforms: 6 },
  { code: 'SVJR', name: 'Shivajinagar', km: 193.5, lng: 73.8514, lat: 18.5326, category: 'Station', platforms: 2 },
  { code: 'KK', name: 'Khadki', km: 197.2, lng: 73.8405, lat: 18.5630, category: 'Station', platforms: 2 },
  { code: 'DAPD', name: 'Dapodi', km: 201.0, lng: 73.8328, lat: 18.5814, category: 'Station', platforms: 2 },
  { code: 'KSWD', name: 'Kasarwadi', km: 204.1, lng: 73.8209, lat: 18.6078, category: 'Station', platforms: 2 },
  { code: 'PMP', name: 'Pimpri', km: 207.3, lng: 73.8056, lat: 18.6270, category: 'Station', platforms: 2 },
  { code: 'CWD', name: 'Chinchwad', km: 210.6, lng: 73.7918, lat: 18.6397, category: 'Station', platforms: 4 },
  { code: 'AKRD', name: 'Akurdi', km: 214.2, lng: 73.7665, lat: 18.6506, category: 'Station', platforms: 2 },
  { code: 'DEHR', name: 'Dehu Road', km: 219.8, lng: 73.7271, lat: 18.6810, category: 'Station', platforms: 2 },
  { code: 'BGWI', name: 'Begdewadi', km: 223.1, lng: 73.7090, lat: 18.7012, category: 'Station', platforms: 2 },
  { code: 'GRWD', name: 'Ghorawadi', km: 226.1, lng: 73.6962, lat: 18.7213, category: 'Station', platforms: 2 },
  { code: 'TGN', name: 'Talegaon', km: 227.4, lng: 73.6721, lat: 18.7351, category: 'Station', platforms: 2 },
  { code: 'VDN', name: 'Vadgaon', km: 233.2, lng: 73.6410, lat: 18.7480, category: 'Station', platforms: 2 },
  { code: 'KNHE', name: 'Kanhe', km: 237.2, lng: 73.5940, lat: 18.7621, category: 'Station', platforms: 2 },
  { code: 'KMST', name: 'Kamshet', km: 240.0, lng: 73.5524, lat: 18.7669, category: 'Station', platforms: 2 },
  { code: 'MVL', name: 'Malavli', km: 248.5, lng: 73.4806, lat: 18.7443, category: 'Station', platforms: 2 },
  { code: 'LNL', name: 'Lonavala', km: 254.84, lng: 73.4081, lat: 18.7493, category: 'Terminus', platforms: 3 },
];

export const CORRIDOR_SECTORS = [
  { id: 'ALL', name: 'Full Corridor (63.84 km)', kmRange: '191.0 — 254.84 km', center: [73.64, 18.65], zoom: 10.2, pitch: 35, bearing: 310 },
  { id: 'PUNE_URBAN', name: 'Pune — Dapodi Sector', kmRange: '191.0 — 201.0 km', center: [73.848, 18.545], zoom: 13.5, pitch: 40, bearing: 320 },
  { id: 'PIMPRI_CWD', name: 'Pimpri — Chinchwad Yard', kmRange: '201.0 — 214.2 km', center: [73.792, 18.628], zoom: 13.8, pitch: 45, bearing: 315 },
  { id: 'DEHU_TALEGAON', name: 'Dehu Road — Talegaon', kmRange: '214.2 — 227.4 km', center: [73.705, 18.705], zoom: 13.2, pitch: 40, bearing: 310 },
  { id: 'INDRAYANI_VALLEY', name: 'Vadgaon — Kamshet Valley', kmRange: '227.4 — 240.0 km', center: [73.595, 18.752], zoom: 13.0, pitch: 45, bearing: 300 },
  { id: 'BHOR_GHAT', name: 'Kamshet — Lonavala Ghat', kmRange: '240.0 — 254.84 km', center: [73.442, 18.753], zoom: 13.4, pitch: 55, bearing: 290 },
];

/**
 * Projects railway chainage onto the corridor alignment represented by the
 * real station sequence above. The track offset is intentionally tiny and is
 * only used to separate UP/DN/loop possession lines visually at high zoom.
 */
export const getCoordinatesForKm = (kmValue, trackId = 'PUNE-LNL-UP') => {
  const km = Number(kmValue);
  const clampedKm = Math.max(PUNE_LNL_STATIONS[0].km, Math.min(PUNE_LNL_STATIONS.at(-1).km, Number.isFinite(km) ? km : 205));
  let stnA = PUNE_LNL_STATIONS[0];
  let stnB = PUNE_LNL_STATIONS[1];

  for (let i = 0; i < PUNE_LNL_STATIONS.length - 1; i += 1) {
    if (clampedKm >= PUNE_LNL_STATIONS[i].km && clampedKm <= PUNE_LNL_STATIONS[i + 1].km) {
      stnA = PUNE_LNL_STATIONS[i];
      stnB = PUNE_LNL_STATIONS[i + 1];
      break;
    }
  }

  const segmentLength = stnB.km - stnA.km;
  const t = segmentLength > 0 ? (clampedKm - stnA.km) / segmentLength : 0;
  let lng = stnA.lng + (stnB.lng - stnA.lng) * t;
  let lat = stnA.lat + (stnB.lat - stnA.lat) * t;

  const isDn = trackId?.includes('DN');
  const isLoop = trackId?.includes('LOOP') || trackId?.includes('YARD');
  if (isDn) { lng += 0.00018; lat += 0.00012; }
  else if (isLoop) { lng -= 0.00028; lat -= 0.00020; }

  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
};
