// Cloudflare Worker — CORS proxy for NHC CurrentStorms.json.
//
// WHY THIS EXISTS: the National Hurricane Center serves CurrentStorms.json
// WITHOUT an Access-Control-Allow-Origin header, so a browser on a static-site
// origin (e.g. GitHub Pages) cannot fetch it directly — the request fails with a
// CORS error. This tiny Worker fetches the JSON server-side (where CORS does not
// apply) and re-serves it with permissive CORS headers, so the WARP app can load
// live tropical cyclones. Point the app at this Worker's URL via
// WARP.setNhcProxy('https://<your-worker-url>/').
//
// It only proxies ONE upstream (the NHC JSON) — it is not an open proxy.
//
// Deploy: see proxy/README.md.

const UPSTREAM = 'https://www.nhc.noaa.gov/CurrentStorms.json';

// Restrict who may call this Worker. '*' allows any origin (simplest for a public
// demo). To lock it to your site, replace with e.g. 'https://ejxyz.github.io'.
const ALLOW_ORIGIN = '*';

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra
  };
}

export default {
  async fetch(request) {
    // CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
    }

    try {
      const upstream = await fetch(UPSTREAM, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'WARP-NHC-proxy (Cloudflare Worker)' },
        // Cache at the edge for 5 minutes to be a good citizen / reduce load.
        cf: { cacheTtl: 300, cacheEverything: true }
      });

      if (!upstream.ok) {
        return new Response(
          JSON.stringify({ error: `Upstream NHC returned ${upstream.status}` }),
          { status: 502, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
        );
      }

      // Pass the JSON through unchanged, with CORS + a short browser cache.
      const body = await upstream.text();
      return new Response(body, {
        status: 200,
        headers: corsHeaders({
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        })
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy fetch failed: ' + (err && err.message || String(err)) }),
        { status: 502, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
      );
    }
  }
};
