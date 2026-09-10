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
