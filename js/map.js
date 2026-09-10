// Leaflet map: base layers, labels, storm/pulse markers, tracks, cones,
// lightning, and layer toggles. L is loaded globally from the Leaflet CDN.

import { hurricaneSvg, tornadoSvg } from './data.js';
import { layers, sim, refs, appData } from './state.js';
import { stormDetails, pulseDetails, showState } from './details.js';
import { renderStormList, updateSummary } from './panels.js';
import { Provenance, isReal } from './model.js';

// A short provenance badge overlaid on markers so simulated data is never
// mistaken for real observations at a glance.
function provBadge(entity) {
  if (isReal(entity.provenance)) return '';
  return `<div class="marker-prov">SIM</div>`;
}

function makeStormIcon(s) {
  const type = s.type === 'Hurricane' ? hurricaneSvg : tornadoSvg;
  return L.divIcon({ html: `<div class="storm-marker" style="color:${s.color || '#20bfff'}">${type}</div><div class="marker-tag">${s.id}</div>${provBadge(s)}`, className: '', iconSize: [72, 46] });
}
function makePulseIcon(p) {
  return L.divIcon({ html: `<div class="pulse-marker"></div><div class="pulse-id">${p.id}</div><div class="marker-prov">SIM</div>`, className: '', iconSize: [72, 46] });
}

function coneFor(s) {
  const proj = s.proj || [];
  return [[s.lat, s.lng],
    ...proj.map((p, i) => [p[0] + (i + 1) * .75, p[1] + (i + 1) * .35]),
    ...proj.slice().reverse().map((p, i) => [p[0] - (proj.length - i) * .75, p[1] - (proj.length - i) * .35])];
}

// Keep dependent map layers in sync when a storm marker is dragged/moved.
function syncStorm(s) {
  s._lead && s._lead.setLatLngs([[s.lat, s.lng], ...(s.proj || [])]);
  s._cone && s._cone.setLatLngs(coneFor(s));
  s._marker && s._marker.setLatLng([s.lat, s.lng]);
  renderStormList();
  updateSummary();
}

// Keep the exposure circle in sync when a pulse marker is dragged/moved.
function syncPulse(p) {
  p._circle && p._circle.setLatLng([p.lat, p.lng]);
  p._marker && p._marker.setLatLng([p.lat, p.lng]);
}

export function drawObjects() {
  const map = refs.map;
  layers.markers.forEach(l => map.removeLayer(l));
  layers.tracks.forEach(l => map.removeLayer(l));
  layers.cones.forEach(l => map.removeLayer(l));
  layers.pulses.forEach(l => map.removeLayer(l));
  layers.markers = []; layers.tracks = []; layers.cones = []; layers.pulses = [];
  appData.storms.forEach(s => {
    // Only simulated storms are user-editable; real observations are locked.
    const editable = !isReal(s.provenance);
    // Historical track (only if the source provided one — NWS alerts don't).
    if (s.track && s.track.length) {
      layers.tracks.push(L.polyline(s.track, { color: '#a8b8c2', weight: 2, dashArray: '6 8', opacity: .7 }).addTo(map));
    }
    // Forecast projection line + cone (only if projection geometry exists).
    if (s.proj && s.proj.length) {
      s._lead = L.polyline([[s.lat, s.lng], ...s.proj], { color: s.type === 'Hurricane' ? '#20bfff' : '#a66cff', weight: 3, dashArray: s.type === 'Hurricane' ? '8 8' : '5 7', opacity: .95 }).addTo(map);
      layers.tracks.push(s._lead);
      s._cone = L.polygon(coneFor(s), { color: s.color || '#20bfff', weight: 1, fillColor: s.color || '#20bfff', fillOpacity: .10, opacity: .35 }).addTo(map);
      layers.cones.push(s._cone);
    } else {
      s._lead = null; s._cone = null;
    }
    const m = L.marker([s.lat, s.lng], { icon: makeStormIcon(s), draggable: editable })
      .on('click', () => { sim.selected = s.id; renderStormList(); stormDetails(s); })
      .addTo(map);
    if (editable) {
      m.on('drag', e => { const ll = e.target.getLatLng(); s.lat = +ll.lat.toFixed(3); s.lng = +ll.lng.toFixed(3); syncStorm(s); })
       .on('dragend', () => { sim.selected = s.id; syncStorm(s); });
    }
    s._marker = m;
    layers.markers.push(m);
  });
  // EMP sources are always simulated and always editable.
  appData.emps.forEach(p => {
    p._circle = L.circle([p.lat, p.lng], { radius: 180000, color: '#ffd64a', weight: 2, fillColor: '#ffd64a', fillOpacity: .11 }).addTo(map);
    layers.pulses.push(p._circle);
    const pm = L.marker([p.lat, p.lng], { icon: makePulseIcon(p), draggable: true })
      .on('click', () => pulseDetails(p))
      .on('drag', e => { const ll = e.target.getLatLng(); p.lat = +ll.lat.toFixed(3); p.lng = +ll.lng.toFixed(3); syncPulse(p); })
      .addTo(map);
    p._marker = pm;
    layers.pulses.push(pm);
  });
}

