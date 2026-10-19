import { describe, expect, it, vi } from 'vitest';
import { spot, type AircraftSnapshot, type Observation } from '../engine';
import { createRouteClient, fetchRoutesForSighting, type RouteClient, type RouteStorage } from './routeApi';
import brooklynSnapshot from '../engine/__fixtures__/adsblol-point-brooklyn.json';
import adsbdbRPA4791 from '../engine/__fixtures__/adsbdb-callsign-RPA4791.json';
import adsbdbNotFound from '../engine/__fixtures__/adsbdb-callsign-notfound.json';
import hexdbDAL1636 from '../engine/__fixtures__/hexdb-route-DAL1636.json';
import hexdbRouteNotFound from '../engine/__fixtures__/hexdb-route-notfound.json';

const NOON = Date.UTC(2026, 9, 18, 16, 0); // midday in New York
const ONE_DAY = 24 * 60 * 60 * 1000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fake network: URL → response (or thrown error). Unlisted URLs are 404s. */
function fakeFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const handler = routes[String(input)];
    return handler ? handler() : json({ status: '404' }, 404);
  });
}

function memoryStorage(): RouteStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const ADSBDB = 'https://api.adsbdb.com/v0/callsign/';
const HEXDB_ROUTE = 'https://hexdb.io/api/v1/route/icao/';
const HEXDB_AIRPORT = 'https://hexdb.io/api/v1/airport/icao/';

const hexdbAirports = {
  [`${HEXDB_AIRPORT}KILM`]: () =>
    json({ country_code: 'US', region_name: 'North Carolina', iata: 'ILM', icao: 'KILM', airport: 'Wilmington International Airport', latitude: 34.2706, longitude: -77.9026 }),
  [`${HEXDB_AIRPORT}KATL`]: () =>
    json({ country_code: 'US', region_name: 'Georgia', iata: 'ATL', icao: 'KATL', airport: 'Hartsfield-Jackson Atlanta International Airport', latitude: 33.6367, longitude: -84.4281 }),
};

