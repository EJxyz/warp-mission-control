// Unit tests for the NWS source transforms (pure functions, no network/DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { adaptAlert, centroid, classifyType, STORM_EVENTS } from '../js/sources/nws.js';
import { Provenance, Kind } from '../js/model.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = f => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));

const floodAdvisory = load('nws-alert-feature.json').feature;      // real, non-storm event
const tornadoWarning = load('nws-tornado-warning.json').feature;   // storm event

test('classifyType maps event text to a coarse type', () => {
  assert.equal(classifyType('Hurricane Warning'), 'Hurricane');
  assert.equal(classifyType('Tropical Storm Watch'), 'Hurricane');
  assert.equal(classifyType('Storm Surge Warning'), 'Hurricane');
  assert.equal(classifyType('Tornado Warning'), 'Tornado');
  assert.equal(classifyType('Severe Thunderstorm Warning'), 'Storm');
  assert.equal(classifyType(''), 'Storm');
});

test('centroid handles a real Polygon ring ([lng,lat] order) and drops the closed duplicate', () => {
  const c = centroid(floodAdvisory.geometry);
  assert.ok(Array.isArray(c) && c.length === 2);
  const [lat, lng] = c;
  // Webb County, TX is roughly 27.5N, -99.2W — centroid must land in that box.
  assert.ok(lat > 27.4 && lat < 27.7, `lat ${lat} in range`);
  assert.ok(lng > -99.4 && lng < -99.0, `lng ${lng} in range`);
});

test('centroid supports Point geometry and returns null for unmappable input', () => {
  assert.deepEqual(centroid({ type: 'Point', coordinates: [-100, 40] }), [40, -100]);
  assert.equal(centroid(null), null);
  assert.equal(centroid({ type: 'Polygon', coordinates: [] }), null);
  assert.equal(centroid({ type: 'GeometryCollection' }), null);
});

test('adaptAlert filters out non-storm events (real Flood Advisory)', () => {
  // The real captured feature is a Flood Advisory — not in STORM_EVENTS.
  assert.equal(adaptAlert(floodAdvisory, 0), null);
  assert.ok(!STORM_EVENTS.includes('Flood Advisory'));
});

test('adaptAlert maps a storm alert into a normalized OBSERVED storm entity', () => {
  const e = adaptAlert(tornadoWarning, 0);
  assert.ok(e, 'expected an entity');
  assert.equal(e.kind, Kind.STORM);
  assert.equal(e.provenance, Provenance.OBSERVED); // a Warning (not a Watch) is observed
  assert.equal(e.source, 'NWS');
  assert.equal(e.type, 'Tornado');
  assert.equal(e.event, 'Tornado Warning');
  assert.equal(e.severity, 'Extreme');
  assert.equal(e.senderName, 'NWS Norman OK');
  // Position from the polygon centroid, in central Oklahoma.
  assert.ok(e.lat > 35.3 && e.lat < 35.7);
  assert.ok(e.lng > -97.6 && e.lng < -97.1);
  // Real data must NOT gain invented metrics.
  assert.equal(e.wind, undefined);
  assert.equal(e.pressure, undefined);
  assert.equal(e.track, undefined);
  assert.equal(e.proj, undefined);
});

test('adaptAlert tags a Watch as FORECAST (forward-looking)', () => {
  const watch = structuredClone(tornadoWarning);
  watch.properties.event = 'Tornado Watch';
  const e = adaptAlert(watch, 0);
  assert.equal(e.provenance, Provenance.FORECAST);
});

test('adaptAlert returns null when a storm event has no mappable geometry', () => {
  const zoneOnly = structuredClone(tornadoWarning);
  zoneOnly.geometry = null;
  assert.equal(adaptAlert(zoneOnly, 0), null);
});

test('adaptAlert carries the raw warning-area geometry for polygon drawing + population', () => {
  const e = adaptAlert(tornadoWarning, 0);
  assert.ok(e.alertGeometry, 'entity carries alertGeometry');
  assert.equal(e.alertGeometry.type, 'Polygon');
  // It is the ACTUAL feature geometry, not the centroid.
  assert.deepEqual(e.alertGeometry, tornadoWarning.geometry);
  assert.ok(Array.isArray(e.alertGeometry.coordinates[0]) && e.alertGeometry.coordinates[0].length >= 4);
});
