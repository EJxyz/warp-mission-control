// Tests for the situation-report builder (pure function).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReportHtml } from '../js/report.js';

const FIXED = '2026-09-14T12:00:00Z';

// A small appData with one real alert (with cached exposure), one simulated
// storm, and one EMP source.
function sampleData() {
  return {
    storms: [
      {
        id: 'NWS-1', provenance: 'observed', event: 'Tornado Warning', type: 'Tornado',
        severity: 'Extreme', urgency: 'Immediate', certainty: 'Observed',
        areaDesc: 'Cleveland County, OK', headline: 'Tornado Warning until 8:45 PM',
        color: '#ff4b4b', lat: 35.2, lng: -97.4,
        _popEstimate: { people: 123456, approximate: true },
        _facilities: { source: 'OpenStreetMap', summary: { total: 3, byType: { hospital: 1, school: 2 }, breakdown: [
          { type: 'hospital', label: 'Hospital', count: 1 }, { type: 'school', label: 'School', count: 2 }
        ] } }
      },
      { id: 'SIM-1', provenance: 'simulated', type: 'Hurricane', severity: 'Severe', color: '#20bfff', lat: 29, lng: -90 }
    ],
    emps: [{ id: 'P1', provenance: 'simulated', lat: 34, lng: -113 }],
    meta: { mode: 'nws', degraded: false, partial: false }
  };
}

test('buildReportHtml returns a complete standalone HTML document', () => {
  const html = buildReportHtml(sampleData(), { now: FIXED });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<style>/); // self-contained styling
});

test('report includes the life-safety disclaimer and timestamp', () => {
  const html = buildReportHtml(sampleData(), { now: FIXED });
  assert.match(html, /not an official warning system/i);
  assert.match(html, /2026-09-14 12:00:00 UTC/);
});

test('report shows data source and real/simulated counts', () => {
  const html = buildReportHtml(sampleData(), { now: FIXED });
  assert.match(html, /Live NWS/);
  assert.match(html, /1 real/);
  assert.match(html, /1 simulated/);
  assert.match(html, /EMP sources<\/b> 1/);
});

test('report lists the real alert with estimated people (labeled) and facilities', () => {
  const html = buildReportHtml(sampleData(), { now: FIXED });
  assert.match(html, /NWS-1/);
  assert.match(html, /Tornado Warning/);
  assert.match(html, /≈ 123,456 \(estimated\)/); // people labeled estimated
  assert.match(html, /1 × Hospital/);
  assert.match(html, /2 × School/);
});

test('report escapes untrusted alert text (no raw injection)', () => {
  const d = sampleData();
  d.storms[0].headline = 'Danger <script>alert(1)</script>';
  const html = buildReportHtml(d, { now: FIXED });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script must be escaped');
  assert.match(html, /&lt;script&gt;/);
});

test('report handles empty / mock data gracefully', () => {
  const html = buildReportHtml({ storms: [], emps: [], meta: { mode: 'mock' } }, { now: FIXED });
  assert.match(html, /Concept \(mock\)/);
  assert.match(html, /No live \(observed\/forecast\) alerts/);
  assert.match(html, /not an official warning system/i);
});

test('degraded data source is surfaced in the report', () => {
  const d = sampleData();
  d.meta = { mode: 'nws', degraded: true, error: 'network' };
  const html = buildReportHtml(d, { now: FIXED });
  assert.match(html, /DEGRADED/);
});
