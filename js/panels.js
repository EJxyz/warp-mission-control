// Left/right dashboard panels: storm list, mission summary, status table,
// pulse manager, and the imagery thumbnail tiles.

import { hurricaneSvg, tornadoSvg } from './data.js';
import { sim, refs, appData } from './state.js';
import { stormDetails, pulseDetails } from './details.js';
import { showModal } from './modal.js';
import { PROVENANCE_META, isReal } from './model.js';

// Format a possibly-missing numeric/string field (NWS storms lack wind/speed/etc.).
function fmt(v, suffix = '') { return (v === undefined || v === null || v === '') ? '—' : v + suffix; }

// Small colored provenance chip shown on each storm card / row.
function provChip(entity) {
  const meta = PROVENANCE_META[entity.provenance];
  if (!meta) return '';
  return `<span class="prov-chip" style="--pc:${meta.color}" title="${meta.label}">${meta.badge}</span>`;
}

export function renderStormList() {
  const storms = appData.storms;
  const box = document.getElementById('stormList');
  box.innerHTML = '';
  document.getElementById('stormCount').textContent = storms.length;
  if (!storms.length) {
    box.innerHTML = `<div class="empty-note">No active storms for the current data source.</div>`;
    return;
  }
  storms.forEach(s => {
    const color = s.color || '#20bfff';
    const div = document.createElement('div');
    div.className = 'storm-card ' + (sim.selected === s.id ? 'active' : '') + (isReal(s.provenance) ? '' : ' sim');
    div.style.setProperty('--accent', color);
    const intensityPct = Math.round((s.intensity || 0) * 100);
    div.innerHTML = `<div class="storm-head"><div class="storm-svg" style="color:${color}">${s.type === 'Hurricane' ? hurricaneSvg : tornadoSvg}</div><div><div class="storm-id">${s.id} ${provChip(s)}</div><div class="storm-type">${fmt(s.type)}</div></div><div class="storm-cat">${fmt(s.cat)}</div></div><div class="storm-detail"><span>Wind <b>${fmt(s.wind)}</b></span><span>Exposure <b>${s.pulse !== undefined ? Math.round(s.pulse) + '%' : '—'}</b></span><span>Heading <b>${fmt(s.heading)}</b></span><span>Speed <b>${fmt(s.speed)}</b></span></div><div class="bar"><i style="--v:${intensityPct}%;background:linear-gradient(90deg,${color},var(--green))"></i></div>`;
    div.onclick = () => { sim.selected = s.id; refs.map.setView([s.lat, s.lng], 5); renderStormList(); stormDetails(s); };
    box.appendChild(div);
  });
}

export function updateSummary() {
  const storms = appData.storms, emps = appData.emps;
  const withIntensity = storms.filter(s => s.intensity !== undefined);
  const avg = withIntensity.length ? Math.round(withIntensity.reduce((a, s) => a + s.intensity, 0) / withIntensity.length * 100) : 0;
  const exposures = storms.map(s => s.pulse).filter(v => v !== undefined);
  const maxExposure = exposures.length ? Math.max(...exposures) : 0;
  const observedCount = storms.filter(s => isReal(s.provenance)).length;
  const m = appData.meta || {};
  const sourceLabel = m.mode === 'nws' ? 'Live NWS' : m.mode === 'both' ? 'NWS + Concept' : 'Concept (mock)';
  document.getElementById('missionSummary').innerHTML =
    `<div class="sum-row"><span>Active Storms</span><b>${storms.length}</b></div>` +
    `<div class="sum-row"><span>Real / Simulated</span><b>${observedCount} / ${storms.length - observedCount}</b></div>` +
    `<div class="sum-row"><span>EMP Sources</span><b>${emps.length}</b></div>` +
    `<div class="sum-row"><span>Avg Intensity</span><b>${avg}%</b></div>` +
    `<div class="sum-row"><span>Highest Exposure</span><b>${Math.round(maxExposure)}%</b></div>` +
    `<div class="sum-row"><span>Data Source</span><b>${sourceLabel}${m.degraded ? ' ⚠' : ''}</b></div>`;
  document.getElementById('statusTable').innerHTML =
    '<tr><th>ID</th><th>Type</th><th>Class</th><th>Wind</th><th>Origin</th><th>Status</th></tr>' +
    storms.slice(0, 6).map(s => {
      const meta = PROVENANCE_META[s.provenance] || {};
      return `<tr><td style="color:${s.color || '#20bfff'};font-weight:900">${s.id}</td><td>${(s.type || '?')[0]}</td><td>${fmt(s.cat)}</td><td>${fmt(s.wind)}</td><td style="color:${meta.color || '#a8becb'}">${meta.badge || '?'}</td><td class="active">Active</td></tr>`;
    }).join('');
}

// EMP source manager (formerly "pulse" manager). EMP sources are always simulated.
export function renderPulses() {
  const box = document.getElementById('pulseManager');
  box.innerHTML = '';
  if (!appData.emps.length) {
    box.innerHTML = `<div class="empty-note">No EMP sources.</div>`;
    return;
  }
  appData.emps.forEach(p => {
    const row = document.createElement('div');
    row.className = 'pulse-row';
    row.innerHTML = `<b>${p.id}</b><span>${fmt(p.power)} · ${fmt(p.impact, '%')} impact</span>`;
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
