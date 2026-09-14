// App entry point: loads normalized data, then initializes modules in order.

import { appData, config } from './state.js';
import { load } from './datasource.js';
import { initModal } from './modal.js';
import { initMap, drawObjects } from './map.js';
import { initCharts, rebuildCharts } from './charts.js';
import { renderStormList, updateSummary, renderPulses, renderThumbs } from './panels.js';
import { initTimeline } from './timeline.js';
import { initNav } from './nav.js';

// Ensure the on-screen source-status notice element exists (created once).
function statusEl() {
  let el = document.getElementById('sourceStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sourceStatus';
    el.className = 'source-status';
    document.body.appendChild(el);
  }
  return el;
}

// Surface data-source status BOTH in the Mode telemetry and as an on-screen
// notice, so users are never misled about what is (and isn't) being shown —
// e.g. that tropical cyclones are parked, or that a live source failed.
function setSourceNotice(meta) {
  const modeEl = document.querySelector('.telemetry .metric:last-child b');
  if (modeEl) {
    modeEl.textContent = meta.degraded ? 'Fallback' : (meta.mode === 'mock' ? 'Concept' : (meta.partial ? 'Live (partial)' : 'Live'));
  }

  const el = statusEl();
  const src = meta.sources || {};
  let tone = 'ok', msg = '';

  if (meta.mode === 'mock') {
    tone = 'sim';
    msg = 'Concept data (simulated) — not real weather.';
  } else if (meta.degraded) {
    tone = 'warn';
    msg = `Live data unavailable — showing concept data. (${meta.error || 'unknown error'})`;
  } else {
    const parts = [];
    if (src.nws && !src.nws.error) parts.push(`NWS alerts: ${src.nws.mappedStorms ?? '?'} storms`);
    if (src.nws && src.nws.error) { tone = 'warn'; parts.push(`NWS failed (${src.nws.error})`); }
    if (src.nhc && src.nhc.parked) { tone = tone === 'ok' ? 'info' : tone; parts.push('NHC cyclones parked (needs proxy)'); }
    else if (src.nhc && src.nhc.error) { tone = 'warn'; parts.push(`NHC failed (${src.nhc.error})`); }
    else if (src.nhc && !src.nhc.error) parts.push(`NHC cyclones: ${src.nhc.mappedStorms ?? '?'}`);
    msg = 'Live · ' + (parts.join(' · ') || 'no active storms');
  }

  el.textContent = msg;
  el.dataset.tone = tone;

  // Console mirrors (useful for debugging / power users).
  if (meta.degraded) console.warn(`WARP data degraded — fallback. Reason: ${meta.error || 'unknown'}`);
  else if (meta.partial) console.warn('WARP live data partial — a source failed:', src);
  console.info('WARP data source:', meta.mode, meta);
}

async function boot() {
  // 1. Load normalized entities from the configured source (never throws).
  const result = await load(config.mode, { nhcProxyUrl: config.nhcProxyUrl });
  appData.storms = result.storms;
  appData.emps = result.emps;
  appData.meta = result.meta;
  setSourceNotice(result.meta);

  // 2. Modal (used by everything else via events).
  initModal();

  // 3. Map + markers/layers (creates refs.map; drawObjects renders entities).
  initMap();

  // 4. Panels (storm list, summary, EMP manager, imagery thumbnails).
  renderStormList();
  updateSummary();
  renderPulses();
  renderThumbs();

  // 5. Deck charts (must exist before the animation loop references them).
  initCharts();

  // 6. Timeline / transport controls + animation loop.
  initTimeline();

  // 7. Navigation (tabs, mode strip, scenario buttons).
  initNav();

  // 8. Simulation clock ticker.
  setInterval(() => {
    const d = new Date(Date.UTC(2025, 4, 20, 14, 35, 22 + Math.floor(performance.now() / 1000)));
    document.getElementById('simClock').textContent = d.toISOString().replace('T', ' ').slice(11, 19) + ' UTC';
  }, 1000);
}

boot();

// Expose a tiny console API so users can switch data sources without a rebuild:
//   WARP.setMode('nws'); WARP.setMode('both'); WARP.setMode('mock');
//   WARP.setNhcProxy('https://your-proxy/CurrentStorms.json'); // enable NHC cyclones
async function reload() {
  const result = await load(config.mode, { nhcProxyUrl: config.nhcProxyUrl });
  appData.storms = result.storms;
  appData.emps = result.emps;
  appData.meta = result.meta;
  setSourceNotice(result.meta);
  drawObjects();
  rebuildCharts();
  renderStormList();
  updateSummary();
  renderPulses();
  return result.meta;
}
window.WARP = {
  async setMode(mode) { config.mode = mode; return reload(); },
  // Enable NHC tropical cyclones by pointing at a CORS-enabled proxy (see README).
  // Pass null to disable again. Re-loads the current mode.
  async setNhcProxy(url) { config.nhcProxyUrl = url || null; return reload(); },
  get data() { return appData; },
  get config() { return config; }
};
