import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNearbyAircraft } from './aircraftApi';

const here = { lat: 40.68, lon: -73.97 };

function respondWith(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNearbyAircraft', () => {
  it('reports busy when the proxy says adsb.lol is rate-limiting', async () => {
    respondWith(async () => new Response(JSON.stringify({ error: 'busy', retryAfter: 5 }), { status: 429 }));
    expect(await fetchNearbyAircraft(here)).toEqual({ ok: false, reason: 'busy' });
  });

  it('reports offline when the network request cannot be made', async () => {
    respondWith(async () => {
      throw new TypeError('Load failed');
    });
    expect(await fetchNearbyAircraft(here)).toEqual({ ok: false, reason: 'offline' });
  });

  it('reports offline when a weak signal never answers', async () => {
    respondWith(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    expect(await fetchNearbyAircraft(here, { timeoutMs: 10 })).toEqual({ ok: false, reason: 'offline' });
  });

  it('reports a general hiccup when the proxy answers with something unusable', async () => {
    respondWith(async () => new Response('<html>Bad gateway</html>', { status: 200 }));
    expect(await fetchNearbyAircraft(here)).toEqual({ ok: false, reason: 'error' });
  });

  it('returns the Aircraft Snapshot when the proxy answers', async () => {
    respondWith(async () => new Response(JSON.stringify({ ac: [], now: 1, total: 0 }), { status: 200 }));
    expect(await fetchNearbyAircraft(here)).toMatchObject({ ok: true, snapshot: { ac: [] } });
  });
});
