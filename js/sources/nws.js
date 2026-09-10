// NWS / NOAA source adapter (https://www.weather.gov/documentation/services-web-api).
//
// Fetches ACTIVE ALERTS from api.weather.gov and adapts storm-relevant alerts
// into normalized OBSERVED storm entities. US-only (NWS jurisdiction).
//
// Notes / limitations:
// - NWS requires a User-Agent header; browsers set their own, and the API also
//   accepts a custom one. We send Accept: application/geo+json.
// - Many alerts have null geometry (they reference forecast zones, not polygons).
//   Those are skipped for map placement but could be resolved via /zones later.
// - This is alerts data, not full hurricane track vectors. Track/cone geometry
//   (NHC) is a future enhancement; observed alerts have no synthetic `proj`.

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

// Compute a representative [lat, lng] from GeoJSON geometry (centroid of the
// first ring's vertices). NWS coordinates are [lng, lat].
function centroid(geometry) {
  if (!geometry) return null;
  let ring = null;
  if (geometry.type === 'Polygon') ring = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') ring = geometry.coordinates[0] && geometry.coordinates[0][0];
  if (!ring || !ring.length) return null;
  let sx = 0, sy = 0;
  for (const [lng, lat] of ring) { sx += lng; sy += lat; }
  return [sy / ring.length, sx / ring.length];
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
    headline: p.headline,
    areaDesc: p.areaDesc,
    effective: p.effective,
    expires: p.expires,
    senderName: p.senderName,
    intensity: sev.intensity,
    color: sev.color
    // NOTE: no synthetic `wind`/`pressure`/`track`/`proj` — we do not invent
    // values for real data. UI must tolerate these being undefined.
  });
}

/**
 * Load active storm-relevant alerts from NWS.
 * @param {object} [opts]
 * @param {string} [opts.area]  two-letter US state/marine code to scope results
 * @param {number} [opts.timeoutMs=12000]
 */
export async function load({ area, timeoutMs = 12000 } = {}) {
  const params = new URLSearchParams({ status: 'actual', message_type: 'alert' });
  if (area) params.set('area', area);
  const url = `${BASE}/alerts/active?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'Accept': 'application/geo+json',
        // Identifies the client per NWS API etiquette. Replace contact as needed.
        'User-Agent': 'WARP-Mission-Control (concept demo; https://github.com/EJxyz/warp-mission-control)'
      },
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`NWS HTTP ${res.status}`);
  const geo = await res.json();
  const features = Array.isArray(geo.features) ? geo.features : [];
  const storms = features.map(adaptAlert).filter(Boolean);
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
