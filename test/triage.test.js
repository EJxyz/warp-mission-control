// Tests for the triage scoring (transparent, explainable, handles missing data).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreAlert, rankAlerts, WEIGHTS, MAX_SCORE } from '../js/triage.js';

test('MAX_SCORE is the sum of component weights', () => {
  assert.equal(MAX_SCORE, Object.values(WEIGHTS).reduce((a, b) => a + b, 0));
});

test('scoreAlert returns a score and a labeled factor breakdown', () => {
  const { score, factors } = scoreAlert(
    { severity: 'Extreme', urgency: 'Immediate', certainty: 'Observed' },
    { people: 100000, facilitySummary: { total: 3, byType: { hospital: 1, school: 2 } } }
  );
  assert.ok(score > 0);
  // One factor per component, each with a max and a real/estimated flag.
  const keys = factors.map(f => f.key).sort();
  assert.deepEqual(keys, ['certainty', 'facilities', 'people', 'severity', 'urgency']);
  factors.forEach(f => {
    assert.ok(typeof f.label === 'string');
    assert.ok(f.points >= 0 && f.points <= f.max);
    assert.equal(typeof f.real, 'boolean');
  });
  // People is the estimated one; the NWS + facilities factors are real.
  assert.equal(factors.find(f => f.key === 'people').real, false);
  assert.equal(factors.find(f => f.key === 'severity').real, true);
  assert.equal(factors.find(f => f.key === 'facilities').real, true);
});

test('higher severity + more people => higher score (monotonic where expected)', () => {
  const low = scoreAlert({ severity: 'Minor', urgency: 'Expected', certainty: 'Possible' }, { people: 500 }).score;
  const high = scoreAlert({ severity: 'Extreme', urgency: 'Immediate', certainty: 'Observed' }, { people: 500000 }).score;
  assert.ok(high > low, `${high} should exceed ${low}`);
});

test('missing exposure contributes zero and is marked unknown, never guessed', () => {
  const { factors } = scoreAlert({ severity: 'Severe', urgency: 'Expected', certainty: 'Likely' }, {});
  const people = factors.find(f => f.key === 'people');
  const fac = factors.find(f => f.key === 'facilities');
  assert.equal(people.points, 0);
  assert.equal(people.detail, 'unknown');
  assert.equal(fac.points, 0);
  assert.equal(fac.detail, 'unknown');
});

test('unknown NWS fields fall back to low ranks, not crashes', () => {
  const { score } = scoreAlert({}, {});
  assert.ok(Number.isFinite(score) && score >= 0);
});

test('hospitals/care weigh more than schools in the facilities factor', () => {
  const hosp = scoreAlert({}, { facilitySummary: { total: 2, byType: { hospital: 2 } } });
  const sch = scoreAlert({}, { facilitySummary: { total: 2, byType: { school: 2 } } });
  const hp = hosp.factors.find(f => f.key === 'facilities').points;
  const sp = sch.factors.find(f => f.key === 'facilities').points;
  assert.ok(hp > sp, `hospitals (${hp}) should outweigh schools (${sp})`);
});

test('rankAlerts sorts by score descending and reads cached exposure off entities', () => {
  const a = { id: 'A', severity: 'Minor', urgency: 'Past', certainty: 'Unlikely' };
  const b = {
    id: 'B', severity: 'Extreme', urgency: 'Immediate', certainty: 'Observed',
    _popEstimate: { people: 250000 },
    _facilities: { summary: { total: 4, byType: { hospital: 2, care: 2 } } }
  };
  const ranked = rankAlerts([a, b]);
  assert.equal(ranked[0].entity.id, 'B', 'high-exposure alert ranks first');
  assert.equal(ranked[1].entity.id, 'A');
  assert.ok(ranked[0].score > ranked[1].score);
});
