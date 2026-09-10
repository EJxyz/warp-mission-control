// Left/right dashboard panels: storm list, mission summary, status table,
// pulse manager, and the imagery thumbnail tiles.

import { storms, pulses, hurricaneSvg, tornadoSvg } from './data.js';
import { sim, refs } from './state.js';
import { stormDetails, pulseDetails } from './details.js';
import { showModal } from './modal.js';

export function renderStormList() {
  const box = document.getElementById('stormList');
  box.innerHTML = '';
  document.getElementById('stormCount').textContent = storms.length;
  storms.forEach(s => {
    const div = document.createElement('div');
    div.className = 'storm-card ' + (sim.selected === s.id ? 'active' : '');
    div.style.setProperty('--accent', s.color);
    div.innerHTML = `<div class="storm-head"><div class="storm-svg" style="color:${s.color}">${s.type === 'Hurricane' ? hurricaneSvg : tornadoSvg}</div><div><div class="storm-id">${s.id}</div><div class="storm-type">${s.type}</div></div><div class="storm-cat">${s.cat}</div></div><div class="storm-detail"><span>Wind <b>${s.wind}</b></span><span>Pulse <b>${Math.round(s.pulse)}%</b></span><span>Heading <b>${s.heading}</b></span><span>Speed <b>${s.speed}</b></span></div><div class="bar"><i style="--v:${Math.round(s.intensity * 100)}%;background:linear-gradient(90deg,${s.color},var(--green))"></i></div>`;
    div.onclick = () => { sim.selected = s.id; refs.map.setView([s.lat, s.lng], 5); renderStormList(); stormDetails(s); };
    box.appendChild(div);
  });
}

export function updateSummary() {
  const avg = Math.round(storms.reduce((a, s) => a + s.intensity, 0) / storms.length * 100);
  const maxPulse = Math.max(...storms.map(s => s.pulse));
  document.getElementById('missionSummary').innerHTML =
    `<div class="sum-row"><span>Active Storms</span><b>${storms.length}</b></div>` +
    `<div class="sum-row"><span>Pulse Sources</span><b>${pulses.length}</b></div>` +
    `<div class="sum-row"><span>Avg Intensity</span><b>${avg}%</b></div>` +
    `<div class="sum-row"><span>Highest Exposure</span><b>${Math.round(maxPulse)}%</b></div>` +
    `<div class="sum-row"><span>Risk Region</span><b>Central Plains / Gulf</b></div>` +
    `<div class="sum-row"><span>Simulation Status</span><b class="active">Running</b></div>`;
  document.getElementById('statusTable').innerHTML =
    '<tr><th>ID</th><th>Type</th><th>Cat</th><th>Wind</th><th>Pulse</th><th>Status</th></tr>' +
    storms.slice(0, 6).map(s => `<tr><td style="color:${s.color};font-weight:900">${s.id}</td><td>${s.type[0]}</td><td>${s.cat}</td><td>${s.wind}</td><td>${Math.round(s.pulse)}%</td><td class="active">Active</td></tr>`).join('');
}

export function renderPulses() {
  const box = document.getElementById('pulseManager');
  box.innerHTML = '';
  pulses.forEach(p => {
    const row = document.createElement('div');
    row.className = 'pulse-row';
    row.innerHTML = `<b>${p.id}</b><span>${p.power} · ${p.impact}% impact</span>`;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Open';
    btn.addEventListener('click', () => pulseDetails(p));
    row.appendChild(btn);
    box.appendChild(row);
  });
}

function drawThumb(name, idx) {
  const div = document.createElement('div');
  div.className = 'thumb';
  div.innerHTML = `<canvas></canvas><span>${name}</span>`;
  document.getElementById('thumbs').appendChild(div);
  const c = div.querySelector('canvas'), ctx = c.getContext('2d');
  function paint() {
    const w = div.clientWidth, h = div.clientHeight, sc = devicePixelRatio || 1;
    c.width = w * sc; c.height = h * sc; ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.clearRect(0, 0, w, h);
    const palettes = [['#07151e', '#2e5d38'], ['#1c2436', '#ff5c2a'], ['#071d19', '#3df45b'], ['#06152e', '#3ee9d1'], ['#12253a', '#24bfff'], ['#050816', '#d95cff'], ['#0b1720', '#bfe6ff'], ['#0b0b13', '#ffd64a']][idx];
    let g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, palettes[0]); g.addColorStop(1, palettes[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * w, 0); ctx.lineTo(Math.random() * w, h); ctx.stroke(); }
    if (idx < 2) { ctx.strokeStyle = 'rgba(255,255,255,.42)'; for (let r = 8; r < 75; r += 7) { ctx.beginPath(); ctx.arc(w * .45, h * .48, r, 0, Math.PI * 1.65); ctx.stroke(); } }
    else if (idx === 5 || idx === 7) { ctx.fillStyle = idx === 5 ? 'rgba(220,100,255,.85)' : 'rgba(255,214,74,.8)'; for (let i = 0; i < 50; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    else { for (let i = 0; i < 50; i++) { ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 20 + 4, Math.random() * 4 + 1); } }
  }
  setTimeout(paint, 80);
  div.onclick = () => showModal(`${name} Layer`, `<div class="note">${name} is represented here as a still concept tile. Future production builds can connect this tab to real or simulated imagery layers.</div>`, 420, 520);
}

export function renderThumbs() {
  ['Satellite', 'Infrared', 'Radar', 'Wind', 'Precip', 'Lightning', 'Cloud Tops', 'Pulse View'].forEach(drawThumb);
}
