// Playback timeline: clock formatting, progress readout, animation loop,
// and transport / simulation-control button handlers.

import { sim, refs, appData } from './state.js';
import { renderStormList, updateSummary } from './panels.js';
import { isReal } from './model.js';

export function timeText(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function updateTimeline() {
  document.getElementById('progress').style.width = (sim.missionTime / 360 * 100) + '%';
  document.getElementById('timeSlider').value = sim.missionTime;
  document.getElementById('timelineReadout').textContent = `${timeText(sim.missionTime)} / 06:00`;
}

function animate() {
  if (sim.playing && !sim.paused) {
    sim.missionTime = (sim.missionTime + .18 * sim.speed) % 360;
    const storms = appData.storms;
    // Only evolve SIMULATED storms — we never mutate real observed/forecast data.
    storms.forEach((s, i) => {
      if (isReal(s.provenance)) return;
      if (s.pulse !== undefined) s.pulse = Math.min(99, s.pulse + .006 * sim.speed);
      if (s.intensity !== undefined) s.intensity = Math.max(.08, s.intensity - .000035 * sim.speed * (i + 1));
    });
    // Advance the intensity chart, matching each dataset to its storm by id/label.
    const chart = refs.intensityChart;
    if (chart) {
      chart.data.datasets.forEach((d, i) => {
        const s = storms.find(x => x.id === d.label);
        const base = s && s.intensity !== undefined ? s.intensity : (d.data[d.data.length - 1] || .05);
        d.data.push(Math.max(.05, base + Math.sin(performance.now() / 900 + i) * .016));
        d.data.shift();
      });
      chart.update('none');
    }
    renderStormList();
    updateSummary();
    updateTimeline();
  }
  requestAnimationFrame(animate);
}

export function initTimeline() {
  const $ = id => document.getElementById(id);
  $('timeSlider').oninput = e => { sim.missionTime = +e.target.value; updateTimeline(); };
  $('playBtn').onclick = () => { sim.playing = !sim.playing; $('playBtn').textContent = sim.playing ? 'Ⅱ' : '▶'; };
  $('backBtn').onclick = () => { sim.missionTime = Math.max(0, sim.missionTime - 20); updateTimeline(); };
  $('fwdBtn').onclick = () => { sim.missionTime = Math.min(360, sim.missionTime + 20); updateTimeline(); };
  $('pauseBtn').onclick = () => { sim.paused = !sim.paused; $('pauseBtn').textContent = sim.paused ? '▶ Play' : 'Ⅱ Pause'; };
  $('stepBtn').onclick = () => {
    sim.missionTime = Math.min(360, sim.missionTime + 10);
    appData.storms.forEach(s => { if (!isReal(s.provenance) && s.intensity !== undefined) s.intensity = Math.max(.08, s.intensity - .01); });
    updateTimeline(); renderStormList(); updateSummary(); if (refs.intensityChart) refs.intensityChart.update();
  };
  $('resetBtn').onclick = () => location.reload();
  $('speed').oninput = e => { sim.speed = +e.target.value; $('speedLabel').textContent = sim.speed.toFixed(1) + 'x'; };
  animate();
}
