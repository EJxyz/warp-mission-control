// Population-in-harm's-way estimation — pluggable source interface.
//
// PURPOSE: given an alert's warning-area polygon, estimate how many people are
// inside it. This is the life-safety signal that turns "a warning polygon" into
// "≈ N people at risk here".
//
// ⚠️ HONESTY CONTRACT — READ THIS:
// The DEFAULT estimator here is a coarse PLACEHOLDER. It multiplies the polygon's
// geographic area by a rough regional population-density guess. It does NOT know
// where people actually live (cities vs. empty desert), so its numbers are
// order-of-magnitude at best and MUST be presented as "estimated / approximate /
// not authoritative". It exists so the feature is usable today without a backend,
// and so a REAL source can replace it behind the same interface with zero UI churn.
//
// A real estimator (future) should use a gridded population raster (WorldPop /
// NASA SEDAC GPWv4) or census block-group intersection, summing actual people in
// the polygon. Register it with setPopulationSource() and the app upgrades cleanly.
//
// INTERFACE: a population source is `async (geometry) => { people, method, approximate, ... }`.

// ---- Geometry helpers ------------------------------------------------------

// Polygon area in square kilometers using the spherical-excess-free planar
// approximation on an equirectangular projection scaled by latitude. Good enough
// for a coarse estimate at alert-polygon scale (tens of km).
export function polygonAreaKm2(geometry) {
  if (!geometry) return 0;
  const rings = ringsOf(geometry);
  if (!rings.length) return 0;
  const R = 6371; // Earth radius km
  let total = 0;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) continue;
    // Shoelace in radians, converted to area on a sphere (approx).
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      const x1 = (lng1 * Math.PI / 180) * Math.cos(lat1 * Math.PI / 180);
      const y1 = lat1 * Math.PI / 180;
      const x2 = (lng2 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
      const y2 = lat2 * Math.PI / 180;
      sum += (x1 * y2 - x2 * y1);
    }
    total += Math.abs(sum) / 2 * R * R;
  }
  return total;
}

// Extract polygon rings (arrays of [lng,lat]) from Polygon / MultiPolygon.
function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates || [];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
  return [];
}

// Representative latitude of a geometry (mean of first ring) — used to pick a
// coarse density band for the placeholder.
function repLat(geometry) {
  const rings = ringsOf(geometry);
  const ring = rings[0];
  if (!Array.isArray(ring) || !ring.length) return 40;
  let s = 0, n = 0;
  for (const c of ring) { if (Array.isArray(c) && Number.isFinite(c[1])) { s += c[1]; n++; } }
  return n ? s / n : 40;
}

// ---- Placeholder estimator -------------------------------------------------

// VERY coarse average population density (people per km²) for the CONUS as a
// single number. This is intentionally simple and intentionally labeled
// approximate — it is NOT spatially aware. (US average land density ~ 40/km².)
const PLACEHOLDER_DENSITY_PER_KM2 = 40;

async function placeholderSource(geometry) {
  const areaKm2 = polygonAreaKm2(geometry);
  const people = Math.round(areaKm2 * PLACEHOLDER_DENSITY_PER_KM2);
  return {
    people,
    areaKm2: Math.round(areaKm2),
    method: 'placeholder-uniform-density',
    approximate: true,
    note: 'Rough order-of-magnitude estimate (area × average US density). Not spatially aware; not authoritative.'
  };
}

// ---- Pluggable registry ----------------------------------------------------

let activeSource = placeholderSource;

/** Replace the population source (e.g. a real gridded/census-backed estimator). */
export function setPopulationSource(fn) {
  activeSource = typeof fn === 'function' ? fn : placeholderSource;
}

/** Whether the active source is the coarse placeholder (UI can warn accordingly). */
export function isPlaceholderSource() {
  return activeSource === placeholderSource;
}

/**
 * Estimate the population inside a warning-area polygon.
 * @param {object} geometry  GeoJSON Polygon/MultiPolygon
 * @returns {Promise<{people:number, method:string, approximate:boolean, areaKm2?:number, note?:string}|null>}
 *          null when there is no usable geometry.
 */
export async function estimatePopulation(geometry) {
  if (!geometry || !ringsOf(geometry).length) return null;
  try {
    return await activeSource(geometry);
  } catch (err) {
    return { people: null, method: 'error', approximate: true, note: 'Population estimate failed: ' + (err.message || err) };
  }
}
