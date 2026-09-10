// Tab workspace overlays: real full-panel views rendered over the map area.
// Each nav tab opens a workspace; "Mission Ctrl" hides it (handled by nav.js).

import { sim, refs, appData } from './state.js';
import { AXIS } from './charts.js';
import { timeText } from './timeline.js';
import { PROVENANCE_META } from './model.js';

const dash = v => (v === undefined || v === null || v === '') ? '—' : v;

let wsCharts = [];
function destroyWsCharts() { wsCharts.forEach(c => { try { c.destroy(); } catch (e) { } }); wsCharts = []; }
function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
function addChart(canvas, config) { const c = new Chart(canvas, config); wsCharts.push(c); return c; }

export function showWorkspace(name) {
  const ws = document.getElementById('workspace');
  destroyWsCharts();
  if (!name) { ws.classList.remove('show'); ws.querySelector('#wsBody').innerHTML = ''; return; }
  const b = document.getElementById('wsBody');
  document.getElementById('wsTitle').textContent = name + ' Workspace';
  const subtitles = {
    'GIS': 'Geospatial reference — objects, coordinates and coverage of the North American domain.',
    'Simulation': 'Scenario playback state, per-object motion and intensity trends.',
    'Pulse Lab': 'EMP-source inventory, impact ranking and placement (simulated).',
    'Analytics': 'Expanded graphs for intensity, wind, pressure and pulse exposure.',
    'Scenarios': 'Named simulation scenarios — status, contents and quick actions.'
  };
  document.getElementById('wsSubtitle').textContent = subtitles[name] || '';
  b.innerHTML = '';
  ws.classList.add('show');
  ({ 'GIS': renderGIS, 'Simulation': renderSimulation, 'Pulse Lab': renderPulseLab, 'Analytics': renderAnalytics, 'Scenarios': renderScenarios }[name] || (() => { }))(b);
}

function renderGIS(b) {
  const storms = appData.storms, emps = appData.emps;
  const prov = e => (PROVENANCE_META[e.provenance] || {}).badge || '?';
  const rows = [...storms.map(s => [s.id, dash(s.type), dash(s.cat), s.lat.toFixed(1), s.lng.toFixed(1), prov(s), s.wind !== undefined ? s.wind + ' mph' : '—']),
    ...emps.map(p => [p.id, 'EMP', dash(p.power), p.lat.toFixed(1), p.lng.toFixed(1), 'SIM', p.impact !== undefined ? p.impact + '% impact' : '—'])];
  const observed = storms.filter(s => PROVENANCE_META[s.provenance] && s.provenance !== 'simulated').length;
  b.appendChild(el(`<div class="ws-kpi">
    <div class="kpi"><span>Tracked Objects</span><b>${storms.length + emps.length}</b></div>
    <div class="kpi"><span>Storms (real/sim)</span><b>${observed}/${storms.length - observed}</b></div>
    <div class="kpi"><span>EMP Sources</span><b>${emps.length}</b></div>
    <div class="kpi"><span>Domain</span><b style="font-size:15px">6°–61° N · 130°–50° W</b></div></div>`));
  const card = el(`<div class="ws-card"><h4>Object Registry (click a row to focus on the map)</h4></div>`);
  const table = el(`<table class="ws-table"><thead><tr><th>ID</th><th>Type</th><th>Class</th><th>Lat</th><th>Lng</th><th>Origin</th><th>Metric</th></tr></thead><tbody></tbody></table>`);
  const tb = table.querySelector('tbody');
  rows.forEach(r => { const tr = document.createElement('tr'); tr.style.cursor = 'pointer'; tr.innerHTML = r.map(c => `<td>${c}</td>`).join(''); tr.onclick = () => { showWorkspace(null); document.querySelector('.nav .tab').click(); refs.map.setView([+r[3], +r[4]], 5); }; tb.appendChild(tr); });
  card.appendChild(table); b.appendChild(card);
}

