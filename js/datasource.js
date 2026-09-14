// Data source manager: selects the active source, loads normalized entities,
// and falls back to mock data on failure so the UI is never left empty/broken.
//
// Modes:
//   'mock' — offline concept data only (all simulated)
//   'nws'  — live real weather: NWS alerts (observed/forecast). NHC tropical
//            cyclones are PARKED by default because NHC's CurrentStorms.json is
//            served WITHOUT CORS headers and cannot be fetched from a browser on
//            a static site (verified). NHC is included only when a CORS-enabled
//            proxy URL is supplied via opts.nhcProxyUrl. EMP sources are omitted
//            (simulated-only). Falls back to mock if the live source(s) fail.
//   'both' — live real weather storms + mock EMP sources (simulated).

import * as mock from './sources/mock.js';
import * as nws from './sources/nws.js';
import * as nhc from './sources/nhc.js';

export const MODES = ['mock', 'nws', 'both'];

// Result shape returned to consumers:
// { storms: Entity[], emps: Entity[], meta: { mode, source, degraded, error?, ... } }

async function loadMock() {
  const r = await mock.load();
  return { storms: r.storms, emps: r.emps, meta: { ...r.meta, mode: 'mock', degraded: false } };
}

// Load the live real-weather sources. NWS is always attempted. NHC is attempted
// ONLY when a proxy URL is provided (opts.nhcProxyUrl), because NHC is CORS-blocked
// in the browser; without a proxy it is reported as `parked` (a deliberate state,
// not a failure). Returns merged storms + per-source status. Throws only if every
// ATTEMPTED live source fails.
async function loadLive(opts = {}) {
  const useNhc = !!opts.nhcProxyUrl;
  const jobs = [nws.load(opts)];
  if (useNhc) jobs.push(nhc.load({ ...opts, url: opts.nhcProxyUrl }));

  const results = await Promise.allSettled(jobs);
  const storms = [];
  const status = {};
  let attempted = 0, okCount = 0;

  // NWS (always attempted, index 0)
  attempted++;
  const nwsR = results[0];
  if (nwsR.status === 'fulfilled') { storms.push(...nwsR.value.storms); status.nws = nwsR.value.meta; okCount++; }
  else status.nws = { error: String(nwsR.reason && nwsR.reason.message || nwsR.reason) };

  // NHC (attempted only with a proxy; otherwise parked)
  if (useNhc) {
    attempted++;
    const nhcR = results[1];
    if (nhcR.status === 'fulfilled') { storms.push(...nhcR.value.storms); status.nhc = nhcR.value.meta; okCount++; }
    else status.nhc = { error: String(nhcR.reason && nhcR.reason.message || nhcR.reason) };
  } else {
    status.nhc = { parked: true, reason: 'NHC CurrentStorms.json is CORS-blocked in browsers; supply a proxy (config.nhcProxyUrl) to enable.' };
  }

  if (okCount === 0) throw new Error(`live source(s) failed (nws: ${status.nws.error || 'n/a'})`);

  return {
    storms,
    // "partial" = fewer live sources succeeded than were attempted (a real failure),
    // NOT the deliberately-parked NHC.
    partial: okCount < attempted,
    meta: {
      source: useNhc ? 'NWS+NHC' : 'NWS',
      fetchedAt: new Date().toISOString(),
      sources: status,
      note: useNhc
        ? 'Live real weather: NWS alerts + NHC cyclones (via proxy). NHC forward tracks are approximate (motion-derived).'
        : 'Live NWS alerts (US only). NHC tropical cyclones are parked (require a CORS proxy).'
    }
  };
}

/**
 * Load entities for the given mode. Never rejects: on failure it returns mock
 * data with meta.degraded=true and meta.error set, so callers can surface a
 * warning while still rendering something honest.
 * @param {'mock'|'nws'|'both'} mode
 * @param {object} [opts] forwarded to the live sources (e.g. { area })
 */
export async function load(mode = 'mock', opts = {}) {
  try {
    if (mode === 'mock') return await loadMock();

    if (mode === 'nws') {
      try {
        const live = await loadLive(opts);
        return { storms: live.storms, emps: [], meta: { ...live.meta, mode: 'nws', degraded: false, partial: live.partial } };
      } catch (err) {
        const fb = await loadMock();
        fb.meta = { ...fb.meta, mode: 'nws', degraded: true, error: String(err.message || err) };
        return fb;
      }
    }

    if (mode === 'both') {
      const mockRes = await loadMock();
      try {
        const live = await loadLive(opts);
        return {
          storms: live.storms,
          emps: mockRes.emps, // EMP sources always come from the simulated side
          meta: { ...live.meta, mode: 'both', degraded: false, partial: live.partial }
        };
      } catch (err) {
        return {
          storms: mockRes.storms,
          emps: mockRes.emps,
          meta: { ...mockRes.meta, mode: 'both', degraded: true, error: String(err.message || err) }
        };
      }
    }

    throw new Error(`Unknown data source mode: ${mode}`);
  } catch (err) {
    // Absolute last-resort guard.
    const fb = await loadMock();
    fb.meta = { ...fb.meta, mode, degraded: true, error: String(err.message || err) };
    return fb;
  }
}

export const sources = { mock: mock.info, nws: nws.info, nhc: nhc.info };
