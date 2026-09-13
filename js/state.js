// Shared mutable runtime state.
// Primitives are grouped in a single object so modules mutate the same reference
// (ES module live bindings can't be reassigned from outside the declaring module).

// Simulation flags / playback state.
export const sim = {
  selected: 'H1',
  paused: false,
  playing: false,
  speed: 1,
  missionTime: 0
};

// Map layer collections (populated by the map module).
export const layers = {
  markers: [], tracks: [], cones: [], pulses: [],
  states: null, alley: null, cloud: [], lightning: []
};

// Late-bound singletons assigned during init (Leaflet map, Chart.js instances).
export const refs = {
  map: null,
  intensityChart: null,
  pulseChart: null
};

// Normalized application data, populated by datasource.load() at startup.
// Consumers read storms/emps from here rather than importing raw data.js arrays,
// so the app is decoupled from the active source (mock / NWS / both).
// `storms` and `emps` are arrays of normalized entities (see model.js);
// they are replaced (reassigned) on reload, so read `appData.storms` freshly
// rather than caching the array reference.
export const appData = {
  storms: [],
  emps: [],
  meta: { mode: 'mock', source: 'mock', degraded: false }
};

// Active data source mode. Change + reload to switch between concept and live data.
export const config = {
  mode: 'mock' // 'mock' | 'nws' | 'both'
};
