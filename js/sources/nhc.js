// NHC (National Hurricane Center) source adapter.
//
// Reads https://www.nhc.noaa.gov/CurrentStorms.json — a small JSON index of
// active tropical cyclones — and adapts each into a normalized OBSERVED storm
// entity (real, live position + intensity + motion).
//
// Verified against a real CurrentStorms.json (Sep 2026): each storm has
// id, name, classification (TD|TS|HU|...), intensity (kt, string), pressure,
// latitudeNumeric, longitudeNumeric, movementDir (deg), movementSpeed (kt),
// lastUpdate, and links (publicAdvisory, forecastTrack, trackCone, ...).
//
// TRACKS — important honesty note:
// The official forecast track/cone are only offered as KMZ/shapefile, and NHC
// serves those files WITHOUT CORS headers (verified: no Access-Control-Allow-Origin),
// so a browser cannot fetch them from a static site. Rather than add a backend or
// a third-party proxy, this adapter SYNTHESIZES an APPROXIMATE forward track from
// the reported motion vector (movementDir + movementSpeed). It is clearly tagged
// `trackApprox: true` and provenance FORECAST — it is NOT the official NHC cone.
// A real-cone source can be slotted in later behind the same entity shape.

import { makeStorm, Provenance } from '../model.js';

const URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';

// NHC classification code → display type + label.
const CLASS = {
  TD: { type: 'Hurricane', label: 'Tropical Depression' },
  TS: { type: 'Hurricane', label: 'Tropical Storm' },
  HU: { type: 'Hurricane', label: 'Hurricane' },
  STD: { type: 'Hurricane', label: 'Subtropical Depression' },
  STS: { type: 'Hurricane', label: 'Subtropical Storm' },
  PTC: { type: 'Hurricane', label: 'Potential Tropical Cyclone' },
  TY: { type: 'Hurricane', label: 'Typhoon' },
  HR: { type: 'Hurricane', label: 'Hurricane' }
};

const KT_TO_MPH = 1.15078;

// Saffir–Simpson-ish category label + color from sustained wind (mph).
function categorize(classification, mph) {
  if (classification === 'TD') return { cat: 'TD', color: '#38e0ff' };
  if (classification === 'TS') return { cat: 'TS', color: '#37e07a' };
  if (mph >= 157) return { cat: 'CAT 5', color: '#ff2b2b' };
  if (mph >= 130) return { cat: 'CAT 4', color: '#ff4b4b' };
  if (mph >= 111) return { cat: 'CAT 3', color: '#ff9e2f' };
  if (mph >= 96)  return { cat: 'CAT 2', color: '#ffd64a' };
  if (mph >= 74)  return { cat: 'CAT 1', color: '#ffe58a' };
  return { cat: classification || '—', color: '#38e0ff' };
}

// Project an approximate forward track from a motion vector.
// dir = compass degrees the storm is moving TOWARD; speed in knots.
// Returns an array of [lat, lng] points at +hours intervals.
function synthTrack(lat, lng, dirDeg, speedKt, steps = 4, hoursPerStep = 12) {
  if (!Number.isFinite(dirDeg) || !Number.isFinite(speedKt) || speedKt <= 0) return [];
  const rad = dirDeg * Math.PI / 180;
  // Displacement per step in nautical miles → degrees.
  const nm = speedKt * hoursPerStep;
  const dLat = (nm * Math.cos(rad)) / 60;               // 1° lat ≈ 60 nm
  const cosLat = Math.cos(lat * Math.PI / 180) || 1e-6;
  const dLng = (nm * Math.sin(rad)) / (60 * cosLat);    // adjust lng by latitude
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    pts.push([+(lat + dLat * i).toFixed(3), +(lng + dLng * i).toFixed(3)]);
  }
  return pts;
}

function adaptStorm(s) {
  const lat = s.latitudeNumeric, lng = s.longitudeNumeric;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const kt = parseFloat(s.intensity);
  const mph = Number.isFinite(kt) ? Math.round(kt * KT_TO_MPH) : undefined;
  const cls = CLASS[s.classification] || { type: 'Hurricane', label: s.classification || 'Tropical Cyclone' };
  const { cat, color } = categorize(s.classification, mph ?? 0);
  const pressure = Number.isFinite(parseFloat(s.pressure)) ? parseFloat(s.pressure) : undefined;
  const proj = synthTrack(lat, lng, s.movementDir, s.movementSpeed);
  return makeStorm({
    id: s.id || s.binNumber || s.name,
    // Real, currently-observed position/intensity → OBSERVED. The synthesized
    // forward path is a FORECAST approximation (see trackApprox flag below).
    provenance: Provenance.OBSERVED,
    lat: +lat.toFixed(3),
    lng: +lng.toFixed(3),
    source: 'NHC',
    type: cls.type,
    classification: s.classification,
    classLabel: cls.label,
    name: s.name,
    cat,
    wind: mph,
    pressure,
    heading: Number.isFinite(s.movementDir) ? String(s.movementDir) + '°' : undefined,
    speed: Number.isFinite(s.movementSpeed) ? Math.round(s.movementSpeed * KT_TO_MPH) : undefined,
    intensity: mph !== undefined ? Math.min(1, mph / 180) : 0.5,
    color,
    lastUpdate: s.lastUpdate,
    advisoryUrl: s.publicAdvisory && s.publicAdvisory.url,
    // Approximate forward path derived from motion — NOT the official NHC cone.
    proj,
    trackApprox: proj.length > 0
  });
}

/** Load active tropical cyclones from NHC. */
export async function load({ timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(URL, { headers: { 'Accept': 'application/json' }, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`NHC HTTP ${res.status}`);
  const data = await res.json();
  const active = Array.isArray(data.activeStorms) ? data.activeStorms : [];
  const storms = active.map(adaptStorm).filter(Boolean);
  return {
    storms,
    emps: [],
    meta: {
      source: 'NHC',
      fetchedAt: new Date().toISOString(),
      activeCount: active.length,
      mappedStorms: storms.length,
      note: 'Live NHC active tropical cyclones. Forward tracks are APPROXIMATE (derived from motion vector, not the official NHC cone).'
    }
  };
}

export const info = { id: 'nhc', label: 'NHC active cyclones (live)', real: true };
