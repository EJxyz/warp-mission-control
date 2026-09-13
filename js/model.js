// Normalized data model + provenance contract.
//
// Every object the UI renders MUST pass through this model. The UI never reads
// raw API JSON directly — source adapters (sources/*.js) translate their payloads
// into these normalized entities, so the rendering layer is decoupled from where
// data came from and can always answer: "is this real, forecast, or invented?"

// ---- Enums -----------------------------------------------------------------

// What kind of entity this is.
export const Kind = Object.freeze({
  STORM: 'storm', // a weather system (hurricane, tornado, severe storm, alert)
  EMP: 'emp'      // an electromagnetic-pulse source (fictional / user-placed)
});

// Where the data came from, semantically. This is the safety-critical field:
// observed/forecast = grounded in real NWS/NOAA data; simulated = invented.
export const Provenance = Object.freeze({
  OBSERVED: 'observed',   // real, currently-observed conditions (from NWS)
  FORECAST: 'forecast',   // real forecast/prediction (from NWS)
  SIMULATED: 'simulated'  // hypothetical / concept / user-placed — NOT real
});

// Human-readable labels + short badges for each provenance (used in UI).
export const PROVENANCE_META = Object.freeze({
  [Provenance.OBSERVED]:  { label: 'Observed',  badge: 'OBS',  color: '#37e07a' },
  [Provenance.FORECAST]:  { label: 'Forecast',  badge: 'FCST', color: '#38e0ff' },
  [Provenance.SIMULATED]: { label: 'Simulated', badge: 'SIM',  color: '#a66cff' }
});

export function isReal(provenance) {
  return provenance === Provenance.OBSERVED || provenance === Provenance.FORECAST;
}

// ---- Entity factories ------------------------------------------------------
//
// Factories enforce the required fields and stamp defaults so adapters can't
// accidentally emit an entity without provenance. Extra typed fields are passed
// through via `extra`.

const VALID_KINDS = new Set(Object.values(Kind));
const VALID_PROVENANCE = new Set(Object.values(Provenance));

function assert(cond, msg) { if (!cond) throw new Error('[model] ' + msg); }

/**
 * Create a normalized entity. All entities share this envelope.
 * @param {object} o
 * @param {string} o.id            unique id within its source
 * @param {string} o.kind          Kind.*
 * @param {string} o.provenance    Provenance.*
 * @param {number} o.lat
 * @param {number} o.lng
 * @param {string} o.source        origin tag, e.g. 'NWS', 'mock', 'user'
 * @param {object} [o.extra]       kind-specific typed fields
 */
export function makeEntity({ id, kind, provenance, lat, lng, source, extra = {} }) {
  assert(id != null, 'entity requires an id');
  assert(VALID_KINDS.has(kind), `invalid kind: ${kind}`);
  assert(VALID_PROVENANCE.has(provenance), `invalid provenance: ${provenance}`);
  assert(Number.isFinite(lat) && Number.isFinite(lng), `entity ${id} requires numeric lat/lng`);
  assert(source, `entity ${id} requires a source tag`);
  return { id, kind, provenance, lat, lng, source, ...extra };
}

/**
 * Storm entity. `extra` carries: type, cat, ef, wind, pressure, speed, heading,
 * intensity, color, track, proj (all optional depending on the source).
 */
export function makeStorm({ id, provenance, lat, lng, source, ...fields }) {
  return makeEntity({ id, kind: Kind.STORM, provenance, lat, lng, source, extra: fields });
}

/**
 * EMP source entity — always simulated. `extra` carries: impact, power, radius.
 */
export function makeEmp({ id, lat, lng, source = 'user', ...fields }) {
  return makeEntity({ id, kind: Kind.EMP, provenance: Provenance.SIMULATED, lat, lng, source, extra: fields });
}
