// Playback timeline: clock formatting, progress readout, animation loop,
// and transport / simulation-control button handlers.

import { storms } from './data.js';
import { sim, refs } from './state.js';
import { renderStormList, updateSummary } from './panels.js';

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
    storms.forEach((s, i) => {
      s.pulse = Math.min(99, s.pulse + .006 * sim.speed);
      s.intensity = Math.max(.08, s.intensity - .000035 * sim.speed * (i + 1));
    });
    const chart = refs.intensityChart;
    chart.data.datasets.forEach((d, i) => {
      d.data.push(Math.max(.05, storms[i].intensity + Math.sin(performance.now() / 900 + i) * .016));
      d.data.shift();
    });
    chart.update('none');
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
    storms.forEach(s => s.intensity = Math.max(.08, s.intensity - .01));
    updateTimeline(); renderStormList(); updateSummary(); refs.intensityChart.update();
  };
  $('resetBtn').onclick = () => location.reload();
  $('speed').oninput = e => { sim.speed = +e.target.value; $('speedLabel').textContent = sim.speed.toFixed(1) + 'x'; };
  animate();
}
