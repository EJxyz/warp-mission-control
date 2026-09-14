// Situation Report — a self-contained, printable summary of the current picture.
//
// buildReportHtml(appData) returns a COMPLETE standalone HTML document string
// (its own styles inline) so it can be opened in a new window and printed / saved
// as PDF with no dependencies. It is a pure function of appData for testability.
//
// HONESTY: the report carries the same discipline as the app — a life-safety
// disclaimer, explicit "estimated" labels on the population figure, and the data
// source / provenance so a reader knows exactly what they're looking at.

import { rankAlerts, MAX_SCORE } from './triage.js';
import { isReal, PROVENANCE_META } from './model.js';

// Escape untrusted text (alert headlines/areas come from an external API).
function esc(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const dash = v => (v === undefined || v === null || v === '') ? '—' : esc(v);
const num = n => (n === undefined || n === null) ? '—' : Number(n).toLocaleString('en-US');

function sourceLabel(meta = {}) {
  const m = meta.mode;
  const base = m === 'nws' ? 'Live NWS' : m === 'both' ? 'Live NWS + concept EMP' : 'Concept (mock)';
  if (meta.degraded) return base + ' — DEGRADED (fallback to concept data)';
  if (meta.partial) return base + ' — partial (a live source was unavailable)';
  return base;
}

function facilitiesText(entity) {
  const f = entity._facilities;
  if (!f || !f.summary) return '—';
  if (!f.summary.total) return 'none found (OpenStreetMap)';
  return f.summary.breakdown.map(b => `${b.count} × ${esc(b.label)}`).join(', ') + ` (source: ${esc(f.source)})`;
}

function peopleText(entity) {
  const p = entity._popEstimate;
  if (!p || p.people == null) return 'unknown';
  return `≈ ${num(p.people)} (estimated)`;
}

const REPORT_CSS = `
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;padding:28px 32px;font:13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;background:#fff}
  h1{font-size:20px;margin:0 0 2px}
  h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #222;padding-bottom:4px}
  .muted{color:#555}
  .disclaimer{margin:14px 0;padding:10px 12px;border:1px solid #c47f1a;border-left:5px solid #c47f1a;background:#fff7ec;border-radius:5px;font-size:12px}
  .meta{margin:6px 0 0;font-size:12px}
  .meta b{display:inline-block;min-width:110px;color:#333}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}
  th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f2f2f2}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .sim{color:#7a4fd0;font-weight:700}
  .alert-card{border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin:10px 0;page-break-inside:avoid}
  .alert-card h3{margin:0 0 4px;font-size:14px}
  .kv{margin:2px 0}.kv b{display:inline-block;min-width:150px;color:#333}
  .est{color:#b26b00;font-weight:700}
  footer{margin-top:28px;padding-top:10px;border-top:1px solid #ccc;color:#666;font-size:11px}
  @media print{body{padding:0}a{color:#000;text-decoration:none}}
`;

/**
 * Build the full standalone situation-report HTML document.
 * @param {object} appData  { storms, emps, meta }
 * @param {object} [opts]    { now } to inject a fixed timestamp (tests)
 * @returns {string} complete HTML document
 */
export function buildReportHtml(appData = {}, opts = {}) {
  const storms = Array.isArray(appData.storms) ? appData.storms : [];
  const emps = Array.isArray(appData.emps) ? appData.emps : [];
  const meta = appData.meta || {};
  const now = opts.now ? new Date(opts.now) : new Date();
  const ts = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const realStorms = storms.filter(s => isReal(s.provenance));
  const simStorms = storms.length - realStorms.length;
  const ranked = rankAlerts(realStorms);

  // Ranked summary table (real alerts).
  const rankRows = ranked.length
    ? ranked.map((r, i) => {
        const e = r.entity;
        return `<tr>
          <td class="num">${i + 1}</td>
          <td><b>${dash(e.id)}</b><br><span class="muted">${dash(e.event || e.type)}</span></td>
          <td>${dash(e.severity)}</td>
          <td>${dash((PROVENANCE_META[e.provenance] || {}).label)}</td>
          <td class="num">${e._popEstimate && e._popEstimate.people != null ? '≈ ' + num(e._popEstimate.people) : '—'}</td>
          <td class="num">${e._facilities && e._facilities.summary ? e._facilities.summary.total : '—'}</td>
          <td class="num"><b>${r.score}</b> / ${MAX_SCORE}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" class="muted">No live (observed/forecast) alerts.</td></tr>`;

  // Per-alert detail cards.
  const detailCards = ranked.map((r, i) => {
    const e = r.entity;
    return `<div class="alert-card">
      <h3>#${i + 1} · ${dash(e.id)} — ${dash(e.event || e.type)}</h3>
      <div class="kv"><b>Provenance</b> ${dash((PROVENANCE_META[e.provenance] || {}).label)}</div>
      <div class="kv"><b>Severity / Urgency</b> ${dash(e.severity)} / ${dash(e.urgency)}</div>
      <div class="kv"><b>Area</b> ${dash(e.areaDesc)}</div>
      ${e.headline ? `<div class="kv"><b>Headline</b> ${esc(e.headline)}</div>` : ''}
      <div class="kv"><b>People in area</b> <span class="est">${peopleText(e)}</span></div>
      <div class="kv"><b>Critical facilities</b> ${facilitiesText(e)}</div>
      <div class="kv"><b>Exposure score</b> ${r.score} / ${MAX_SCORE}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>WARP Situation Report — ${ts}</title><style>${REPORT_CSS}</style></head>
<body>
  <h1>WARP Situation Report</h1>
  <div class="meta muted">Generated ${ts}</div>
  <div class="meta"><b>Data source</b> ${esc(sourceLabel(meta))}</div>

  <div class="disclaimer">
    <b>⚠ Situational-awareness aid — not an official warning system.</b>
    Data may be delayed, incomplete, or estimated, and the absence of an alert here does not mean an area is safe.
    People-in-area figures are <b>rough estimates</b>, not authoritative counts. For life-safety decisions rely on the
    National Weather Service (weather.gov) and local emergency management.
  </div>

  <h2>Summary</h2>
  <div class="meta"><b>Active alerts</b> ${storms.length} (${realStorms.length} real, <span class="sim">${simStorms} simulated</span>)</div>
  <div class="meta"><b>EMP sources</b> ${emps.length} (all simulated)</div>

  <h2>Alerts ranked by exposure</h2>
  <table>
    <thead><tr><th>#</th><th>Alert</th><th>Severity</th><th>Origin</th><th>People (est.)</th><th>Facilities</th><th>Score</th></tr></thead>
    <tbody>${rankRows}</tbody>
  </table>
  <div class="muted" style="font-size:11px">Score is a transparent prioritization aid (max ${MAX_SCORE}), not an official risk index. People figures are estimates.</div>

  ${detailCards ? `<h2>Alert detail</h2>${detailCards}` : ''}

  <footer>WARP Mission Control — concept / research build. Real (observed/forecast) and simulated data are kept separate; simulated items are labeled. This report reflects the app state at generation time only.</footer>
</body></html>`;
}
