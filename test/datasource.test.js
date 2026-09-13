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

test('nws mode merges NWS + NHC live storms and carries no EMPs', async () => {
  mockFetch({
    'api.weather.gov': () => res(nwsCollection),
    'CurrentStorms.json': () => res(nhcPayload)
  });
  const r = await load('nws');
  assert.equal(r.meta.mode, 'nws');
  assert.equal(r.meta.degraded, false);
  assert.equal(r.meta.partial, false);
  assert.equal(r.emps.length, 0, 'nws mode omits simulated EMPs');
  const sources = new Set(r.storms.map(s => s.source));
  assert.ok(sources.has('NWS') && sources.has('NHC'), 'storms from both live sources');
  assert.ok(r.storms.every(s => s.provenance !== Provenance.SIMULATED), 'all live storms are real');
});

test('both mode = live real storms + simulated EMP sources', async () => {
  mockFetch({
    'api.weather.gov': () => res(nwsCollection),
    'CurrentStorms.json': () => res(nhcPayload)
  });
  const r = await load('both');
  assert.equal(r.meta.mode, 'both');
  assert.ok(r.storms.length >= 3, 'NWS(1) + NHC(2) storms');
  assert.ok(r.emps.length > 0 && r.emps.every(e => e.provenance === Provenance.SIMULATED));
});

test('partial: one live source fails, the other still provides data', async () => {
  mockFetch({
    'api.weather.gov': () => Promise.reject(new Error('network down')),
    'CurrentStorms.json': () => res(nhcPayload)
  });
  const r = await load('nws');
  assert.equal(r.meta.degraded, false, 'not degraded — we still have live data');
  assert.equal(r.meta.partial, true, 'flagged partial');
  assert.ok(r.storms.every(s => s.source === 'NHC'));
  assert.ok(r.meta.sources.nws.error, 'records the NWS failure reason');
});

test('both live sources fail -> falls back to mock (degraded)', async () => {
  mockFetch({
    'api.weather.gov': () => res(null, false, 500),
    'CurrentStorms.json': () => Promise.reject(new Error('dns'))
  });
  const r = await load('nws');
  assert.equal(r.meta.degraded, true);
  assert.ok(r.meta.error, 'carries an error reason');
  // fallback is the simulated concept data
  assert.ok(r.storms.length > 0 && r.storms.every(s => s.provenance === Provenance.SIMULATED));
});

test('unknown mode falls back to mock safely', async () => {
  const r = await load('bogus');
  assert.equal(r.meta.degraded, true);
  assert.ok(r.storms.length > 0);
});
