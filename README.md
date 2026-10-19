# plane_goes

Point your phone at a plane, tap one big button, and find out where it's going. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for decisions.

## Layout

- `src/engine/` — the **Sighting Engine**: a pure module (no network, sensors or storage). `spot(observation, snapshot)` returns a Sighting Result. Tests live next to it and go through `src/engine/index.ts` only. Real API fixtures are in `src/engine/__fixtures__/`. Aircraft matching (which plane the phone points at) lives in `src/engine/match.ts`; tune `SEARCH_RADIUS_MILES` and `MATCH_TOLERANCE_DEG` there. The airport set lives in `src/engine/airports.ts`; the Verdict's altitude, vertical-rate, distance and track thresholds are named constants at the top of `src/engine/verdict.ts`. Kid Line templates are in `src/engine/kidLine.ts`.
- `src/log/` — the **Sighting Log**: a pure module with an injected clock and storage. `createSightingLog({ clock, storage })` adds Sightings (credited to the Spotter), lists Walks newest first and gets/sets the Spotter name. Tests go through `src/log/index.ts` only, with a fake clock and `memoryStorage()`. Records are built from an allow-list, so the observer's location and heading are never stored. Tune the Walk gap with `WALK_GAP_MS`.
- `src/shell/` — browser adapters: one-shot location, the proxy client, voice (`voice.ts`: reads the Kid Line aloud; muted by default, female English voice preferred; tune voice names in `FEMALE_NAMES`), the app's Sighting Log on `localStorage` (`sightingLog.ts`).
- `src/main.ts`, `src/ui/`, `index.html` — the UI shell (plain DOM, no framework).
- `src/ui/friendlyMessage.ts` — every failure (no signal, proxy busy, location off, anything unexpected) becomes a gentle message; the UI never shows raw errors.
- `public/` — the web app manifest and icons for **Add to Home Screen**. `public/icons/icon.svg` is the source; regenerate the PNGs (incl. `apple-touch-icon.png`) with `python3 scripts/make-icons.py` (needs Pillow).
- `api/aircraft.ts` — the **position proxy**, a Vercel Node function at `/api/aircraft?lat=..&lon=..[&radius=nm]`. It forwards to adsb.lol with a descriptive User-Agent, caps the radius at 30 nm (default 25), edge-caches for 5 s, and returns HTTP 429 `{"error":"busy"}` when adsb.lol rate-limits. If adsb.lol ever needs an API key, add it in `upstreamHeaders()`.

## Run, test, build

Requires Node 20+.

```sh
npm install
npm run dev     # Vite dev server; /api/aircraft is served by a dev middleware, no Vercel CLI needed
npm test        # all tests (Vitest)
npm run build   # typecheck + production build into dist/
```

Location needs HTTPS (or `localhost`). To try it on a phone, deploy a preview (below).

## Deploy (Vercel, free Hobby plan)

Deploys are manual for now:

1. Import the GitHub repo in the Vercel dashboard (or run `npx vercel` from the repo root and link a new project). The Vite preset and `vercel.json` set the build command and the `dist` output; files in `api/` deploy as functions automatically.
2. Deploy. Use the generated `*.vercel.app` URL; don't add a custom domain. There's no login, and the site sends `noindex` so search engines leave it alone.
3. Open the URL on the iPhone, allow location, tap **Spot!**.
