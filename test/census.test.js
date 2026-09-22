// Tests for the US Census population source (network fns injected/mocked).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeCensusSource } from '../js/sources/census.js';

// A ~1° box near 40N (guaranteed to yield interior sample points).
const box = {
  type: 'Polygon',
  coordinates: [[[-100, 40], [-99, 40], [-99, 41], [-100, 41], [-100, 40]]]
};

// Fake geocode: western half of the box -> county A, eastern half -> county B.
function fakeGeocode(lng /*, lat */) {
  return lng < -99.5
    ? { state: '20', county: '001', name: 'County A' }
    : { state: '20', county: '002', name: 'County B' };
}

// Fake ACS: county A pop 100000, county B pop 300000.
function fakeAcs(state, county) {
  const pops = { '001': 100000, '002': 300000 };
  return { name: `County ${county}`, population: pops[county] };
}

test('census source estimates people by apportioning county pop to polygon share', async () => {
  const src = makeCensusSource({ geocode: fakeGeocode, acs: fakeAcs, steps: 10 });
  const res = await src(box);
  assert.equal(res.method, 'census-county-areaweight');
  assert.equal(res.approximate, true);
  assert.ok(res.people > 0);
  // Two counties resolved, each contributing pop × its sample share.
  assert.equal(res.counties.length, 2);
  const shareSum = res.counties.reduce((a, c) => a + c.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 0.001, 'shares sum to ~1');
  // With a symmetric split, people ≈ 0.5*100000 + 0.5*300000 = 200000 (± sampling).
  assert.ok(res.people > 150000 && res.people < 250000, `people ${res.people} near 200k`);
  assert.match(res.note, /Census ACS/);
});

test('a single-county polygon attributes ~all population share to that county', async () => {
  const src = makeCensusSource({ geocode: () => ({ state: '20', county: '005', name: 'Solo' }), acs: () => ({ name: 'Solo', population: 50000 }), steps: 8 });
  const res = await src(box);
  assert.equal(res.counties.length, 1);
  assert.equal(res.counties[0].contribution, 50000);
  assert.equal(res.people, 50000);
});

test('points outside US coverage (geocode returns null) yield an honest null estimate', async () => {
  const src = makeCensusSource({ geocode: () => null, acs: fakeAcs, steps: 6 });
  const res = await src(box);
  assert.equal(res.people, null);
  assert.match(res.note, /outside US coverage|No US counties/i);
});

test('a failing ACS lookup for a county is tolerated (that county contributes 0)', async () => {
  const src = makeCensusSource({
    geocode: fakeGeocode,
    acs: (state, county) => { if (county === '002') throw new Error('ACS down'); return { name: 'A', population: 100000 }; },
    steps: 10
  });
  const res = await src(box);
  // Only county A contributes; still returns a finite estimate, no crash.
  assert.ok(Number.isFinite(res.people));
  assert.ok(res.counties.every(c => c.name !== 'County 002'));
});

test('empty geometry yields zero people, no network calls', async () => {
  let called = 0;
  const src = makeCensusSource({ geocode: () => { called++; return null; }, acs: () => { called++; return null; }, steps: 10 });
  const res = await src({ type: 'Polygon', coordinates: [] });
  assert.equal(res.people, 0);
  assert.equal(called, 0, 'no sampling/geocoding for empty polygon');
});
