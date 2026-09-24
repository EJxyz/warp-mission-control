// App entry point: loads normalized data, then initializes modules in order.

import { appData, config } from './state.js';
import { load } from './datasource.js';
import { initModal } from './modal.js';
import { initMap, drawObjects } from './map.js';
import { initCharts, rebuildCharts } from './charts.js';
import { renderStormList, updateSummary, renderPulses, renderThumbs } from './panels.js';
import { initTimeline } from './timeline.js';
import { initNav } from './nav.js';
import { setPopulationSource } from './population.js';
import { makeCensusSource } from './sources/census.js';

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
  // 0. Restore a previously-set NHC proxy URL so live cyclones persist across reloads.
  try {
    const saved = localStorage.getItem('warpNhcProxy');
    if (saved) config.nhcProxyUrl = saved;
  } catch (e) { /* localStorage unavailable — ignore */ }

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

  // 8. Life-safety disclaimer: shown by default; dismissal is remembered, but it
  // re-appears each new browser session (sessionStorage, not permanent) so it is
  // never permanently silenced.
  const disc = document.getElementById('safetyDisclaimer');
  const dismiss = document.getElementById('safetyDismiss');
  if (disc && dismiss) {
    if (sessionStorage.getItem('warpSafetyDismissed') === '1') disc.classList.add('hidden');
    dismiss.addEventListener('click', () => { disc.classList.add('hidden'); try { sessionStorage.setItem('warpSafetyDismissed', '1'); } catch (e) {} });
  }

  // 9. Simulation clock ticker.
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
// Clear cached exposure so a new population/facilities source recomputes.
function clearExposureCache() {
  for (const s of appData.storms) { delete s._popEstimate; delete s._facilities; }
}

window.WARP = {
  async setMode(mode) { config.mode = mode; return reload(); },
  // Enable NHC tropical cyclones by pointing at a CORS-enabled proxy (see proxy/).
  // The URL is remembered across reloads (localStorage). Pass null to disable.
  async setNhcProxy(url) {
    config.nhcProxyUrl = url || null;
    try {
      if (config.nhcProxyUrl) localStorage.setItem('warpNhcProxy', config.nhcProxyUrl);
      else localStorage.removeItem('warpNhcProxy');
    } catch (e) { /* localStorage unavailable — session-only */ }
    return reload();
  },
  // Switch the population estimator to the real US Census-backed source (browser,
  // no backend). Pass false to revert to the placeholder. Clears cached estimates
  // so open/next inspectors + triage recompute with the new source.
  useCensusPopulation(on = true) {
    setPopulationSource(on ? makeCensusSource() : null);
    clearExposureCache();
    renderStormList();
    return on ? 'Census population source enabled (US only; county area-weighted estimate).'
              : 'Reverted to placeholder population estimator.';
  },
  get data() { return appData; },
  get config() { return config; }
};
