/**
 * Route lookups (callsign → origin/destination), straight from the browser:
 * adsbdb first, hexdb as fallback. Results — including "no route known" — are
 * cached on the device per callsign for the rest of the day, so repeat Sightings
 * of the same Flight cost nothing. A failed lookup just means no route.
 */
import { spot, type AircraftSnapshot, type Observation, type Route, type RouteAirport, type RouteLookup } from '../engine';

export type RouteStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface RouteClientOptions {
  fetch?: typeof fetch;
  /** On-device storage for the daily cache; omit (or null) to skip caching. */
  storage?: RouteStorage | null;
  now?: () => number;
  /** Per-request timeout: a slow route service must not hold up the Verdict. */
  timeoutMs?: number;
}

export interface RouteClient {
  lookup(callsign: string): Promise<Route | undefined>;
}

const ADSBDB_CALLSIGN = 'https://api.adsbdb.com/v0/callsign/';
const HEXDB_ROUTE = 'https://hexdb.io/api/v1/route/icao/';
const HEXDB_AIRPORT = 'https://hexdb.io/api/v1/airport/icao/';

const CACHE_KEY = 'plane-goes:routes';
const DEFAULT_TIMEOUT_MS = 4000;

/** Tunable: at most this many route lookups per Sighting (the matched plane and its runners-up). */
export const MAX_ROUTE_LOOKUPS_PER_SIGHTING = 5;

/** What one service told us: a route, a definite "don't know", or no answer at all. */
type Answer = { kind: 'route'; route: Route } | { kind: 'unknown' } | { kind: 'no-answer' };

interface DayCache {
  day: string;
  /** callsign → route, or null for "no route known today". */
  routes: Record<string, Route | null>;
}

export function createRouteClient({
  fetch: fetchImpl = (...args) => fetch(...args),
  storage = null,
  now = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RouteClientOptions = {}): RouteClient {
  async function getJson(url: string): Promise<{ status: number; body?: unknown } | undefined> {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) return { status: response.status };
      return { status: response.status, body: await response.json() };
    } catch {
      // Offline, timed out, or (hexdb 404s carry no CORS header) a miss the browser hides from us.
      return undefined;
    }
  }

  async function fromAdsbdb(callsign: string): Promise<Answer> {
    const reply = await getJson(ADSBDB_CALLSIGN + encodeURIComponent(callsign));
    if (!reply) return { kind: 'no-answer' };
    const route = reply.body === undefined ? undefined : parseAdsbdb(reply.body);
    if (route) return { kind: 'route', route };
    return reply.status === 404 ? { kind: 'unknown' } : { kind: 'no-answer' };
  }

  async function fromHexdb(callsign: string): Promise<Answer> {
    const reply = await getJson(HEXDB_ROUTE + encodeURIComponent(callsign));
    const codes = parseHexdbRoute(reply?.body);
    if (!codes) return reply?.status === 404 ? { kind: 'unknown' } : { kind: 'no-answer' };
    const [origin, destination] = await Promise.all(codes.map(hexdbAirport));
    return origin && destination ? { kind: 'route', route: { origin, destination } } : { kind: 'no-answer' };
  }

  async function hexdbAirport(icao: string): Promise<RouteAirport | undefined> {
    const reply = await getJson(HEXDB_AIRPORT + encodeURIComponent(icao));
    return parseHexdbAirport(reply?.body);
  }

  const today = () => {
    const d = new Date(now());
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  function readCache(): DayCache {
    try {
      const cache = JSON.parse(storage?.getItem(CACHE_KEY) ?? 'null') as DayCache | null;
      if (cache && cache.day === today() && typeof cache.routes === 'object') return cache;
    } catch {
      // Unreadable or unavailable storage: start fresh.
    }
    return { day: today(), routes: {} };
  }

  function remember(callsign: string, route: Route | null): void {
    const cache = readCache(); // a new day drops yesterday's entries
    cache.routes[callsign] = route;
    try {
      storage?.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Private mode or full storage: we'll just ask again next time.
    }
  }

  return {
    async lookup(raw) {
      const callsign = raw.trim().toUpperCase();
      if (!callsign) return undefined;
      const cached = readCache().routes[callsign];
      if (cached !== undefined) return cached ?? undefined;

      const adsbdb = await fromAdsbdb(callsign);
      if (adsbdb.kind === 'route') {
        remember(callsign, adsbdb.route);
        return adsbdb.route;
      }
      const hexdb = await fromHexdb(callsign);
      if (hexdb.kind === 'route') {
        remember(callsign, hexdb.route);
        return hexdb.route;
      }
      // Only a definite "unknown callsign" from adsbdb is worth remembering; hexdb misses look like
      // network errors in the browser, and a lookup with no signal should be retried next time.
      if (adsbdb.kind === 'unknown') remember(callsign, null);
      return undefined;
    },
  };
}