function renderSimulation(b) {
  b.appendChild(el(`<div class="ws-kpi">
    <div class="kpi"><span>Scenario</span><b style="font-size:16px">${document.getElementById('scenarioName').textContent}</b></div>
    <div class="kpi"><span>Playback</span><b>${timeText(sim.missionTime)} / 06:00</b></div>
    <div class="kpi"><span>Speed</span><b>${sim.speed.toFixed(1)}x</b></div>
    <div class="kpi"><span>State</span><b style="font-size:16px">${sim.playing ? (sim.paused ? 'Paused' : 'Running') : 'Stopped'}</b></div></div>`));
  const storms = appData.storms;
  const grid = el(`<div class="ws-grid ws-two"></div>`);
  const c1 = el(`<div class="ws-card"><h4>Storm Intensity</h4><div class="ws-chart"><canvas></canvas></div></div>`);
  const c2 = el(`<div class="ws-card"><h4>Forward Speed (mph)</h4><div class="ws-chart"><canvas></canvas></div></div>`);
  grid.appendChild(c1); grid.appendChild(c2); b.appendChild(grid);
  addChart(c1.querySelector('canvas'), { type: 'bar', data: { labels: storms.map(s => s.id), datasets: [{ label: 'Intensity %', data: storms.map(s => Math.round((s.intensity || 0) * 100)), backgroundColor: storms.map(s => s.color || '#20bfff') }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: AXIS, y: { ...AXIS, min: 0, max: 100 } } } });
  addChart(c2.querySelector('canvas'), { type: 'bar', data: { labels: storms.map(s => s.id), datasets: [{ label: 'Speed', data: storms.map(s => s.speed ?? 0), backgroundColor: 'rgba(55,224,122,.7)', borderColor: '#37e07a', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: AXIS, y: { ...AXIS, min: 0 } } } });
}

function renderPulseLab(b) {
  const emps = appData.emps;
  b.appendChild(el(`<div class="ws-card" style="border-color:rgba(166,108,255,.55)"><h4 style="border:0;margin:0">⚠ Simulated layer — EMP sources are hypothetical, not real data.</h4></div>`));
  if (!emps.length) { b.appendChild(el(`<div class="ws-card"><p style="color:var(--muted);margin:0">No EMP sources placed.</p></div>`)); return; }
  const ranked = [...emps].sort((a, p) => (p.impact || 0) - (a.impact || 0));
  b.appendChild(el(`<div class="ws-kpi">
    <div class="kpi"><span>EMP Sources</span><b>${emps.length}</b></div>
    <div class="kpi"><span>Peak Impact</span><b>${Math.max(...emps.map(p => p.impact || 0))}%</b></div>
    <div class="kpi"><span>Avg Impact</span><b>${Math.round(emps.reduce((a, p) => a + (p.impact || 0), 0) / emps.length)}%</b></div>
    <div class="kpi"><span>High-power</span><b>${emps.filter(p => p.power === 'High').length}</b></div></div>`));
  const grid = el(`<div class="ws-grid ws-two"></div>`);
  const c1 = el(`<div class="ws-card"><h4>Impact by Source</h4><div class="ws-chart"><canvas></canvas></div></div>`);
  const c2 = el(`<div class="ws-card"><h4>Impact Ranking</h4></div>`);
  const table = el(`<table class="ws-table"><thead><tr><th>Rank</th><th>EMP</th><th>Power</th><th>Impact</th></tr></thead><tbody></tbody></table>`);
  ranked.forEach((p, i) => table.querySelector('tbody').appendChild(el(`<tr><td>${i + 1}</td><td><b>${p.id}</b></td><td>${dash(p.power)}</td><td>${dash(p.impact)}${p.impact !== undefined ? '%' : ''}</td></tr>`)));
  c2.appendChild(table); grid.appendChild(c1); grid.appendChild(c2); b.appendChild(grid);
  addChart(c1.querySelector('canvas'), { type: 'bar', data: { labels: emps.map(p => p.id), datasets: [{ data: emps.map(p => p.impact || 0), backgroundColor: 'rgba(255,214,74,.72)', borderColor: '#ffd64a', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: AXIS, y: { ...AXIS, min: 0, max: 100 } } } });
}

function renderAnalytics(b) {
  const storms = appData.storms;
  const grid = el(`<div class="ws-grid ws-two"></div>`);
  const c1 = el(`<div class="ws-card"><h4>Wind Speed (mph)</h4><div class="ws-chart"><canvas></canvas></div></div>`);
  const c2 = el(`<div class="ws-card"><h4>Pulse Exposure (%)</h4><div class="ws-chart"><canvas></canvas></div></div>`);
  const c3 = el(`<div class="ws-card"><h4>Wind vs Pulse Exposure</h4><div class="ws-chart"><canvas></canvas></div></div>`);
  const c4 = el(`<div class="ws-card"><h4>Hurricane Pressure (mb)</h4><div class="ws-chart"><canvas></canvas></div></div>`);
  [c1, c2, c3, c4].forEach(c => grid.appendChild(c)); b.appendChild(grid);
  addChart(c1.querySelector('canvas'), { type: 'bar', data: { labels: storms.map(s => s.id), datasets: [{ data: storms.map(s => s.wind ?? 0), backgroundColor: storms.map(s => s.color || '#20bfff') }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: AXIS, y: { ...AXIS, min: 0 } } } });
  addChart(c2.querySelector('canvas'), { type: 'bar', data: { labels: storms.map(s => s.id), datasets: [{ data: storms.map(s => Math.round(s.pulse ?? 0)), backgroundColor: 'rgba(166,108,255,.7)', borderColor: '#a66cff', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: AXIS, y: { ...AXIS, min: 0, max: 100 } } } });
  addChart(c3.querySelector('canvas'), { type: 'scatter', data: { datasets: [{ label: 'Storms', data: storms.filter(s => s.wind !== undefined).map(s => ({ x: s.wind, y: Math.round(s.pulse ?? 0) })), backgroundColor: storms.filter(s => s.wind !== undefined).map(s => s.color || '#20bfff'), pointRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...AXIS, title: { display: true, text: 'Wind (mph)', color: '#d8eaf2' } }, y: { ...AXIS, min: 0, max: 100, title: { display: true, text: 'Pulse %', color: '#d8eaf2' } } } } });
  const hur = storms.filter(s => s.pressure);
  addChart(c4.querySelector('canvas'), { type: 'bar', data: { labels: hur.map(s => s.id), datasets: [{ data: hur.map(s => s.pressure), backgroundColor: 'rgba(32,191,255,.7)', borderColor: '#20bfff', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: AXIS, y: { ...AXIS, min: 900 } } } });
}

function renderScenarios(b) {
  const scenarioButtons = document.getElementById('scenarioButtons');
  const list = [...scenarioButtons.querySelectorAll('button')].map(x => x.textContent.trim());
  const active = document.getElementById('scenarioName').textContent.trim();
  b.appendChild(el(`<div class="ws-kpi">
    <div class="kpi"><span>Scenarios</span><b>${list.length}</b></div>
    <div class="kpi"><span>Active</span><b style="font-size:16px">${active}</b></div>
    <div class="kpi"><span>Storms Captured</span><b>${appData.storms.length}</b></div>
    <div class="kpi"><span>EMPs Captured</span><b>${appData.emps.length}</b></div></div>`));
  const grid = el(`<div class="ws-grid ws-cards"></div>`);
  list.forEach(name => {
    const card = el(`<div class="ws-card"><h4>${name}</h4><p style="color:var(--muted);font-size:12px;margin:0 0 12px">${name === active ? 'Currently active scenario.' : 'Saved scenario, ready to load.'}</p></div>`);
    const btn = el(`<button class="btn" style="width:100%">${name === active ? 'Active' : 'Load Scenario'}</button>`);
    btn.onclick = () => { const target = [...scenarioButtons.querySelectorAll('button')].find(x => x.textContent.trim() === name); if (target) target.click(); showWorkspace('Scenarios'); };
    card.appendChild(btn); grid.appendChild(card);
  });
  b.appendChild(grid);
}
