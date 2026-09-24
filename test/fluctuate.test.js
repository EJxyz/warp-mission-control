// Tests for playback fluctuation helpers — the critical property is that they
// NEVER mutate real (observed/forecast) data.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stepStorm, stepEmp } from '../js/fluctuate.js';
import { Provenance } from '../js/model.js';

test('stepStorm fluctuates a simulated storm within wind bounds', () => {
  const s = { provenance: Provenance.SIMULATED, type: 'Hurricane', wind: 120, cat: 'CAT 3' };
  // Force a large upward nudge (rand ~1 => +max).
  const changed = stepStorm(s, 1, () => 1);
  assert.equal(changed, true);
  assert.ok(s.wind >= 20 && s.wind <= 220, 'wind stays in bounds');
  assert.ok(s.wind > 120, 'rand=1 pushes wind up');
});

test('stepStorm keeps class coherent with wind (hurricane)', () => {
  const s = { provenance: Provenance.SIMULATED, type: 'Hurricane', wind: 100, cat: 'CAT 2' };
  // Drive wind low so it should drop to Tropical Storm class.
  for (let i = 0; i < 60; i++) stepStorm(s, 3, () => 0); // rand=0 => -max each time
  assert.equal(s.wind, 20, 'wind floored at bound');
  assert.equal(s.cat, 'TS', 'class re-labeled to match low wind');
});

test('stepStorm re-labels tornado EF class from wind', () => {
  const s = { provenance: Provenance.SIMULATED, type: 'Tornado', wind: 90, cat: 'EF1' };
  for (let i = 0; i < 60; i++) stepStorm(s, 3, () => 1); // push wind up
  assert.ok(/^EF[0-5]$/.test(s.cat), 'has an EF class');
  assert.ok(s.wind > 90);
});

test('stepStorm NEVER mutates a real (observed) storm', () => {
  const s = { provenance: Provenance.OBSERVED, type: 'Tornado', wind: 130, cat: 'Extreme' };
  const before = { ...s };
  const changed = stepStorm(s, 5, () => 1);
  assert.equal(changed, false);
  assert.deepEqual(s, before, 'real storm untouched');
});

test('stepStorm NEVER mutates a real (forecast) storm', () => {
  const s = { provenance: Provenance.FORECAST, type: 'Hurricane', wind: 90, cat: 'CAT 1' };
  const before = { ...s };
  stepStorm(s, 5, () => 0);
  assert.deepEqual(s, before);
});

test('stepStorm ignores storms without a numeric wind (e.g. NWS alerts)', () => {
  const s = { provenance: Provenance.SIMULATED, type: 'Storm', cat: 'Severe' }; // no wind
  assert.equal(stepStorm(s, 1, () => 1), false);
  assert.equal(s.wind, undefined);
});

test('stepEmp fluctuates a simulated EMP impact within [1,99]', () => {
  const p = { provenance: Provenance.SIMULATED, impact: 60 };
  stepEmp(p, 1, () => 1);
  assert.ok(p.impact >= 1 && p.impact <= 99);
  // Clamp at ceiling.
  const hi = { provenance: Provenance.SIMULATED, impact: 98 };
  for (let i = 0; i < 20; i++) stepEmp(hi, 3, () => 1);
  assert.equal(hi.impact, 99);
});

test('stepEmp never mutates a non-simulated entity', () => {
  const p = { provenance: Provenance.OBSERVED, impact: 50 };
  assert.equal(stepEmp(p, 1, () => 1), false);
  assert.equal(p.impact, 50);
});
