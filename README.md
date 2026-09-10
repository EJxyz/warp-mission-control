# WARP Mission Control

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-20bfff?logo=github)](https://ejxyz.github.io/warp-mission-control/)

**Weather Anomalies Research Platform — Hybrid Color Build**

🔗 **Live demo:** https://ejxyz.github.io/warp-mission-control/

A browser-based mission-control dashboard concept for visualizing simulated
weather anomalies (hurricanes, tornadoes) and hypothetical "pulse" energy sources across
North America.

> ⚠️ **Real vs. simulated data are kept strictly separate.** Storms can come from the
> live [NWS/NOAA API](https://www.weather.gov/documentation/services-web-api) (real,
> US-only) **or** from built-in concept data. **EMP (electromagnetic-pulse) sources are
> always hypothetical/simulated** — they are not real and are never sourced from NWS.
> Every object carries a provenance tag (`observed` / `forecast` / `simulated`) and
> simulated objects are visibly marked **SIM**.

## Data sources

The app loads through a source abstraction (`js/datasource.js`) with three modes:

| Mode   | Storms                                      | EMP sources        |
|--------|---------------------------------------------|--------------------|
| `mock` | built-in concept data (SIM)                 | concept data (SIM) |
| `nws`  | live **NWS alerts + NHC cyclones** (real)   | none               |
| `both` | live NWS alerts + NHC cyclones (real)       | concept data (SIM) |

Live "real weather" comes from two sources, fetched in parallel:
- **NWS active alerts** ([api.weather.gov](https://www.weather.gov/documentation/services-web-api)) — tornado/severe-thunderstorm/hurricane/etc. alerts, US-only. Warnings are tagged `observed`, watches `forecast`.
- **NHC active cyclones** ([CurrentStorms.json](https://www.nhc.noaa.gov/CurrentStorms.json)) — live tropical-cyclone position, category, intensity and motion, tagged `observed`.

> **Approximate tracks:** NHC's official forecast cone/track are only published as
> KMZ/shapefile served **without CORS headers**, so a static site can't fetch them in
> the browser. Instead, each cyclone's **forward track is *synthesized* from its reported
> motion vector** (`movementDir` + `movementSpeed`) and clearly marked *approximate — not
> the official NHC cone* (rendered faint/finely-dashed, with a note in the inspector).
> A real-cone source can slot in later behind the same entity shape (would require a proxy/backend).

If one live source fails the app uses the other (Mode shows `Live (partial)`); if both fail
it falls back to concept data (`Fallback`).

Default is `mock`. Switch at runtime from the browser console (no rebuild):

```js
WARP.setMode('nws');   // live NWS alerts (US only)
WARP.setMode('both');  // live storms + simulated EMP sources
WARP.setMode('mock');  // concept data
```

If a live fetch fails, the app **falls back to concept data** and flags the Mode
telemetry as `Fallback` rather than showing an empty/broken screen. NWS coverage is
US-only, so storms outside US jurisdiction won't appear in `nws`/`both` modes.

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
  main.js       # entry point — loads data, then initializes modules in order
  model.js      # normalized entity model + provenance contract (the data spec)
  datasource.js # source manager (mock | nws | both) with fallback on failure
  sources/
    mock.js     # built-in concept data, normalized as simulated entities
    nws.js      # api.weather.gov active-alerts adapter (observed/forecast)
    nhc.js      # NHC CurrentStorms.json adapter (live cyclones; approximate tracks)
  data.js       # raw concept data (storms, pulses) + SVG icons — mock input only
  state.js      # shared mutable runtime state (sim flags, layers, refs, appData)
  modal.js      # accessible modal dialog (focus trap, Escape, ARIA)
  details.js    # storm / EMP / state detail modals (with provenance banner)
  charts.js     # deck charts (intensity, EMP impact) + shared axis config
  panels.js     # storm list, mission summary, EMP manager, imagery thumbs
  map.js        # Leaflet map, markers, tracks, cones, lightning, layer toggles
  timeline.js   # playback clock, animation loop, transport controls
  workspaces.js # full-panel tab workspaces (GIS / Simulation / Pulse Lab / ...)
  nav.js        # nav tablist, footer mode strip, scenario buttons
```

## Tech

- [Leaflet 1.9.4](https://leafletjs.com/) — mapping
- [Chart.js 4.4.1](https://www.chartjs.org/) — charts
- Vanilla HTML/CSS/JS ES modules — no build step
