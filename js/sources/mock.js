// Mock data source: the original hardcoded concept data, normalized.
//
// Storms are tagged provenance=SIMULATED (they are invented sample systems, not
// real observations). EMP sources (formerly "pulses") become kind=emp entities.
// This source is the offline/fallback and the honest baseline for the concept.

import { storms as rawStorms, pulses as rawPulses } from '../data.js';
import { makeStorm, makeEmp, Provenance } from '../model.js';

// Adapt one raw concept storm into a normalized simulated storm entity.
function adaptStorm(s) {
  return makeStorm({
    id: s.id,
    provenance: Provenance.SIMULATED,
    lat: s.lat,
    lng: s.lng,
    source: 'mock',
    // typed storm fields carried through
    type: s.type, cat: s.cat, ef: s.ef, wind: s.wind, pressure: s.pressure,
    speed: s.speed, heading: s.heading, intensity: s.intensity, color: s.color,
    track: s.track, proj: s.proj
  });
}

// Adapt one raw "pulse" into a normalized EMP source entity.
function adaptEmp(p) {
  return makeEmp({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    source: 'mock',
    impact: p.impact, power: p.power
  });
}

// Load returns the normalized entity set. Async to match the source interface
// (nws.js is genuinely async); resolves immediately here.
export async function load() {
  return {
    storms: rawStorms.map(adaptStorm),
    emps: rawPulses.map(adaptEmp),
    meta: { source: 'mock', fetchedAt: new Date().toISOString(), note: 'Synthetic concept data — not real weather.' }
  };
}

export const info = { id: 'mock', label: 'Mock (concept data)', real: false };