describe('route client', () => {
  it('reads the route, airline and city names from adsbdb', async () => {
    const fetch = fakeFetch({ [`${ADSBDB}RPA4791`]: () => json(adsbdbRPA4791) });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    expect(await client.lookup('RPA4791')).toEqual({
      airline: 'Republic Airlines',
      origin: { code: 'CMH', city: 'Columbus', lat: 39.998, lon: -82.8919 },
      destination: { code: 'LGA', city: 'New York', lat: 40.7772, lon: -73.8726 },
    });
  });

  it('falls back to hexdb when adsbdb does not know the callsign', async () => {
    const fetch = fakeFetch({
      [`${ADSBDB}DAL1636`]: () => json(adsbdbNotFound, 404),
      [`${HEXDB_ROUTE}DAL1636`]: () => json(hexdbDAL1636),
      ...hexdbAirports,
    });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    expect(await client.lookup('DAL1636')).toEqual({
      origin: { code: 'ILM', city: 'Wilmington', lat: 34.2706, lon: -77.9026 },
      destination: { code: 'ATL', city: 'Hartsfield-Jackson Atlanta', lat: 33.6367, lon: -84.4281 },
    });
  });

  it('falls back to hexdb when adsbdb cannot be reached', async () => {
    const fetch = fakeFetch({
      [`${ADSBDB}DAL1636`]: () => {
        throw new TypeError('Load failed');
      },
      [`${HEXDB_ROUTE}DAL1636`]: () => json(hexdbDAL1636),
      ...hexdbAirports,
    });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    expect(await client.lookup('DAL1636')).toMatchObject({ origin: { code: 'ILM' }, destination: { code: 'ATL' } });
  });

  it('gives nothing when neither service knows the callsign', async () => {
    const fetch = fakeFetch({
      [`${ADSBDB}N123AB`]: () => json(adsbdbNotFound, 404),
      [`${HEXDB_ROUTE}N123AB`]: () => json(hexdbRouteNotFound, 404),
    });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    expect(await client.lookup('N123AB')).toBeUndefined();
  });

  it('gives nothing when hexdb names an airport it cannot place', async () => {
    const fetch = fakeFetch({
      [`${ADSBDB}DAL1636`]: () => json(adsbdbNotFound, 404),
      [`${HEXDB_ROUTE}DAL1636`]: () => json(hexdbDAL1636),
      [`${HEXDB_AIRPORT}KILM`]: hexdbAirports[`${HEXDB_AIRPORT}KILM`],
    });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    expect(await client.lookup('DAL1636')).toBeUndefined();
  });

  it('gives nothing, without throwing, when there is no signal at all', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Load failed');
    });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    expect(await client.lookup('RPA4791')).toBeUndefined();
  });

  it('remembers a route on the device for the rest of the day', async () => {
    const fetch = fakeFetch({ [`${ADSBDB}RPA4791`]: () => json(adsbdbRPA4791) });
    const storage = memoryStorage();
    let now = NOON;
    const client = () => createRouteClient({ fetch, storage, now: () => now });

    await client().lookup('RPA4791');
    now = NOON + 3 * 60 * 60 * 1000;
    const later = await client().lookup('RPA4791');

    expect(later).toMatchObject({ destination: { code: 'LGA' } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('looks the route up again the next day', async () => {
    const fetch = fakeFetch({ [`${ADSBDB}RPA4791`]: () => json(adsbdbRPA4791) });
    const storage = memoryStorage();
    let now = NOON;
    const client = createRouteClient({ fetch, storage, now: () => now });

    await client.lookup('RPA4791');
    now = NOON + ONE_DAY;
    await client.lookup('RPA4791');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('remembers for the day that no route is known', async () => {
    const fetch = fakeFetch({ [`${ADSBDB}N123AB`]: () => json(adsbdbNotFound, 404) });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    await client.lookup('N123AB');
    const calls = fetch.mock.calls.length;
    expect(await client.lookup('N123AB')).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(calls);
  });

  it('does not remember a lookup that failed for lack of signal', async () => {
    let online = false;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (!online) throw new TypeError('Load failed');
      return String(input) === `${ADSBDB}RPA4791` ? json(adsbdbRPA4791) : json({}, 404);
    });
    const client = createRouteClient({ fetch, storage: memoryStorage(), now: () => NOON });

    expect(await client.lookup('RPA4791')).toBeUndefined();
    online = true;
    expect(await client.lookup('RPA4791')).toMatchObject({ origin: { city: 'Columbus' } });
  });

  it('still looks routes up when on-device storage is unavailable', async () => {
    const fetch = fakeFetch({ [`${ADSBDB}RPA4791`]: () => json(adsbdbRPA4791) });
    const broken: RouteStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const client = createRouteClient({ fetch, storage: broken, now: () => NOON });

    expect(await client.lookup('RPA4791')).toMatchObject({ origin: { city: 'Columbus' } });
  });
});

describe('spotting with routes', () => {
  // Real RPA4791 over Sunset Park, descending toward LaGuardia: ~2.6 nm south-southwest of Prospect Heights, ~9.5° up.
  const observation = { lat: 40.68, lon: -73.97, heading: 202, elevation: 9.5, time: NOON };
  const snapshot = brooklynSnapshot as AircraftSnapshot;

  async function spotWithRoutes(obs: Observation, sky: AircraftSnapshot, client: RouteClient) {
    const result = spot(obs, sky, await fetchRoutesForSighting(obs, sky, client));
    if (result.kind !== 'matched') throw new Error(`expected a match, got ${result.kind}`);
    return result;
  }

  it('adds the route to the Verdict of the plane being pointed at', async () => {
    const fetch = fakeFetch({ [`${ADSBDB}RPA4791`]: () => json(adsbdbRPA4791) });
    const result = await spotWithRoutes(observation, snapshot, createRouteClient({ fetch, now: () => NOON }));

    expect(result.kidLine).toBe('Coming down to LaGuardia from Columbus! Bye-bye, sky! 🛬');
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([`${ADSBDB}RPA4791`]);
  });

  it('still gives the motion Verdict when the route lookup fails', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Load failed');
    });
    const result = await spotWithRoutes(observation, snapshot, createRouteClient({ fetch, now: () => NOON }));

    expect(result.kidLine).toBe('Coming down to LaGuardia! Bye-bye, sky! 🛬');
  });
});
