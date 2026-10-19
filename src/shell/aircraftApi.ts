/** Fetches an Aircraft Snapshot from the same-origin position proxy (api/aircraft.ts). */
import type { AircraftSnapshot } from '../engine';
import type { Position } from './location';

export type FetchAircraftOutcome =
  | { ok: true; snapshot: AircraftSnapshot }
  | { ok: false; reason: 'busy' | 'offline' | 'error' };

export async function fetchNearbyAircraft(position: Position): Promise<FetchAircraftOutcome> {
  const url = `/api/aircraft?lat=${position.lat}&lon=${position.lon}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
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
