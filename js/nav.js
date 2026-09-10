// Top nav tablist, footer mode strip, scenario manager buttons, and the
// footer mode modals (AI Summary / 3D Viewer / Scenarios / Report).

import { storms, pulses } from './data.js';
import { sim, refs } from './state.js';
import { showModal, closeModal, isModalOpen } from './modal.js';
import { showWorkspace } from './workspaces.js';

let navTabs = [];

function activateTab(tab) {
  navTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); t.setAttribute('tabindex', '-1'); });
  tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); tab.setAttribute('tabindex', '0');
  const name = tab.textContent.trim();
  if (isModalOpen()) closeModal();
  if (name === 'Mission Ctrl') { showWorkspace(null); setTimeout(() => refs.map.invalidateSize(), 60); return; }
  showWorkspace(name);
}

function initTabs() {
  navTabs = [...document.querySelectorAll('.nav .tab')];
  navTabs.forEach((tab, i) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
    tab.setAttribute('tabindex', tab.classList.contains('active') ? '0' : '-1');
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(tab); return; }
      let ni = null;
      if (e.key === 'ArrowRight') ni = (i + 1) % navTabs.length;
      else if (e.key === 'ArrowLeft') ni = (i - 1 + navTabs.length) % navTabs.length;
      else if (e.key === 'Home') ni = 0;
      else if (e.key === 'End') ni = navTabs.length - 1;
      if (ni !== null) { e.preventDefault(); navTabs[ni].focus(); navTabs[ni].setAttribute('tabindex', '0'); tab.setAttribute('tabindex', '-1'); }
    });
  });
  document.querySelector('.nav').setAttribute('role', 'tablist');
  document.getElementById('wsClose').onclick = () => document.querySelector('.nav .tab').click();
}

function initModeStrip() {
  document.querySelectorAll('.mode-strip .mode').forEach(mode => {
    mode.setAttribute('role', 'button');
    mode.setAttribute('tabindex', '0');
    mode.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mode.click(); } });
  });

  document.getElementById('reportBtn').onclick = () => showModal('AI Mission Summary',
    `<div class="detail-row"><span>Active Storms</span><b>${storms.length}</b></div><div class="detail-row"><span>Pulse Sources</span><b>${pulses.length}</b></div><div class="detail-row"><span>Highest Exposure</span><b>${Math.round(Math.max(...storms.map(s => s.pulse)))}%</b></div><div class="detail-row"><span>Primary Region</span><b>Gulf / Central Plains</b></div><div class="note">Summary describes the current simulation state only. Observed weather layers and hypothetical simulation outputs should remain clearly separated.</div>`, 980, 120);
  document.getElementById('viewerBtn').onclick = () => showModal('3D Storm Viewer',
    `<div class="mini3d"><div class="vortex"></div></div><div class="detail-row"><span>Selected Object</span><b>${sim.selected}</b></div><div class="detail-row"><span>View Mode</span><b>Rotating Vortex</b></div><div class="detail-row"><span>Layer</span><b>Wind + Pulse Field</b></div><div class="note">Placeholder for future rotating hurricane/tornado inspection workspace.</div>`, 940, 210);
  document.getElementById('scenarioBtn').onclick = () => showModal('Scenario Manager',
    `<div class="detail-row"><span>Gulf Track</span><b>Active</b></div><div class="detail-row"><span>Plains Outbreak</span><b>Ready</b></div><div class="detail-row"><span>Coastal Impact</span><b>Ready</b></div><div class="detail-row"><span>Baseline</span><b>Ready</b></div><div class="note">Future build: save, load, clone, compare, and replay named scenarios.</div>`, 940, 150);
  document.getElementById('exportBtn').onclick = () => showModal('Report Generator',
    `<div class="detail-row"><span>Format</span><b>HTML / PDF future</b></div><div class="detail-row"><span>Includes</span><b>Map + Charts + Notes</b></div><div class="detail-row"><span>Scenario</span><b>${document.getElementById('scenarioName').textContent}</b></div><div class="note">This will produce an executive summary of the current simulation configuration and visual state.</div>`, 940, 260);
}

function initScenarioButtons() {
  const scenarioButtons = document.getElementById('scenarioButtons');
  scenarioButtons.querySelectorAll('button').forEach(btn => btn.onclick = () => {
    scenarioButtons.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('scenarioName').textContent = btn.textContent;
    showModal('Scenario Loaded',
      `<div class="detail-row"><span>Scenario</span><b>${btn.textContent}</b></div><div class="detail-row"><span>Status</span><b>Concept Active</b></div><div class="note">Future builds will save storm positions, pulse locations, timeline bookmarks, and notes per scenario.</div>`, 900, 260);
  });
}

export function initNav() {
  initTabs();
  initModeStrip();
  initScenarioButtons();
}
