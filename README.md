# plane_goes

Point your phone at a plane, tap one big button, and find out where it's going. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for decisions.

## Layout

- `src/engine/` — the **Sighting Engine**: a pure module (no network, sensors or storage). `spot(observation, snapshot)` returns a Sighting Result. Tests live next to it and go through `src/engine/index.ts` only. Real API fixtures are in `src/engine/__fixtures__/`.
- `src/shell/` — browser adapters: one-shot location, the proxy client.
- `src/main.ts`, `src/ui/`, `index.html` — the UI shell (plain DOM, no framework).
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
