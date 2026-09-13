// Unit tests for the NHC source transforms (pure functions, no network/DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { adaptStorm, synthTrack, categorize } from '../js/sources/nhc.js';
import { Provenance, Kind } from '../js/model.js';

const here = dirname(fileURLToPath(import.meta.url));
const currentStorms = JSON.parse(readFileSync(join(here, 'fixtures', 'nhc-currentstorms.json'), 'utf8')).data;
const [fourteenE, lowell] = currentStorms.activeStorms;

const KT_TO_MPH = 1.15078;

test('categorize returns TD/TS labels and Saffir–Simpson categories', () => {
  assert.equal(categorize('TD', 35).cat, 'TD');
  assert.equal(categorize('TS', 50).cat, 'TS');
  assert.equal(categorize('HU', 100).cat, 'CAT 2');
  assert.equal(categorize('HU', 160).cat, 'CAT 5');
  assert.equal(categorize('HU', 75).cat, 'CAT 1');
  // each returns a color string
  assert.match(categorize('HU', 100).color, /^#/);
});

test('synthTrack projects points along the motion vector and is empty when stationary', () => {
  const pts = synthTrack(15.7, -115.2, 285, 9, 4, 12);
  assert.equal(pts.length, 4);
  pts.forEach(p => { assert.equal(p.length, 2); assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1])); });
  // moving WNW (285°) => generally north-ish and west-ish of origin
  assert.ok(pts[0][0] > 15.7, 'latitude increases moving toward 285°');
  assert.ok(pts[0][1] < -115.2, 'longitude decreases (moves west)');
  // no motion => no synthesized track
  assert.deepEqual(synthTrack(15.7, -115.2, 285, 0), []);
  assert.deepEqual(synthTrack(15.7, -115.2, NaN, 9), []);
});

test('adaptStorm maps a real NHC cyclone into an OBSERVED storm entity (Fourteen-E)', () => {
  const e = adaptStorm(fourteenE);
  assert.ok(e);
  assert.equal(e.kind, Kind.STORM);
  assert.equal(e.provenance, Provenance.OBSERVED);
  assert.equal(e.source, 'NHC');
  assert.equal(e.type, 'Hurricane');
  assert.equal(e.name, 'Fourteen-E');
  assert.equal(e.classification, 'TD');
  assert.equal(e.cat, 'TD');
  assert.equal(e.lat, 15.7);
  assert.equal(e.lng, -115.2);
  assert.equal(e.pressure, 1006);
  // intensity 30 kt -> mph
  assert.equal(e.wind, Math.round(30 * KT_TO_MPH));
  // motion vector present -> synthesized approximate track
  assert.ok(Array.isArray(e.proj) && e.proj.length === 4);
  assert.equal(e.trackApprox, true);
  assert.equal(e.heading, '285°');
});

test('adaptStorm maps a Tropical Storm (Lowell) with correct category + mph', () => {
  const e = adaptStorm(lowell);
  assert.equal(e.cat, 'TS');
  assert.equal(e.name, 'Lowell');
  assert.equal(e.wind, Math.round(50 * KT_TO_MPH));
  assert.equal(e.pressure, 987);
  assert.equal(e.trackApprox, true);
});

test('adaptStorm returns null without numeric coordinates', () => {
  assert.equal(adaptStorm({ id: 'x', latitudeNumeric: null, longitudeNumeric: null }), null);
});

test('adaptStorm never invents a track when motion is absent (trackApprox=false)', () => {
  const still = structuredClone(fourteenE);
  still.movementSpeed = 0;
  const e = adaptStorm(still);
  assert.deepEqual(e.proj, []);
  assert.equal(e.trackApprox, false);
});
