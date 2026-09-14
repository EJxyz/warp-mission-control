// Tests for the critical-facilities module (geometry + Overpass parsing + registry).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pointInGeometry, bboxOf, filterInside, parseOverpass, summarize,
  facilitiesInArea, setFacilitiesSource, isOsmSource, FACILITY_TYPES
} from '../js/facilities.js';

// A square polygon covering roughly -100..-99 lng, 40..41 lat.
const square = {
  type: 'Polygon',
  coordinates: [[[-100, 40], [-99, 40], [-99, 41], [-100, 41], [-100, 40]]]
};

test('pointInGeometry: inside vs outside a polygon', () => {
  assert.equal(pointInGeometry(-99.5, 40.5, square), true, 'center is inside');
  assert.equal(pointInGeometry(-98.0, 40.5, square), false, 'east of box is outside');
  assert.equal(pointInGeometry(-99.5, 42.0, square), false, 'north of box is outside');
  assert.equal(pointInGeometry(NaN, 40.5, square), false, 'NaN is not inside');
});

test('pointInGeometry supports MultiPolygon', () => {
  const multi = { type: 'MultiPolygon', coordinates: [square.coordinates, [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] };
  assert.equal(pointInGeometry(-99.5, 40.5, multi), true);
  assert.equal(pointInGeometry(0.5, 0.5, multi), true);
  assert.equal(pointInGeometry(5, 5, multi), false);
});

test('bboxOf returns [south, west, north, east]', () => {
  assert.deepEqual(bboxOf(square), [40, -100, 41, -99]);
  assert.equal(bboxOf(null), null);
});

test('parseOverpass normalizes nodes and ways (center) and drops untyped', () => {
  const json = {
    elements: [
      { type: 'node', id: 1, lat: 40.5, lon: -99.5, tags: { amenity: 'hospital', name: 'Mercy' } },
      { type: 'way', id: 2, center: { lat: 40.6, lon: -99.4 }, tags: { amenity: 'school', name: 'Central High' } },
      { type: 'node', id: 3, lat: 40.7, lon: -99.3, tags: { amenity: 'cafe', name: 'Not critical' } }, // dropped
      { type: 'node', id: 4, lat: 40.8, lon: -99.2, tags: { amenity: 'nursing_home', name: 'Sunset Care' } }
    ]
  };
  const facs = parseOverpass(json);
  assert.equal(facs.length, 3, 'cafe dropped; 3 critical facilities kept');
  const byType = Object.fromEntries(facs.map(f => [f.type, f]));
  assert.equal(byType.hospital.name, 'Mercy');
  assert.equal(byType.school.lat, 40.6); // way center used
  assert.equal(byType.care.label, 'Care / nursing home');
  facs.forEach(f => assert.match(f.id, /^(node|way)\/\d+$/));
});

test('filterInside keeps only facilities inside the polygon', () => {
  const facs = [
    { id: 'node/1', type: 'hospital', lat: 40.5, lng: -99.5 }, // inside
    { id: 'node/2', type: 'school', lat: 40.5, lng: -98.0 }    // outside (bbox neighbor)
  ];
  const inside = filterInside(facs, square);
  assert.equal(inside.length, 1);
  assert.equal(inside[0].id, 'node/1');
});

test('summarize produces total, byType and ordered breakdown', () => {
  const facs = [
    { type: 'hospital' }, { type: 'hospital' }, { type: 'school' }, { type: 'care' }
  ];
  const s = summarize(facs);
  assert.equal(s.total, 4);
  assert.equal(s.byType.hospital, 2);
  // breakdown ordered per FACILITY_TYPES, only non-zero
  assert.deepEqual(s.breakdown.map(b => b.type), ['hospital', 'school', 'care']);
  assert.equal(s.breakdown[0].label, 'Hospital');
});

test('facilitiesInArea uses the active source, filters inside, and summarizes', async () => {
  // Plug a fake source returning one inside + one outside facility.
  setFacilitiesSource(async () => ([
    { id: 'node/1', type: 'hospital', label: 'Hospital', name: 'A', lat: 40.5, lng: -99.5 },
    { id: 'node/2', type: 'school', label: 'School', name: 'B', lat: 40.5, lng: -90.0 }
  ]));
  assert.equal(isOsmSource(), false);
  const res = await facilitiesInArea(square);
  assert.equal(res.facilities.length, 1, 'only the inside facility remains');
  assert.equal(res.summary.total, 1);
  assert.equal(res.source, 'custom');
  assert.equal(res.approximate, false, 'custom source not flagged OSM-approximate');
  setFacilitiesSource(null); // restore default
  assert.equal(isOsmSource(), true);
});

test('facilitiesInArea returns null for unusable geometry', async () => {
  assert.equal(await facilitiesInArea(null), null);
  assert.equal(await facilitiesInArea({ type: 'Point', coordinates: [0, 0] }), null);
});

test('FACILITY_TYPES includes the requested life-safety set incl. care homes', () => {
  const types = FACILITY_TYPES.map(f => f.type);
  for (const t of ['hospital', 'school', 'fire', 'police', 'shelter', 'care']) {
    assert.ok(types.includes(t), `missing facility type: ${t}`);
  }
});
