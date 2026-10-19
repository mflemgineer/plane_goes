/**
 * Position proxy: GET /api/aircraft?lat=..&lon=..&radius=..
 *
 * Forwards a point + radius query to adsb.lol, which doesn't allow browser
 * requests (no CORS). Runs as a Vercel Node function on the same origin as
 * the app. Responses:
 *   200 — adsb.lol Aircraft Snapshot JSON, edge-cached for a few seconds
 *   400 — { error: "bad_request", message }
 *   429 — { error: "busy", retryAfter } when adsb.lol rate-limits us
 *   502 — { error: "upstream" } when adsb.lol is unreachable or errors
 */

const ADSB_LOL_BASE = 'https://api.adsb.lol';
const USER_AGENT =
  'plane_goes/0.1 (hobby toddler plane-spotting app; +https://github.com/mflemgineer/plane_goes)';

/** Nautical miles. ~25 statute miles is what the app searches. */
export const DEFAULT_RADIUS_NM = 25;
export const MAX_RADIUS_NM = 30;
/** Seconds the CDN may serve a cached snapshot. */
const CACHE_SECONDS = 5;
const UPSTREAM_TIMEOUT_MS = 8000;

/**
 * The single place to add adsb.lol credentials if they ever require an API key
 * (e.g. read it from process.env and add the header adsb.lol documents).
 */
function upstreamHeaders(): Record<string, string> {
  return { 'user-agent': USER_AGENT, accept: 'application/json' };
}

function json(body: unknown, status: number, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });
}

function parseCoord(raw: string | null, limit: number): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return undefined;
  // Round to 2 dp (~1 km): better edge-cache hit rate and we never forward the exact spot.
  return Math.round(n * 100) / 100;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const lat = parseCoord(params.get('lat'), 90);
  const lon = parseCoord(params.get('lon'), 180);
  if (lat === undefined || lon === undefined) {
    return json({ error: 'bad_request', message: 'lat and lon are required numbers' }, 400);
  }

  const requested = Number(params.get('radius') ?? DEFAULT_RADIUS_NM);
  const radius = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.round(requested), MAX_RADIUS_NM)
    : DEFAULT_RADIUS_NM;

  let upstream: Response;
  try {
    upstream = await fetch(`${ADSB_LOL_BASE}/v2/point/${lat}/${lon}/${radius}`, {
      headers: upstreamHeaders(),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: 'upstream' }, 502);
  }

  if (upstream.status === 429) {
    const retryAfter = Number(upstream.headers.get('retry-after') ?? upstream.headers.get('x-ratelimit-reset') ?? 5);
    return json({ error: 'busy', retryAfter: Number.isFinite(retryAfter) ? retryAfter : 5 }, 429);
  }
  if (!upstream.ok) {
    return json({ error: 'upstream', status: upstream.status }, 502);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Browsers ignore s-maxage; Vercel's CDN caches for CACHE_SECONDS.
      'cache-control': `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
    },
  });
}
