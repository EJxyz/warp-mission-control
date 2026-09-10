// App entry point: initializes modules in dependency order.

import { initModal } from './modal.js';
import { initMap } from './map.js';
import { initCharts } from './charts.js';
import { renderStormList, updateSummary, renderPulses, renderThumbs } from './panels.js';
import { initTimeline } from './timeline.js';
import { initNav } from './nav.js';

// 1. Modal (used by everything else via events).
initModal();

// 2. Map + markers/layers (creates refs.map; drawObjects renders storm markers).
initMap();

// 3. Panels (storm list, summary, pulse manager, imagery thumbnails).
renderStormList();
updateSummary();
renderPulses();
renderThumbs();

// 4. Deck charts (must exist before the animation loop references them).
initCharts();

// 5. Timeline / transport controls + animation loop.
initTimeline();

// 6. Navigation (tabs, mode strip, scenario buttons).
initNav();

// 7. Simulation clock ticker.
setInterval(() => {
  const d = new Date(Date.UTC(2025, 4, 20, 14, 35, 22 + Math.floor(performance.now() / 1000)));
  document.getElementById('simClock').textContent = d.toISOString().replace('T', ' ').slice(11, 19) + ' UTC';
}, 1000);
