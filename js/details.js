// Detail modals for storms, pulses and states (opened from list, markers, managers).

import { showModal } from './modal.js';
import { PROVENANCE_META, isReal } from './model.js';

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
    ['Category / Class', dash(s.cat)],
    ['Event', dash(s.event)],
    ['Wind', dash(s.wind, ' mph')],
    ['Pressure', dash(s.pressure, ' mb')],
    ['Heading', dash(s.heading)],
    ['Forward Speed', dash(s.speed, ' mph')],
    ['Pulse Exposure', s.pulse !== undefined ? Math.round(s.pulse) + '%' : '—'],
    ['Source', dash(s.source)]
  ];
  const areaNote = s.headline ? `<div class="note">${s.headline}${s.areaDesc ? '<br><small>' + s.areaDesc + '</small>' : ''}</div>`
    : `<div class="note">Storm inspector: track history, forecast path, intensity trace and affected areas will expand here.</div>`;
  showModal(`${s.id} ${dash(s.type)} Inspector`,
    provBanner(s) + rows.map(([k, v]) => `<div class="detail-row"><span>${k}</span><b>${v}</b></div>`).join('') + areaNote,
    300, 118);
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
