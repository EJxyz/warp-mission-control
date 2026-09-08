# WARP Mission Control

**Weather Anomalies Research Platform — Hybrid Color Build**

A single-file, browser-based mission-control dashboard concept for visualizing simulated
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

It's a single self-contained HTML file. Just open it in a modern browser:

```bash
# option 1: open directly
open index.html          # macOS
xdg-open index.html      # Linux

# option 2: serve locally (recommended, avoids any file:// restrictions)
python3 -m http.server 8000
# then visit http://localhost:8000
```

An internet connection is required — the map tiles, US-state borders GeoJSON, and the
Leaflet / Chart.js libraries are loaded from CDNs at runtime.

## Tech

- [Leaflet 1.9.4](https://leafletjs.com/) — mapping
- [Chart.js 4.4.1](https://www.chartjs.org/) — charts
- Vanilla HTML/CSS/JS — no build step
