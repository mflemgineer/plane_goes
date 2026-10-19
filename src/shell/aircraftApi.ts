/** Fetches an Aircraft Snapshot from the same-origin position proxy (api/aircraft.ts). */
import type { AircraftSnapshot } from '../engine';
import type { Position } from './location';

export type FetchAircraftOutcome =
  | { ok: true; snapshot: AircraftSnapshot }
  | { ok: false; reason: 'busy' | 'offline' | 'error' };

/** A walk with one bar of signal shouldn't leave the button spinning forever. */
const DEFAULT_TIMEOUT_MS = 12000;

/**
 * 2 dp (~1 km), as the proxy rounds too: the edge cache is keyed on the URL, so nearby taps
 * must send the same one to share a cached snapshot.
 */
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function fetchNearbyAircraft(
  position: Position,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<FetchAircraftOutcome> {
  const url = `/api/aircraft?lat=${round2(position.lat)}&lon=${round2(position.lon)}`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    // No network, or no answer in time: both feel like "no signal" on a walk.
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 429) return { ok: false, reason: 'busy' };
  if (!response.ok) return { ok: false, reason: 'error' };
  try {
    const snapshot = (await response.json()) as AircraftSnapshot;
    return Array.isArray(snapshot.ac) ? { ok: true, snapshot } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
