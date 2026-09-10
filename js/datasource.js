// Data source manager: selects the active source, loads normalized entities,
// and falls back to mock data on failure so the UI is never left empty/broken.
//
// Modes:
//   'mock' — offline concept data only (all simulated)
//   'nws'  — live NWS alerts only (observed/forecast); falls back to mock on error
//   'both' — live NWS storms + mock EMP sources (EMP is always simulated)

import * as mock from './sources/mock.js';
import * as nws from './sources/nws.js';

export const MODES = ['mock', 'nws', 'both'];

// Result shape returned to consumers:
// { storms: Entity[], emps: Entity[], meta: { mode, source, degraded, error?, ... } }

async function loadMock() {
  const r = await mock.load();
  return { storms: r.storms, emps: r.emps, meta: { ...r.meta, mode: 'mock', degraded: false } };
}

async function loadNws(opts) {
  const r = await nws.load(opts);
  return { storms: r.storms, emps: r.emps, meta: { ...r.meta, mode: 'nws', degraded: false } };
}

/**
 * Load entities for the given mode. Never rejects: on failure it returns mock
 * data with meta.degraded=true and meta.error set, so callers can surface a
 * warning while still rendering something honest.
 * @param {'mock'|'nws'|'both'} mode
 * @param {object} [opts] forwarded to the NWS source (e.g. { area })
 */
export async function load(mode = 'mock', opts = {}) {
  try {
    if (mode === 'mock') return await loadMock();

    if (mode === 'nws') {
      try {
        const r = await loadNws(opts);
        // If live returns zero mappable storms, keep it (empty is a valid state)
        // but flag it so the UI can show an empty/notice state.
        return r;
      } catch (err) {
        const fb = await loadMock();
        fb.meta = { ...fb.meta, mode: 'nws', degraded: true, error: String(err.message || err) };
        return fb;
      }
    }

    if (mode === 'both') {
      const mockRes = await loadMock();
      try {
        const live = await loadNws(opts);
        return {
          storms: live.storms,
          emps: mockRes.emps, // EMP sources always come from the simulated side
          meta: { ...live.meta, mode: 'both', degraded: false }
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

export const sources = { mock: mock.info, nws: nws.info };
