# WARP Mission Control

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-20bfff?logo=github)](https://ejxyz.github.io/warp-mission-control/)

**Weather Anomalies Research Platform — Hybrid Color Build**

🔗 **Live demo:** https://ejxyz.github.io/warp-mission-control/

## Overview

WARP Mission Control is a browser-based situational-awareness dashboard that visualizes
weather anomalies and hypothetical electromagnetic-pulse (EMP) events across North America
on a single interactive map. It brings two very different kinds of information into one view
— **real, observed weather hazards** and **modeled "what-if" pulse scenarios** — so a user
can begin to reason about risk and resilience for critical infrastructure. It presents like
an operational mission-control console, but it is a concept/research build, not an
authoritative forecasting product.

Its central design principle is a **strict, enforced separation between real and simulated
data**: every object carries a provenance tag (`observed` / `forecast` / `simulated`) that
is validated in the data model and surfaced throughout the UI. This is the foundation for the
longer-term goal — a platform for **infrastructure hazard and resilience assessment**, where
real feeds and modeled effects can be examined side by side without ever being confused.

It's built dependency-free with vanilla HTML/CSS/JS ES modules (no framework, no build step),
[Leaflet](https://leafletjs.com/) for mapping and [Chart.js](https://www.chartjs.org/) for
analytics, on top of a source-abstraction data layer that ingests live
[NWS/NOAA](https://www.weather.gov/documentation/services-web-api) alerts.

📖 See **[ABOUT.md](ABOUT.md)** for the full description (what it is, why it was built, and how).

> ⚠️ **Real vs. simulated data are kept strictly separate.** Storms can come from the
> live [NWS/NOAA API](https://www.weather.gov/documentation/services-web-api) (real,
> US-only) **or** from built-in concept data. **EMP (electromagnetic-pulse) sources are
> always hypothetical/simulated** — they are not real and are never sourced from NWS.
> Every object carries a provenance tag (`observed` / `forecast` / `simulated`) and
> simulated objects are visibly marked **SIM**.

## Data sources

The app loads through a source abstraction (`js/datasource.js`) with three modes:

| Mode   | Storms                                  | EMP sources        |
|--------|-----------------------------------------|--------------------|
| `mock` | built-in concept data (SIM)             | concept data (SIM) |
| `nws`  | live **NWS alerts** (real, US)          | none               |
| `both` | live NWS alerts (real, US)              | concept data (SIM) |

Live "real weather" currently comes from **NWS active alerts**
([api.weather.gov](https://www.weather.gov/documentation/services-web-api)) —
tornado/severe-thunderstorm/hurricane/etc. alerts, US-only. Warnings are tagged
`observed`, watches `forecast`. *(Verified working live against the real API.)*

### NHC tropical cyclones — parked (requires a proxy)

The app includes an NHC adapter ([`sources/nhc.js`](js/sources/nhc.js)) that maps
[CurrentStorms.json](https://www.nhc.noaa.gov/CurrentStorms.json) into live cyclone
entities, **but it is disabled by default.** Verified in-browser: `nhc.noaa.gov`
serves `CurrentStorms.json` **without an `Access-Control-Allow-Origin` header**, so a
browser on a static-site origin (like GitHub Pages) **cannot fetch it** — the request
fails with a CORS error. (`curl` works because it ignores CORS; only browsers enforce it.)

To enable NHC you must supply a **CORS-enabled proxy** that re-serves the same JSON:

```js
// point at your proxy (e.g. a Cloudflare Worker), then it loads with the current mode
WARP.setNhcProxy('https://your-proxy.example/CurrentStorms.json');
```

> **Approximate tracks:** even via a proxy, NHC's official forecast cone/track are only
> published as KMZ/shapefile (also without CORS). So each cyclone's forward track is
> *synthesized* from its reported motion vector (`movementDir` + `movementSpeed`) and
> clearly marked *approximate — not the official NHC cone* (faint/finely-dashed, with an
> inspector note). A real-cone source could slot in later behind the same entity shape.

If a live source fails, the app falls back to concept data (Mode shows `Fallback`); when
NHC is parked the on-screen status notice says so, so missing cyclones are never silently
implied to be "no storms."

Default is `mock`. Switch at runtime from the browser console (no rebuild):

```js
WARP.setMode('nws');   // live NWS alerts (US only); NHC parked unless a proxy is set
WARP.setMode('both');  // live NWS alerts + simulated EMP sources
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
- 🟧 **Real NWS warning-area polygons** drawn on the map (the actual alert geometry, not a centroid dot)
- 👥 **People-in-harm's-way estimate** per live alert — the population inside the warning polygon

### People-in-harm's-way (life-safety)

For each live NWS alert, WARP draws the **real warning-area polygon** and estimates the
**number of people inside it** — the signal that turns "a warning polygon" into "≈ N people
at risk here."

> ⚠️ **The estimate is approximate and clearly labeled as such.** The current estimator
> ([`js/population.js`](js/population.js)) is a documented **placeholder** — polygon area ×
> average US population density — so it is *order-of-magnitude only* and is not spatially
> aware. It is built behind a pluggable interface (`setPopulationSource`) so a real gridded
> ([WorldPop](https://www.worldpop.org/) / [NASA SEDAC GPW](https://sedac.ciesin.columbia.edu/))
> or census-intersection source can replace it with no UI changes. Numbers are shown as
> "≈ N (est.)" and must never be treated as authoritative counts.

WARP is a **situational-awareness aid, not an official warning system** — a persistent
in-app disclaimer states this, links to the [National Weather Service](https://www.weather.gov/),
and reminds users that the absence of an alert here does not mean an area is safe.

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
