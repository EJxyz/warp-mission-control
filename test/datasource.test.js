// Tests for the data source manager's merge / partial / fallback behavior.
// Mocks global fetch so no real network is used.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { load } from '../js/datasource.js';
import { Provenance } from '../js/model.js';

const here = dirname(fileURLToPath(import.meta.url));
const fx = f => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));

// Build a NWS FeatureCollection carrying one storm alert (Tornado Warning).
const nwsCollection = { type: 'FeatureCollection', features: [fx('nws-tornado-warning.json').feature] };
const nhcPayload = fx('nhc-currentstorms.json').data; // { activeStorms: [...] }

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Helper to build a fake Response.
function res(body, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

// Install a fetch mock routed by URL substring. `routes` maps substring -> handler().
function mockFetch(routes) {
  globalThis.fetch = (url) => {
    const u = String(url);
    for (const [needle, handler] of Object.entries(routes)) {
      if (u.includes(needle)) return handler();
    }
    return Promise.reject(new Error('unrouted url: ' + u));
  };
}

test('mock mode returns simulated concept data (no fetch)', async () => {
  let called = false;
  globalThis.fetch = () => { called = true; return res({}); };
  const r = await load('mock');
  assert.equal(called, false, 'mock mode must not hit the network');
  assert.equal(r.meta.mode, 'mock');
  assert.equal(r.meta.degraded, false);
  assert.ok(r.storms.length > 0 && r.emps.length > 0);
  assert.ok(r.storms.every(s => s.provenance === Provenance.SIMULATED));
});

test('nws mode uses NWS only by default and parks NHC (no proxy)', async () => {
  let nhcHit = false;
  mockFetch({
    'api.weather.gov': () => res(nwsCollection),
    'CurrentStorms.json': () => { nhcHit = true; return res(nhcPayload); }
  });
  const r = await load('nws'); // no nhcProxyUrl
  assert.equal(nhcHit, false, 'NHC must NOT be fetched without a proxy');
  assert.equal(r.meta.mode, 'nws');
  assert.equal(r.meta.degraded, false);
  assert.equal(r.meta.partial, false, 'parked NHC is not a partial failure');
  assert.equal(r.emps.length, 0, 'nws mode omits simulated EMPs');
  assert.ok(r.storms.every(s => s.source === 'NWS'), 'only NWS storms');
  assert.ok(r.meta.sources.nhc && r.meta.sources.nhc.parked, 'NHC reported as parked');
  assert.equal(r.meta.source, 'NWS');
});

test('nws mode includes NHC when a proxy URL is supplied', async () => {
  mockFetch({
    'api.weather.gov': () => res(nwsCollection),
    'my-proxy': () => res(nhcPayload)
  });
  const r = await load('nws', { nhcProxyUrl: 'https://my-proxy.example/CurrentStorms.json' });
  assert.equal(r.meta.degraded, false);
  assert.equal(r.meta.partial, false);
  const sources = new Set(r.storms.map(s => s.source));
  assert.ok(sources.has('NWS') && sources.has('NHC'), 'storms from both sources via proxy');
  assert.equal(r.meta.source, 'NWS+NHC');
  assert.ok(!r.meta.sources.nhc.parked, 'NHC not parked when proxied');
});

test('both mode = live NWS storms + simulated EMP sources (NHC parked)', async () => {
  mockFetch({ 'api.weather.gov': () => res(nwsCollection) });
  const r = await load('both');
  assert.equal(r.meta.mode, 'both');
  assert.ok(r.storms.length >= 1 && r.storms.every(s => s.source === 'NWS'));
  assert.ok(r.emps.length > 0 && r.emps.every(e => e.provenance === Provenance.SIMULATED));
});

test('partial: NHC proxy fails but NWS still provides data', async () => {
  mockFetch({
    'api.weather.gov': () => res(nwsCollection),
    'my-proxy': () => Promise.reject(new Error('proxy down'))
  });
  const r = await load('nws', { nhcProxyUrl: 'https://my-proxy.example/CurrentStorms.json' });
  assert.equal(r.meta.degraded, false, 'not degraded — NWS still live');
  assert.equal(r.meta.partial, true, 'flagged partial (attempted NHC failed)');
  assert.ok(r.storms.every(s => s.source === 'NWS'));
  assert.ok(r.meta.sources.nhc.error, 'records the NHC failure reason');
});

test('NWS failure with NHC parked -> falls back to mock (degraded)', async () => {
  mockFetch({ 'api.weather.gov': () => res(null, false, 500) });
  const r = await load('nws');
  assert.equal(r.meta.degraded, true);
  assert.ok(r.meta.error, 'carries an error reason');
  assert.ok(r.storms.length > 0 && r.storms.every(s => s.provenance === Provenance.SIMULATED));
});

test('unknown mode falls back to mock safely', async () => {
  const r = await load('bogus');
  assert.equal(r.meta.degraded, true);
  assert.ok(r.storms.length > 0);
});
