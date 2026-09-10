// NWS / NOAA source adapter (https://www.weather.gov/documentation/services-web-api).
//
// Fetches ACTIVE ALERTS from api.weather.gov and adapts storm-relevant alerts
// into normalized OBSERVED storm entities. US-only (NWS jurisdiction).
//
// Verified against a real /alerts/active feature (Sep 2026): properties carry
// event/severity/certainty/urgency/headline/areaDesc/effective/expires/senderName
// exactly as mapped below; geometry is a GeoJSON Polygon of [lng,lat] rings.
//
// Notes / limitations:
// - `User-Agent` is a forbidden header for browser fetch(), so the custom UA we
//   pass is dropped in-browser (the browser sends its own, which NWS accepts).
//   It only takes effect in non-browser callers. We rely on Accept: application/geo+json.
// - The `limit` query param is NOT supported by /alerts/active (returns 400) — we
//   never send it and instead cap results client-side.
// - Many alerts have null geometry (they reference forecast zones, not polygons).
//   Those are skipped for map placement but could be resolved via /zones later.
// - This is alerts data, not hurricane track vectors — no synthetic track/proj here.
//   Live hurricane positions + tracks come from the NHC source (sources/nhc.js).

import { makeStorm, Provenance } from '../model.js';

const BASE = 'https://api.weather.gov';

// Alert `event` strings we treat as storm systems worth mapping.
const STORM_EVENTS = [
  'Tornado Warning', 'Tornado Watch',
  'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch',
  'Hurricane Warning', 'Hurricane Watch',
  'Tropical Storm Warning', 'Tropical Storm Watch',
  'Storm Surge Warning', 'Storm Surge Watch',
  'Special Marine Warning', 'Flash Flood Warning'
];

// Map NWS severity → a 0..1 intensity proxy + a display color.
const SEVERITY = {
  Extreme:  { intensity: 0.95, color: '#ff4b4b' },
  Severe:   { intensity: 0.78, color: '#ff9e2f' },
  Moderate: { intensity: 0.55, color: '#ffd64a' },
  Minor:    { intensity: 0.35, color: '#38e0ff' },
  Unknown:  { intensity: 0.30, color: '#a8becb' }
};

// Classify the coarse storm "type" from the event text (for icon selection).
function classifyType(event = '') {
  if (/Hurricane|Tropical|Surge/i.test(event)) return 'Hurricane';
  if (/Tornado/i.test(event)) return 'Tornado';
  return 'Storm';
}

// Compute a representative [lat, lng] from GeoJSON geometry (mean of the first
// ring's vertices). NWS coordinates are [lng, lat]. Handles Polygon, MultiPolygon
// and Point; returns null for anything unmappable (e.g. zone-only alerts).
function centroid(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  let ring = null;
  if (geometry.type === 'Polygon') ring = geometry.coordinates && geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') ring = geometry.coordinates && geometry.coordinates[0] && geometry.coordinates[0][0];
  if (!Array.isArray(ring) || !ring.length) return null;
  // GeoJSON rings are closed (last vertex duplicates the first); drop it so the
  // mean isn't skewed toward that point.
  const pts = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
    ? ring.slice(0, -1) : ring;
  let sx = 0, sy = 0, n = 0;
  for (const c of pts) {
    if (!Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    sx += c[0]; sy += c[1]; n++;
  }
  return n ? [sy / n, sx / n] : null;
}

function adaptAlert(feature, i) {
  const p = feature.properties || {};
  if (!STORM_EVENTS.includes(p.event)) return null;
  const pos = centroid(feature.geometry);
  if (!pos) return null; // no mappable geometry (zone-based alert)
  const sev = SEVERITY[p.severity] || SEVERITY.Unknown;
  return makeStorm({
    id: p.id || feature.id || `NWS-${i}`,
    // Warnings describe current conditions (observed); watches are forward-looking.
    provenance: /Watch/i.test(p.event) ? Provenance.FORECAST : Provenance.OBSERVED,
    lat: +pos[0].toFixed(3),
    lng: +pos[1].toFixed(3),
    source: 'NWS',
    type: classifyType(p.event),
    event: p.event,
    cat: p.severity || 'Unknown',
    severity: p.severity,
    certainty: p.certainty,
    urgency: p.urgency,
    messageType: p.messageType,
    headline: p.headline,
    areaDesc: p.areaDesc,
    effective: p.effective,
    onset: p.onset,
    expires: p.expires,
    ends: p.ends,
    senderName: p.senderName,
    response: p.response,
    intensity: sev.intensity,
    color: sev.color
    // NOTE: no synthetic `wind`/`pressure`/`track`/`proj` — we do not invent
    // values for real data. UI must tolerate these being undefined.
  });
}

/**
 * Load active storm-relevant alerts from NWS.
 * @param {object} [opts]
 * @param {string} [opts.area]      two-letter US state/marine code to scope results
 * @param {number} [opts.max=200]   client-side cap on mapped storms (API has no `limit`)
 * @param {number} [opts.timeoutMs=12000]
 */
export async function load({ area, max = 200, timeoutMs = 12000 } = {}) {
  const params = new URLSearchParams({ status: 'actual', message_type: 'alert' });
  if (area) params.set('area', area);
  const url = `${BASE}/alerts/active?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'Accept': 'application/geo+json'
        // NOTE: intentionally not setting User-Agent — it's a forbidden header in
        // browser fetch() and would be dropped. Browsers send their own UA, which
        // NWS accepts. (A non-browser caller may add one.)
      },
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`NWS HTTP ${res.status}`);
  const geo = await res.json();
  const features = Array.isArray(geo.features) ? geo.features : [];
  const storms = features.map(adaptAlert).filter(Boolean).slice(0, max);
  return {
    storms,
    emps: [], // NWS has no EMP concept — EMP is always simulated (see model.js)
    meta: {
      source: 'NWS',
      fetchedAt: new Date().toISOString(),
      totalAlerts: features.length,
      mappedStorms: storms.length,
      note: 'Live NWS active alerts (US only). Watches shown as forecast, warnings as observed.'
    }
  };
}

export const info = { id: 'nws', label: 'NWS active alerts (live, US)', real: true };
