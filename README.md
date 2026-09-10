# WARP Mission Control

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-20bfff?logo=github)](https://ejxyz.github.io/warp-mission-control/)

**Weather Anomalies Research Platform — Hybrid Color Build**

🔗 **Live demo:** https://ejxyz.github.io/warp-mission-control/

A browser-based mission-control dashboard concept for visualizing simulated
weather anomalies (hurricanes, tornadoes) and hypothetical "pulse" energy sources across
North America.

> ⚠️ **Concept / simulation only.** All storms, tracks, forecast cones, and "pulse" sources
> are synthetic sample data for demonstration. This is not a source of real weather data or
> forecasts.

## Features

- 🗺️ **Interactive map** (Leaflet + ArcGIS satellite/reference basemaps) with country and state labels
- 🌀 **Animated storm markers** for hurricanes and tornadoes, with historical tracks and forecast cones
- 📊 **Live charts** (Chart.js): intensity-over-time and pulse-impact
- ⚡ **Pulse fields**, lightning, cloud overlay, and a "Tornado Alley" region
- ⏱️ **Timeline playback** with play/pause/step and adjustable simulation speed
- 🎛️ **Layer manager**, **scenario manager**, and **pulse manager** side panels
- 🪟 Modal workspaces for GIS, Simulation, Pulse Lab, Analytics, Scenarios, 3D viewer, and reports

## Running it

The app is built from **ES modules**, so it must be served over HTTP — opening
`index.html` directly via `file://` will not work (module requests are blocked by CORS).

```bash
# serve locally, then visit http://localhost:8000
python3 -m http.server 8000
```

An internet connection is required — the map tiles, US-state borders GeoJSON, and the
Leaflet / Chart.js libraries are loaded from CDNs at runtime.

## Project structure

```
index.html      # markup + CDN <script>/<link> tags, loads js/main.js as a module
styles.css      # all styles
js/
  main.js       # entry point — initializes modules in dependency order
  data.js       # static concept data (storms, pulses) + SVG icons
  state.js      # shared mutable runtime state (sim flags, layers, refs)
  modal.js      # accessible modal dialog (focus trap, Escape, ARIA)
  details.js    # storm / pulse / state detail modals
  charts.js     # deck charts (intensity, pulse impact) + shared axis config
  panels.js     # storm list, mission summary, pulse manager, imagery thumbs
  map.js        # Leaflet map, markers, tracks, cones, lightning, layer toggles
  timeline.js   # playback clock, animation loop, transport controls
  workspaces.js # full-panel tab workspaces (GIS / Simulation / Pulse Lab / ...)
  nav.js        # nav tablist, footer mode strip, scenario buttons
```

## Tech

- [Leaflet 1.9.4](https://leafletjs.com/) — mapping
- [Chart.js 4.4.1](https://www.chartjs.org/) — charts
- Vanilla HTML/CSS/JS ES modules — no build step
