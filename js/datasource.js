// Data source manager: selects the active source, loads normalized entities,
// and falls back to mock data on failure so the UI is never left empty/broken.
//
// Modes:
//   'mock' — offline concept data only (all simulated)
//   'nws'  — live real weather: NWS alerts + NHC tropical cyclones (observed/forecast).
//            EMP sources are omitted (they are simulated-only). Falls back to mock
//            if BOTH live sources fail; tolerates one failing.
//   'both' — live real weather (NWS + NHC) storms + mock EMP sources (simulated).

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

// Load the live real-weather sources (NWS alerts + NHC cyclones) in parallel.
// Returns merged storms plus a per-source status so callers can report partial
// failures. Throws only if BOTH sources fail.
async function loadLive(opts) {
  const [nwsR, nhcR] = await Promise.allSettled([nws.load(opts), nhc.load(opts)]);
  const storms = [];
  const status = {};
  let okCount = 0;

  if (nwsR.status === 'fulfilled') { storms.push(...nwsR.value.storms); status.nws = nwsR.value.meta; okCount++; }
  else status.nws = { error: String(nwsR.reason && nwsR.reason.message || nwsR.reason) };

  if (nhcR.status === 'fulfilled') { storms.push(...nhcR.value.storms); status.nhc = nhcR.value.meta; okCount++; }
  else status.nhc = { error: String(nhcR.reason && nhcR.reason.message || nhcR.reason) };

  if (okCount === 0) throw new Error(`live sources failed (nws: ${status.nws.error}; nhc: ${status.nhc.error})`);

  return {
    storms,
    partial: okCount < 2, // one source failed but we still have data
    meta: {
      source: 'NWS+NHC',
      fetchedAt: new Date().toISOString(),
      sources: status,
      note: 'Live real weather: NWS alerts + NHC cyclones. NHC forward tracks are approximate (motion-derived).'
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
