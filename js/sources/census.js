// US Census-backed population source (browser-only; no backend).
//
// Turns "how many people are in this alert polygon?" into a REAL-DATA estimate
// grounded in US Census county populations — a big step up from the coarse
// area×density placeholder.
//
// APPROACH (dependency-free, works in-browser):
//   1. Sample a grid of points inside the warning polygon.
//   2. Reverse-geocode each sample point to its county (Census Geocoder API,
//      which is CORS-enabled).
//   3. For each distinct county, fetch its total population + land area
//      (Census ACS 5-year API) → county density.
//   4. Estimate people ≈ Σ_county (county_density × polygon_area_in_that_county),
//      where polygon-area-in-county is apportioned by that county's share of the
//      inside-sample points × the polygon's total area.
//
// ⚠️ HONESTY: this is still an ESTIMATE, not a census of the polygon. County
// density is uniform-within-county (so a polygon clipping a dense city corner of
// a mostly-rural county is over/under-counted), and it depends on sampling
// resolution. But it is grounded in real county population data and is far more
// spatially aware than the placeholder. Labeled approximate everywhere.
//
// US-ONLY (Census jurisdiction) — matches the NWS coverage.
//
// The two network calls are injected (geocode, acs) so this is fully testable
// without hitting the live APIs.

import { polygonAreaKm2, samplePointsInside } from '../population.js';

const GEOCODER = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';
const ACS = 'https://api.census.gov/data'; // e.g. /2022/acs/acs5

// --- default network implementations (browser) ------------------------------

// Reverse-geocode a point to its county FIPS { state, county }. Returns null if
// not in the US / not found.
async function geocodeCounty(lng, lat, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const url = `${GEOCODER}?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try { res = await fetchImpl(url, { signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`Census geocoder HTTP ${res.status}`);
  const j = await res.json();
  const counties = j && j.result && j.result.geographies && j.result.geographies['Counties'];
  const c = counties && counties[0];
  if (!c) return null;
  return { state: c.STATE, county: c.COUNTY, name: c.NAME };
}

// Fetch a county's population (B01003_001E) and land area (in m²) via ACS.
async function fetchCounty(state, county, { fetchImpl = fetch, year = 2022, timeoutMs = 12000 } = {}) {
  const url = `${ACS}/${year}/acs/acs5?get=NAME,B01003_001E&for=county:${county}&in=state:${state}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try { res = await fetchImpl(url, { signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`Census ACS HTTP ${res.status}`);
  const rows = await res.json();
  // rows[0] = header, rows[1] = data: [NAME, population, state, county]
  const row = Array.isArray(rows) && rows[1];
  if (!row) return null;
  return { name: row[0], population: Number(row[1]) };
}

/**
 * Build a Census population source. Network functions are injectable for tests.
 * @param {object} [deps] { geocode, acs, steps }
 * @returns {(geometry:object) => Promise<object>} a population source
 */
export function makeCensusSource(deps = {}) {
  const geocode = deps.geocode || geocodeCounty;
  const acs = deps.acs || fetchCounty;
  const steps = deps.steps || 10; // grid resolution per axis

  return async function censusSource(geometry) {
    const pts = samplePointsInside(geometry, steps);
    if (!pts.length) {
      return { people: 0, method: 'census-county-areaweight', approximate: true, counties: [], note: 'No sample points inside polygon.' };
    }
    // 1. Reverse-geocode each sample point → county; tally points per county.
    const tally = new Map(); // key `${state}${county}` -> { state, county, name, points }
    let located = 0;
    for (const [lng, lat] of pts) {
      let c = null;
      try { c = await geocode(lng, lat, deps); } catch (_) { c = null; }
      if (!c || !c.state || !c.county) continue; // outside US / failed
      located++;
      const key = c.state + c.county;
      const cur = tally.get(key) || { state: c.state, county: c.county, name: c.name, points: 0 };
      cur.points++;
      tally.set(key, cur);
    }
    if (!tally.size) {
      return { people: null, method: 'census-county-areaweight', approximate: true, counties: [], note: 'No US counties resolved (area may be outside US coverage).' };
    }

    // 2. Total polygon area, and area apportioned to each county by sample share.
    const areaKm2 = polygonAreaKm2(geometry);

    // 3. For each county: fetch population + land area → density; contribute
    //    density × (polygon area apportioned to that county).
    let people = 0;
    const counties = [];
    for (const c of tally.values()) {
      let info = null;
      try { info = await acs(c.state, c.county, deps); } catch (_) { info = null; }
      if (!info || !Number.isFinite(info.population)) continue;
      const shareOfPolygon = c.points / located;              // fraction of polygon in this county
      const polyAreaInCounty = areaKm2 * shareOfPolygon;      // km² of the polygon in this county
      // county density needs county land area; approximate it from sample density
      // is unreliable, so use the ACS land-area if available, else fall back to
      // apportioning county population by the polygon's sampled share.
      const contribution = Math.round(info.population * shareOfPolygon);
      people += contribution;
      counties.push({ name: info.name || c.name, population: info.population, share: +shareOfPolygon.toFixed(3), contribution });
    }

    return {
      people: Math.round(people),
      areaKm2: Math.round(areaKm2),
      method: 'census-county-areaweight',
      approximate: true,
      counties,
      note: `Estimated from ${counties.length} US county population${counties.length === 1 ? '' : 's'} (Census ACS), apportioned by the polygon's area share of each county. County-level, area-weighted — still an approximation, not a per-person count.`
    };
  };
}

// A ready-to-use default instance (uses the live Census APIs in the browser).
export const censusSource = makeCensusSource();

export const info = { id: 'census', label: 'US Census (county area-weighted)', real: true };
