// App entry point: loads normalized data, then initializes modules in order.

import { appData, config } from './state.js';
import { load } from './datasource.js';
import { initModal } from './modal.js';
import { initMap, drawObjects } from './map.js';
import { initCharts, rebuildCharts } from './charts.js';
import { renderStormList, updateSummary, renderPulses, renderThumbs } from './panels.js';
import { initTimeline } from './timeline.js';
import { initNav } from './nav.js';

// Surface a non-blocking banner when data is degraded/mocked so the user always
// knows whether they're looking at live or fallback data.
function setSourceNotice(meta) {
  const label = meta.mode === 'nws' ? 'Live NWS+NHC' : meta.mode === 'both' ? 'NWS+NHC + Concept EMP' : 'Concept (mock)';
  const modeEl = document.querySelector('.telemetry .metric:last-child b');
  if (modeEl) {
    modeEl.textContent = meta.degraded ? 'Fallback' : (meta.mode === 'mock' ? 'Concept' : (meta.partial ? 'Live (partial)' : 'Live'));
  }
  if (meta.degraded) {
    console.warn(`Data source "${meta.mode}" degraded — using fallback. Reason: ${meta.error || 'unknown'}`);
  } else if (meta.partial && meta.sources) {
    const down = Object.entries(meta.sources).filter(([, v]) => v && v.error).map(([k, v]) => `${k}: ${v.error}`);
    console.warn(`WARP live data partial — one source unavailable. ${down.join('; ')}`);
  }
  console.info(`WARP data source: ${label}`, meta);
}

async function boot() {
  // 1. Load normalized entities from the configured source (never throws).
  const result = await load(config.mode);
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
window.WARP = {
  async setMode(mode) {
    config.mode = mode;
    const result = await load(mode);
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
  },
  get data() { return appData; }
};
