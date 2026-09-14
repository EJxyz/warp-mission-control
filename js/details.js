// Detail modals for storms, pulses and states (opened from list, markers, managers).

import { showModal } from './modal.js';
import { PROVENANCE_META, isReal } from './model.js';
import { estimatePopulation, isPlaceholderSource } from './population.js';
import { facilitiesInArea } from './facilities.js';
import { showFacilities } from './map.js';

// Format a people count with thousands separators.
function fmtPeople(n) {
  if (n === null || n === undefined) return 'unavailable';
  return n.toLocaleString('en-US');
}

const dash = (v, suffix = '') => (v === undefined || v === null || v === '') ? '—' : v + suffix;

// A prominent provenance banner so the viewer always knows if data is real.
function provBanner(entity) {
  const meta = PROVENANCE_META[entity.provenance];
  if (!meta) return '';
  const real = isReal(entity.provenance);
  return `<div class="prov-banner" style="--pc:${meta.color}">${meta.badge} · ${meta.label}${real ? '' : ' — not real data'}</div>`;
}

export function stormDetails(s) {
  const rows = [
    ['Name', dash(s.name)],
    ['Category / Class', dash(s.classLabel || s.cat)],
    ['Event', dash(s.event)],
    ['Wind', dash(s.wind, ' mph')],
    ['Pressure', dash(s.pressure, ' mb')],
    ['Heading', dash(s.heading)],
    ['Forward Speed', dash(s.speed, ' mph')],
    ['Pulse Exposure', s.pulse !== undefined ? Math.round(s.pulse) + '%' : '—'],
    ['Source', dash(s.source)]
  ].filter(([, v]) => v !== '—' || true); // keep all rows (— is meaningful)
  // Notes: NWS headline/area, or the NHC approximate-track caveat.
  let note = '';
  if (s.headline) note = `<div class="note">${s.headline}${s.areaDesc ? '<br><small>' + s.areaDesc + '</small>' : ''}</div>`;
  else note = `<div class="note">Storm inspector: track history, forecast path, intensity trace and affected areas will expand here.</div>`;
  if (s.trackApprox) {
    note += `<div class="note" style="border-color:rgba(56,224,255,.5)">⚠ Forward track shown is <b>approximate</b> — derived from the reported motion vector, <b>not</b> the official NHC forecast cone.</div>`;
  }

  // People-in-harm's-way row: only for real alerts that carry a warning polygon.
  // Rendered async — show a placeholder, then patch in the estimate.
  const hasArea = !!s.alertGeometry;
  const popRow = hasArea
    ? `<div class="detail-row"><span>People in warning area</span><b id="popEstimate">estimating…</b></div>`
    : '';
  const facRow = hasArea
    ? `<div class="detail-row"><span>Critical facilities</span><b id="facSummary">checking…</b></div>`
    : '';

  showModal(`${s.id} ${dash(s.type)} Inspector`,
    provBanner(s) + rows.map(([k, v]) => `<div class="detail-row"><span>${k}</span><b>${v}</b></div>`).join('') + popRow + facRow + note,
    300, 118);

  if (hasArea) {
    estimatePopulation(s.alertGeometry).then(est => {
      const el = document.getElementById('popEstimate');
      if (!el) return; // modal may have been closed/replaced
      if (!est || est.people === null) { el.textContent = 'unavailable'; return; }
      s._popEstimate = est; // cache for the list
      el.innerHTML = `≈ ${fmtPeople(est.people)} <span style="color:var(--muted);font-weight:600">(est.)</span>`;
      // Append an honest caveat about the estimate method.
      const body = document.getElementById('modalBody');
      if (body && est.approximate && !body.querySelector('.pop-caveat')) {
        const c = document.createElement('div');
        c.className = 'note pop-caveat';
        c.style.borderColor = 'rgba(255,158,47,.55)';
        c.innerHTML = `⚠ People estimate is <b>approximate${isPlaceholderSource() ? ' (placeholder)' : ''}</b>${est.areaKm2 ? ` — warning area ≈ ${est.areaKm2.toLocaleString('en-US')} km²` : ''}. ${est.note || ''} Always defer to official NWS guidance.`;
        body.appendChild(c);
      }
    });

    // Critical-facilities exposure (real OpenStreetMap data) inside the polygon.
    facilitiesInArea(s.alertGeometry).then(res => {
      const el = document.getElementById('facSummary');
      if (!el) return;
      if (!res) { el.textContent = 'unavailable'; return; }
      s._facilities = res; // cache for the list + map
      showFacilities(res.facilities); // plot them on the map
      const sum = res.summary;
      if (!sum.total) { el.innerHTML = `none found <span style="color:var(--muted);font-weight:600">(OSM)</span>`; return; }
      el.innerHTML = `${sum.total} <span style="color:var(--muted);font-weight:600">(${res.source})</span>`;
      const body = document.getElementById('modalBody');
      if (body && !body.querySelector('.fac-list')) {
        const list = document.createElement('div');
        list.className = 'note fac-list';
        list.style.borderColor = 'rgba(56,224,255,.45)';
        const items = sum.breakdown.map(b => `<span class="fac-chip">${b.count} × ${b.label}</span>`).join(' ');
        list.innerHTML = `<b>Critical facilities in warning area</b><br>${items}` +
          (res.approximate ? `<br><small>⚠ ${res.note}</small>` : '');
        body.appendChild(list);
      }
    }).catch(err => {
      const el = document.getElementById('facSummary');
      if (el) el.textContent = 'lookup failed';
      console.warn('Facilities lookup failed:', err && err.message);
    });
  }
}

export function pulseDetails(p) {
  showModal(`${p.id} EMP Source`,
    provBanner(p) +
    `<div class="detail-row"><span>Impact</span><b>${dash(p.impact, '%')}</b></div>` +
    `<div class="detail-row"><span>Power</span><b>${dash(p.power)}</b></div>` +
    `<div class="detail-row"><span>Latitude</span><b>${p.lat.toFixed(2)}</b></div>` +
    `<div class="detail-row"><span>Longitude</span><b>${p.lng.toFixed(2)}</b></div>` +
    `<div class="note">Simulation-only object (electromagnetic-pulse source): configurable radius, visualization style, and scenario assignment. This is not real weather data.</div>`,
    900, 130);
}

export function showState(name) {
  showModal(`${name} State Watch`,
    `<div class="detail-row"><span>Risk Type</span><b>Simulation Watch</b></div>` +
    `<div class="detail-row"><span>Layer</span><b>Storm + Pulse Exposure</b></div>` +
    `<div class="detail-row"><span>Status</span><b>Monitored</b></div>` +
    `<div class="note">Future version: click a state to show affected storms, projected arrival, watch/warning state, and scenario notes.</div>`,
    560, 150);
}
