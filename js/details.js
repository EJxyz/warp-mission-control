// Detail modals for storms, pulses and states (opened from list, markers, managers).

import { showModal } from './modal.js';

export function stormDetails(s) {
  showModal(`${s.id} ${s.type} Inspector`,
    `<div class="detail-row"><span>Category / EF</span><b>${s.cat}</b></div>` +
    `<div class="detail-row"><span>Wind</span><b>${s.wind} mph</b></div>` +
    `<div class="detail-row"><span>Pressure</span><b>${s.pressure || '-'} mb</b></div>` +
    `<div class="detail-row"><span>Heading</span><b>${s.heading}</b></div>` +
    `<div class="detail-row"><span>Forward Speed</span><b>${s.speed} mph</b></div>` +
    `<div class="detail-row"><span>Pulse Exposure</span><b>${Math.round(s.pulse)}%</b></div>` +
    `<div class="note">Storm inspector workspace placeholder: track history, forecast path, intensity trace, affected states, and scenario notes will appear here.</div>`,
    300, 118);
}

export function pulseDetails(p) {
  showModal(`${p.id} Pulse Control`,
    `<div class="detail-row"><span>Impact</span><b>${p.impact}%</b></div>` +
    `<div class="detail-row"><span>Power</span><b>${p.power}</b></div>` +
    `<div class="detail-row"><span>Latitude</span><b>${p.lat.toFixed(2)}</b></div>` +
    `<div class="detail-row"><span>Longitude</span><b>${p.lng.toFixed(2)}</b></div>` +
    `<div class="note">Simulation-only object: configurable radius, visualization style, and scenario assignment.</div>`,
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
