// Triage scoring — a TRANSPARENT, EXPLAINABLE prioritization aid.
//
// PURPOSE: rank active alerts so attention goes to the highest-exposure hazard
// first. This is a decision *aid*, NOT an official risk index. Every point in a
// score traces to a named factor with its own contribution, so a user can see
// exactly WHY something ranks where it does and judge it for themselves.
//
// ⚠️ HONESTY CONTRACT:
// - The score combines REAL signals (NWS severity/urgency/certainty, real facility
//   counts) with an ESTIMATED one (people-in-area, which is a labeled approximation).
//   Each factor records whether it is `real` or `estimated` so the UI can mark it.
// - The weights below are a reasonable, documented heuristic — not a validated
//   scientific model. They are exposed (WEIGHTS) so they're inspectable/tunable.
// - Absence of a high score never means "safe". This ranks what we can see.

// Component weights (max points each). Tuned so hazard severity and human/critical
// exposure all matter, with people and facilities able to dominate when large.
export const WEIGHTS = Object.freeze({
  severity: 30,   // NWS severity (Extreme..Minor)
  urgency: 15,    // NWS urgency (Immediate..Past)
  certainty: 10,  // NWS certainty (Observed..Unlikely)
  people: 30,     // estimated population in the warning area (log-scaled)
  facilities: 15  // critical facilities inside (hospitals weigh more)
});

const SEVERITY_RANK = { Extreme: 1, Severe: 0.75, Moderate: 0.5, Minor: 0.25, Unknown: 0.15 };
const URGENCY_RANK = { Immediate: 1, Expected: 0.66, Future: 0.4, Past: 0.1, Unknown: 0.2 };
const CERTAINTY_RANK = { Observed: 1, Likely: 0.75, Possible: 0.5, Unlikely: 0.2, Unknown: 0.3 };

// Facility types weighted by evacuation difficulty / vulnerability.
const FACILITY_WEIGHT = { hospital: 3, care: 3, school: 2, shelter: 1.5, police: 1, fire: 1 };

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// People → 0..1 via log scale: ~0 at 0 people, ~1 around 1,000,000.
function peopleScale(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return clamp01(Math.log10(n + 1) / 6); // log10(1e6)=6
}

// Weighted facility "load" → 0..1. A handful of hospitals/care homes should be
// meaningful; saturates so a huge school count can't dwarf everything.
function facilityScale(byType = {}) {
  let load = 0;
  for (const [type, count] of Object.entries(byType)) {
    load += (FACILITY_WEIGHT[type] || 1) * count;
  }
  return clamp01(load / 20); // ~20 weighted units saturates
}

/**
 * Score one alert. Inputs are optional; missing data simply contributes 0 and is
 * marked so (never guessed).
 * @param {object} entity           normalized storm entity (NWS fields)
 * @param {object} [exposure]
 * @param {number} [exposure.people]        estimated people in area (approx)
 * @param {object} [exposure.facilitySummary]  { total, byType } from facilities.js
 * @returns {{score:number, factors:Array<{key,label,points,max,real,detail}>}}
 */
export function scoreAlert(entity = {}, exposure = {}) {
  const factors = [];
  const add = (key, label, norm, max, real, detail) => {
    const points = Math.round(clamp01(norm) * max * 10) / 10;
    factors.push({ key, label, points, max, real, detail });
    return points;
  };

  const sev = SEVERITY_RANK[entity.severity] ?? SEVERITY_RANK.Unknown;
  const urg = URGENCY_RANK[entity.urgency] ?? URGENCY_RANK.Unknown;
  const cer = CERTAINTY_RANK[entity.certainty] ?? CERTAINTY_RANK.Unknown;

  let total = 0;
  total += add('severity', 'Severity', sev, WEIGHTS.severity, true, entity.severity || 'Unknown');
  total += add('urgency', 'Urgency', urg, WEIGHTS.urgency, true, entity.urgency || 'Unknown');
  total += add('certainty', 'Certainty', cer, WEIGHTS.certainty, true, entity.certainty || 'Unknown');

  const people = exposure.people;
  const hasPeople = Number.isFinite(people);
  total += add('people', 'People in area (est.)', peopleScale(people), WEIGHTS.people, false,
    hasPeople ? `≈ ${people.toLocaleString('en-US')}` : 'unknown');

  const fs = exposure.facilitySummary;
  const hasFac = fs && Number.isFinite(fs.total);
  total += add('facilities', 'Critical facilities', facilityScale(fs && fs.byType), WEIGHTS.facilities, true,
    hasFac ? `${fs.total}` : 'unknown');

  return { score: Math.round(total * 10) / 10, factors };
}

// Max possible score (for normalizing to a 0..100 display if desired).
export const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

// ---- Batched exposure computation ------------------------------------------

import { estimatePopulation } from './population.js';
import { facilitiesInArea } from './facilities.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Ensure population + facilities exposure is computed for every alert that has a
 * warning polygon, caching results on the entities (_popEstimate, _facilities).
 * Population is cheap (local math); facilities hit the Overpass API, so they are
 * fetched sequentially with a small delay to respect rate limits. Per-alert
 * failures are tolerated (that alert simply keeps unknown exposure).
 *
 * @param {Array} entities storm entities
 * @param {object} [opts]
 * @param {number} [opts.gapMs=350]  delay between Overpass requests
 * @param {boolean} [opts.facilities=true]  whether to fetch facilities
 * @param {function} [opts.onProgress]  (done, total) => void
 * @returns {Promise<void>}
 */
export async function computeExposure(entities = [], opts = {}) {
  const { gapMs = 350, facilities = true, onProgress } = opts;
  const targets = entities.filter(e => e.alertGeometry);
  let done = 0;

  // Population first (synchronous-ish, no network).
  for (const e of targets) {
    if (!e._popEstimate) {
      try { e._popEstimate = await estimatePopulation(e.alertGeometry); } catch (_) { /* leave unknown */ }
    }
  }

  // Facilities, throttled (Overpass). Skip ones already cached.
  if (facilities) {
    for (const e of targets) {
      if (!e._facilities) {
        try { e._facilities = await facilitiesInArea(e.alertGeometry); } catch (_) { /* leave unknown */ }
        await sleep(gapMs);
      }
      done++;
      if (onProgress) onProgress(done, targets.length);
    }
  }
}

/**
 * Rank a list of alerts by score (descending). Reads cached exposure off each
 * entity (_popEstimate, _facilities) when present.
 * @param {Array} entities
 * @returns {Array<{entity, score, factors}>}
 */
export function rankAlerts(entities = []) {
  return entities
    .map(e => {
      const exposure = {
        people: e._popEstimate ? e._popEstimate.people : undefined,
        facilitySummary: e._facilities ? e._facilities.summary : undefined
      };
      const { score, factors } = scoreAlert(e, exposure);
      return { entity: e, score, factors };
    })
    .sort((a, b) => b.score - a.score);
}
