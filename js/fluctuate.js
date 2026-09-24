// Playback fluctuation helpers — evolve SIMULATED entities during a sim run.
//
// ⚠️ SAFETY INVARIANT: these functions MUST never mutate real (observed/forecast)
// data. Each guards on isReal() and returns early for real entities, so a real
// NWS/NHC storm's reported wind/class can never be made to "drift" by the sim
// clock. That boundary is the whole point of the observed-vs-simulated model.
//
// Pure (no DOM / no globals) so they're unit-testable.

import { isReal } from './model.js';

// Hurricane category thresholds by sustained wind (mph) — used to re-label a
// simulated storm's class as its wind fluctuates, so class and wind stay coherent.
function hurricaneCat(mph) {
  if (mph >= 157) return 'CAT 5';
  if (mph >= 130) return 'CAT 4';
  if (mph >= 111) return 'CAT 3';
  if (mph >= 96) return 'CAT 2';
  if (mph >= 74) return 'CAT 1';
  return 'TS';
}

// Tornado EF scale by wind (mph) — rough, for the simulated concept storms.
function tornadoEf(mph) {
  if (mph >= 200) return 'EF5';
  if (mph >= 166) return 'EF4';
  if (mph >= 136) return 'EF3';
  if (mph >= 111) return 'EF2';
  if (mph >= 86) return 'EF1';
  return 'EF0';
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Evolve one SIMULATED storm's wind + class for a playback tick. No-op for real
 * storms and for storms without a numeric wind. `rand` is injectable for tests.
 * @returns {boolean} true if the storm was mutated
 */
export function stepStorm(storm, speed = 1, rand = Math.random) {
  if (!storm || isReal(storm.provenance)) return false;
  if (!Number.isFinite(storm.wind)) return false;
  // Gentle bounded random walk on wind (± a few mph per tick, scaled by speed).
  const delta = (rand() - 0.5) * 6 * speed;
  storm.wind = Math.round(clamp(storm.wind + delta, 20, 220));
  // Keep the class label coherent with the new wind.
  if (storm.type === 'Hurricane') storm.cat = hurricaneCat(storm.wind);
  else if (storm.type === 'Tornado') storm.cat = tornadoEf(storm.wind);
  return true;
}

/**
 * Evolve one SIMULATED EMP source's impact for a playback tick. EMP is always
 * simulated, but we still guard defensively. `rand` injectable for tests.
 * @returns {boolean} true if mutated
 */
export function stepEmp(emp, speed = 1, rand = Math.random) {
  if (!emp || isReal(emp.provenance)) return false;
  if (!Number.isFinite(emp.impact)) return false;
  const delta = (rand() - 0.5) * 5 * speed;
  emp.impact = Math.round(clamp(emp.impact + delta, 1, 99));
  return true;
}