/**
 * Fetches the routes one Sighting needs and hands back a plain synchronous lookup for the engine.
 * A dry run of `spot` learns which callsigns the engine asks about (the matched plane, or each
 * "not that one?" candidate); only those are fetched. The engine itself never fetches.
 * Callsigns not fetched (e.g. far down the all-nearby list) simply have no route.
 */
export async function fetchRoutesForSighting(
  observation: Observation,
  snapshot: AircraftSnapshot,
  client: RouteClient,
): Promise<RouteLookup> {
  const wanted: string[] = [];
  spot(observation, snapshot, (callsign) => {
    if (!wanted.includes(callsign)) wanted.push(callsign);
    return undefined;
  });
  const asked = wanted.slice(0, MAX_ROUTE_LOOKUPS_PER_SIGHTING);
  const found = new Map(await Promise.all(asked.map(async (cs) => [cs, await client.lookup(cs)] as const)));
  return (callsign) => found.get(callsign);
}

// ---- Response parsing (shapes recorded in src/engine/__fixtures__) ----

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

function parseAdsbdbEnd(end: unknown): RouteAirport | undefined {
  if (!isRecord(end) || !isNumber(end.latitude) || !isNumber(end.longitude)) return undefined;
  const code = isText(end.iata_code) ? end.iata_code : isText(end.icao_code) ? end.icao_code : undefined;
  const city = isText(end.municipality) ? end.municipality : isText(end.name) ? shortAirportName(end.name) : undefined;
  if (!code || !city) return undefined;
  return { code, city, lat: end.latitude, lon: end.longitude };
}

function parseAdsbdb(body: unknown): Route | undefined {
  const flightroute = isRecord(body) && isRecord(body.response) ? body.response.flightroute : undefined;
  if (!isRecord(flightroute)) return undefined;
  const origin = parseAdsbdbEnd(flightroute.origin);
  const destination = parseAdsbdbEnd(flightroute.destination);
  if (!origin || !destination) return undefined;
  const airline = isRecord(flightroute.airline) && isText(flightroute.airline.name) ? flightroute.airline.name : undefined;
  return airline ? { airline, origin, destination } : { origin, destination };
}

/** hexdb gives "KILM-KATL" (sometimes more legs, "A-B-C"): take the first and last airports. */
function parseHexdbRoute(body: unknown): [string, string] | undefined {
  if (!isRecord(body) || !isText(body.route)) return undefined;
  const legs = body.route.split('-').map((s) => s.trim()).filter(Boolean);
  return legs.length >= 2 ? [legs[0], legs[legs.length - 1]] : undefined;
}

function parseHexdbAirport(body: unknown): RouteAirport | undefined {
  if (!isRecord(body) || !isNumber(body.latitude) || !isNumber(body.longitude) || !isText(body.airport)) return undefined;
  const code = isText(body.iata) ? body.iata : isText(body.icao) ? body.icao : undefined;
  if (!code) return undefined;
  // hexdb has no city, so say the airport's short name ("Wilmington International Airport" → "Wilmington").
  return { code, city: shortAirportName(body.airport), lat: body.latitude, lon: body.longitude };
}

function shortAirportName(name: string): string {
  return name.replace(/\s+(International\s+)?Airport$/i, '').trim() || name;
}