function addLightning() {
  const map = refs.map;
  for (let i = 0; i < 70; i++) {
    layers.lightning.push(L.marker([8 + Math.random() * 44, -113 + Math.random() * 55], { icon: L.divIcon({ html: '<span style="color:#d95cff;text-shadow:0 0 8px #d95cff">✦</span>', className: '', iconSize: [10, 10] }) }).addTo(map));
  }
}

function toggleLayer(arr, on) {
  const map = refs.map;
  arr.forEach(l => on ? l.addTo(map) : map.removeLayer(l));
}

function applyToggles() {
  const map = refs.map;
  toggleLayer(layers.cloud, document.getElementById('cloudToggle').checked);
  toggleLayer(layers.pulses, document.getElementById('pulseToggle').checked);
  toggleLayer(layers.tracks, document.getElementById('trackToggle').checked);
  toggleLayer(layers.cones, document.getElementById('coneToggle').checked);
  toggleLayer(layers.lightning, document.getElementById('lightningToggle').checked);
  if (layers.alley) (document.getElementById('alleyToggle').checked ? layers.alley.addTo(map) : map.removeLayer(layers.alley));
  if (layers.states) (document.getElementById('stateToggle').checked ? layers.states.addTo(map) : map.removeLayer(layers.states));
}

export function initMap() {
  const map = L.map('map', { zoomControl: false, minZoom: 3, maxZoom: 8, preferCanvas: true }).fitBounds([[6, -130], [61, -50]]);
  refs.map = map;
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 8 }).addTo(map);
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 8, opacity: .78 }).addTo(map);

  const cloudPane = map.createPane('clouds');
  cloudPane.style.zIndex = 350;
  cloudPane.style.pointerEvents = 'none';
  const cloudSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520"><filter id="b"><feGaussianBlur stdDeviation="16"/></filter><g filter="url(#b)" fill="white"><ellipse opacity=".28" cx="780" cy="70" rx="330" ry="58"/><ellipse opacity=".22" cx="820" cy="430" rx="210" ry="44"/><ellipse opacity=".20" cx="380" cy="270" rx="180" ry="38"/><ellipse opacity=".18" cx="160" cy="340" rx="240" ry="44"/></g></svg>`);
  layers.cloud.push(L.imageOverlay(cloudSvg, [[5, -130], [62, -50]], { opacity: .50, pane: 'clouds' }).addTo(map));

  fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(g => {
      layers.states = L.geoJSON(g, { style: { color: 'rgba(255,255,255,.56)', weight: 1, fillOpacity: 0 }, onEachFeature: (f, l) => l.on('click', () => showState(f.properties.name)) });
      if (document.getElementById('stateToggle').checked) layers.states.addTo(map);
    })
    .catch(err => {
      console.warn('State borders unavailable:', err.message);
      const t = document.getElementById('stateToggle');
      if (t) { t.checked = false; t.disabled = true; const lbl = t.closest('.toggle'); if (lbl) lbl.title = 'State borders could not be loaded (offline or source unavailable)'; }
    });

  L.marker([57, -102], { icon: L.divIcon({ html: '<div class="north-label">CANADA</div>', className: '', iconSize: [120, 24] }) }).addTo(map);
  L.marker([39, -98], { icon: L.divIcon({ html: '<div class="north-label">UNITED STATES</div>', className: '', iconSize: [180, 24] }) }).addTo(map);
  L.marker([23.5, -102], { icon: L.divIcon({ html: '<div class="north-label">MEXICO</div>', className: '', iconSize: [120, 24] }) }).addTo(map);
  L.marker([9, -66], { icon: L.divIcon({ html: '<div class="north-label">VENEZUELA</div>', className: '', iconSize: [150, 24] }) }).addTo(map);

  [['TX', 31, -99], ['OK', 35.6, -97.5], ['KS', 38.5, -98], ['NE', 41.5, -99.7], ['SD', 44.5, -100], ['LA', 31, -92], ['FL', 27.8, -81.7], ['GA', 32.7, -83.4], ['NC', 35.5, -79.5], ['CA', 36.7, -119.7], ['CO', 39, -105.6], ['MN', 46.3, -94.3], ['MI', 44.5, -85], ['NY', 42.9, -75]]
    .forEach(([c, lat, lng]) => L.marker([lat, lng], { icon: L.divIcon({ html: `<div class="state-label ${['TX', 'OK', 'KS', 'NE', 'SD'].includes(c) ? 'hot' : ''}">${c}</div>`, className: '', iconSize: [32, 16] }) }).addTo(map));

  layers.alley = L.polygon([[49, -104], [49, -94], [31.8, -94], [31.8, -104]], { color: '#ffd64a', weight: 2, fillColor: '#ffd64a', fillOpacity: .18 }).addTo(map);

  drawObjects();
  addLightning();
  document.querySelectorAll('.right input[type=checkbox]').forEach(x => x.onchange = applyToggles);
}
