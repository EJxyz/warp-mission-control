// Critical-facilities exposure — pluggable source interface.
//
// PURPOSE: given an alert's warning-area polygon, find the REAL critical
// facilities (hospitals, schools, fire/police stations, emergency shelters,
// care/nursing homes) that fall INSIDE it — the "what's exposed" life-safety
// signal that complements the people-in-harm's-way estimate.
//
// DATA SOURCE: the default adapter queries the OpenStreetMap Overpass API. This
// is REAL facility data (not a placeholder), free, needs no key, and — unlike
// NHC — Overpass sends permissive CORS headers, so it works from a static site
// in the browser.
//
// ⚠️ HONESTY CONTRACT:
// OpenStreetMap completeness VARIES BY REGION (good in urban areas, patchier
// rural). So this is "best-available open data", not an exhaustive registry —
// a missing facility here does NOT mean it isn't there. The UI must label counts
// as "from OpenStreetMap; not exhaustive". An authoritative source (e.g. US HIFLD)
// can replace this via setFacilitiesSource() behind the same interface.
//
// INTERFACE: a facilities source is `async (geometry) => Facility[]`, where each
// Facility is { id, type, label, name, lat, lng }. This module then filters to
// those actually inside the polygon and summarizes by type.

// ---- Facility categories (OSM tag -> our type) -----------------------------

// Each entry: our type key, display label, and the Overpass tag filters that
// select it. Kept declarative so it's easy to extend / swap for HIFLD later.
export const FACILITY_TYPES = [
  { type: 'hospital', label: 'Hospital',       osm: [['amenity', 'hospital']] },
  { type: 'school',   label: 'School',         osm: [['amenity', 'school']] },
  { type: 'fire',     label: 'Fire station',   osm: [['amenity', 'fire_station']] },
  { type: 'police',   label: 'Police',         osm: [['amenity', 'police']] },
  { type: 'shelter',  label: 'Emergency shelter', osm: [['emergency', 'shelter'], ['amenity', 'shelter']] },
  { type: 'care',     label: 'Care / nursing home', osm: [['amenity', 'nursing_home'], ['social_facility', 'nursing_home'], ['social_facility', 'assisted_living']] }
];

const OSM_TO_TYPE = (() => {
  const m = new Map();
  for (const f of FACILITY_TYPES) for (const [k, v] of f.osm) m.set(`${k}=${v}`, f.type);
  return m;
})();

const LABEL_BY_TYPE = Object.fromEntries(FACILITY_TYPES.map(f => [f.type, f.label]));

// ---- Geometry helpers ------------------------------------------------------

export function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates || [];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
  return [];
}

// Bounding box [south, west, north, east] (lat/lng) for an Overpass query.
export function bboxOf(geometry) {
  const rings = ringsOf(geometry);
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const ring of rings) {
    for (const c of ring) {
      if (!Array.isArray(c)) continue;
      const [lng, lat] = c;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < s) s = lat; if (lat > n) n = lat;
      if (lng < w) w = lng; if (lng > e) e = lng;
    }
  }
  return Number.isFinite(s) ? [s, w, n, e] : null;
}

// Ray-casting point-in-polygon. point = [lng, lat]; ring = array of [lng, lat].
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Is [lng,lat] inside the geometry? A point counts if it's inside ANY polygon's
// outer ring. (Holes are rare in NWS alert polygons; treated as part of the area.)
export function pointInGeometry(lng, lat, geometry) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (geometry && geometry.type === 'Polygon') {
    return pointInRing(lng, lat, geometry.coordinates[0] || []);
  }
  if (geometry && geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).some(poly => pointInRing(lng, lat, poly[0] || []));
  }
  return false;
}

// Keep only facilities whose coordinates fall inside the warning polygon
// (Overpass returns everything in the bounding BOX, which is larger).
export function filterInside(facilities, geometry) {
  return facilities.filter(f => pointInGeometry(f.lng, f.lat, geometry));
}

// ---- Overpass (OpenStreetMap) source ---------------------------------------

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Build an Overpass QL query for all facility types within a bbox.
function buildQuery(bbox) {
  const [s, w, n, e] = bbox;
  const b = `(${s},${w},${n},${e})`;
  const clauses = [];
  for (const f of FACILITY_TYPES) {
    for (const [k, v] of f.osm) {
      // node + way (way -> center) so buildings-as-areas are included.
      clauses.push(`node["${k}"="${v}"]${b};`);
      clauses.push(`way["${k}"="${v}"]${b};`);
    }
  }
  return `[out:json][timeout:25];(${clauses.join('')});out center tags;`;
}

// Map one Overpass element to a normalized Facility (or null).
function adaptElement(el) {
  const tags = el.tags || {};
  // Determine our type from the matching tag.
  let type = null;
  for (const [k, v] of Object.entries(tags)) {
    const t = OSM_TO_TYPE.get(`${k}=${v}`);
    if (t) { type = t; break; }
  }
  if (!type) return null;
  const lat = el.lat ?? (el.center && el.center.lat);
  const lng = el.lon ?? (el.center && el.center.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: `${el.type}/${el.id}`,
    type,
    label: LABEL_BY_TYPE[type] || type,
    name: tags.name || LABEL_BY_TYPE[type] || 'Unnamed',
    lat: +lat, lng: +lng
  };
}

// Parse a raw Overpass JSON response into normalized facilities.
export function parseOverpass(json) {
  const els = json && Array.isArray(json.elements) ? json.elements : [];
  return els.map(adaptElement).filter(Boolean);
}

async function overpassSource(geometry, { timeoutMs = 20000 } = {}) {
  const bbox = bboxOf(geometry);
  if (!bbox) return [];
  const query = buildQuery(bbox);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return parseOverpass(await res.json());
}

// ---- Pluggable registry ----------------------------------------------------

let activeSource = overpassSource;

/** Replace the facilities source (e.g. an authoritative HIFLD-backed adapter). */
export function setFacilitiesSource(fn) {
  activeSource = typeof fn === 'function' ? fn : overpassSource;
}

/** Whether the active source is the default OpenStreetMap/Overpass adapter. */
export function isOsmSource() {
  return activeSource === overpassSource;
}

// Summarize a facility list into per-type counts + total.
export function summarize(facilities) {
  const byType = {};
  for (const f of facilities) byType[f.type] = (byType[f.type] || 0) + 1;
  return {
    total: facilities.length,
    byType,
    // Ordered, labeled breakdown for display (only non-zero types).
    breakdown: FACILITY_TYPES
      .filter(t => byType[t.type])
      .map(t => ({ type: t.type, label: t.label, count: byType[t.type] }))
  };
}

/**
 * Find critical facilities inside a warning-area polygon.
 * @param {object} geometry GeoJSON Polygon/MultiPolygon
 * @returns {Promise<{facilities:Array, summary:object, source:string, approximate:boolean, note:string}|null>}
 *          null when there's no usable geometry.
 */
export async function facilitiesInArea(geometry, opts = {}) {
  if (!geometry || !ringsOf(geometry).length) return null;
  const raw = await activeSource(geometry, opts);
  const inside = filterInside(raw, geometry);
  return {
    facilities: inside,
    summary: summarize(inside),
    source: isOsmSource() ? 'OpenStreetMap' : 'custom',
    approximate: isOsmSource(), // OSM completeness varies → treat as non-exhaustive
    note: isOsmSource()
      ? 'From OpenStreetMap (Overpass). Coverage varies by region; not exhaustive — a missing facility does not mean none is present.'
      : ''
  };
}
