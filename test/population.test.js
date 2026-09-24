// Tests for the population estimator (pure geometry math + pluggable source).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  polygonAreaKm2, estimatePopulation, setPopulationSource, isPlaceholderSource,
  circleToPolygon, pointInGeometry
} from '../js/population.js';

// A ~1° x 1° box near 40°N. At that latitude 1° lng ≈ 85 km, 1° lat ≈ 111 km,
// so the area is on the order of ~9,000 km² (rough, since our estimator is coarse).
const box = {
  type: 'Polygon',
  coordinates: [[[-100, 40], [-99, 40], [-99, 41], [-100, 41], [-100, 40]]]
};

test('polygonAreaKm2 returns a plausible area for a ~1deg box', () => {
  const a = polygonAreaKm2(box);
  // Sanity band: somewhere in the thousands-of-km2 range, not zero, not absurd.
  assert.ok(a > 2000 && a < 20000, `area ${a} km2 in plausible range`);
});

test('polygonAreaKm2 handles empty / missing geometry', () => {
  assert.equal(polygonAreaKm2(null), 0);
  assert.equal(polygonAreaKm2({ type: 'Polygon', coordinates: [] }), 0);
  assert.equal(polygonAreaKm2({ type: 'Point', coordinates: [0, 0] }), 0);
});

test('placeholder estimate is positive and clearly flagged approximate', async () => {
  assert.equal(isPlaceholderSource(), true);
  const est = await estimatePopulation(box);
  assert.ok(est);
  assert.ok(est.people > 0, 'produces a positive estimate');
  assert.equal(est.approximate, true, 'flagged approximate');
  assert.match(est.method, /placeholder/);
  assert.ok(est.note && /not authoritative/i.test(est.note));
});

test('estimatePopulation returns null for unusable geometry', async () => {
  assert.equal(await estimatePopulation(null), null);
  assert.equal(await estimatePopulation({ type: 'Point', coordinates: [0, 0] }), null);
});

test('a real source can be plugged in and takes over cleanly', async () => {
  setPopulationSource(async () => ({ people: 12345, method: 'test-real', approximate: false }));
  assert.equal(isPlaceholderSource(), false);
  const est = await estimatePopulation(box);
  assert.equal(est.people, 12345);
  assert.equal(est.approximate, false);
  assert.equal(est.method, 'test-real');
  // restore placeholder for other tests / isolation
  setPopulationSource(null);
  assert.equal(isPlaceholderSource(), true);
});

test('a throwing source is caught and reported, never crashes', async () => {
  setPopulationSource(async () => { throw new Error('boom'); });
  const est = await estimatePopulation(box);
  assert.equal(est.people, null);
  assert.equal(est.method, 'error');
  setPopulationSource(null);
});


test('circleToPolygon returns a closed GeoJSON ring around the center', () => {
  const poly = circleToPolygon(40, -100, 100, 48);
  assert.equal(poly.type, 'Polygon');
  const ring = poly.coordinates[0];
  assert.ok(ring.length >= 49, 'segments + closing vertex');
  // Ring is closed (first === last).
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  // Center is inside the circle polygon; a far point is not.
  assert.equal(pointInGeometry(-100, 40, poly), true);
  assert.equal(pointInGeometry(-100, 45, poly), false);
});

test('circleToPolygon area is roughly pi*r^2 for the given radius', () => {
  const r = 100; // km
  const poly = circleToPolygon(40, -100, r);
  const area = polygonAreaKm2(poly);
  const expected = Math.PI * r * r; // ~31,416 km²
  // Within ~15% (polygon approximation + planar area estimate).
  assert.ok(Math.abs(area - expected) / expected < 0.15, `area ${Math.round(area)} vs ~${Math.round(expected)}`);
});

test('circleToPolygon rejects invalid input', () => {
  assert.equal(circleToPolygon(NaN, -100, 100), null);
  assert.equal(circleToPolygon(40, -100, 0), null);
  assert.equal(circleToPolygon(40, -100, -5), null);
});
