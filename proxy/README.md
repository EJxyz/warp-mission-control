# NHC CORS proxy (Cloudflare Worker)

A tiny [Cloudflare Worker](https://developers.cloudflare.com/workers/) that lets the
WARP app load **live tropical cyclones** from the National Hurricane Center.

## Why it's needed

NHC serves [`CurrentStorms.json`](https://www.nhc.noaa.gov/CurrentStorms.json) **without a
CORS header**, so a browser on a static-site origin (e.g. GitHub Pages) can't fetch it
directly — the request fails with a CORS error. This Worker fetches the JSON server-side
(where CORS doesn't apply) and re-serves it with `Access-Control-Allow-Origin`, so the
browser can read it. It proxies **only** that one NHC URL — it is not an open proxy.

## Files

- `nhc-worker.js` — the Worker (fetch upstream → return with CORS + short cache; handles
  `OPTIONS` preflight; passes upstream/errors through as JSON).
- `wrangler.toml` — Worker config. No bindings, secrets, or KV needed.

## Deploy

### Option A — Wrangler CLI (recommended)

```bash
npm install -g wrangler     # if you don't have it
wrangler login              # one-time browser auth to your Cloudflare account
cd proxy
wrangler deploy
```

Wrangler prints the deployed URL, e.g.:

```
https://warp-nhc-proxy.<your-subdomain>.workers.dev
```

### Option B — Cloudflare dashboard (no CLI)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Create Worker**.
2. Replace the default code with the contents of `nhc-worker.js`, then **Deploy**.
3. Copy the Worker's URL from the dashboard.

## Point the app at it

The WARP app is already wired to use a proxy. In the app's browser console:

```js
WARP.setNhcProxy('https://warp-nhc-proxy.<your-subdomain>.workers.dev/');
// then load live data (if not already):
WARP.setMode('nws');   // or 'both'
```

The proxy URL is remembered (localStorage), so it persists across reloads. To disable:

```js
WARP.setNhcProxy(null);
```

## Verify

Hitting the Worker URL directly in a browser should return the NHC JSON with an
`access-control-allow-origin` header (check DevTools → Network). In the app, tropical
cyclones from NHC should then appear alongside NWS alerts.

## Notes / limitations

- **Free tier is plenty** — this is a handful of requests with a 5-minute edge cache.
- **Lock it down (optional):** in `nhc-worker.js`, set `ALLOW_ORIGIN` to your exact site
  origin (e.g. `https://ejxyz.github.io`) instead of `'*'` so only your app can use it.
- **Forecast tracks are still approximate.** Even with live cyclone positions, NHC's
  official cone/track are KMZ-only (also non-CORS); the app synthesizes an *approximate*
  forward track from the reported motion vector (see `js/sources/nhc.js`).
