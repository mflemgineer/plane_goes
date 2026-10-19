import { describeAircraft } from './describeAircraft';
import { MYSTERY_PLANE_KID_LINE } from './kidLine';
import { bestMatch } from './match';
import type { RouteLookup } from './route';
import type { AircraftSnapshot, Observation, SightingResult } from './types';

/**
 * Picks the aircraft the phone is pointing at, or a Mystery Plane when none is close enough.
 * `lookupRoute` (callsign → route or nothing) is supplied by the caller; the engine never fetches.
 */
export function spot(observation: Observation, snapshot: AircraftSnapshot, lookupRoute?: RouteLookup): SightingResult {
  const best = bestMatch(observation, snapshot.ac);
  if (!best) return { kind: 'mystery', kidLine: MYSTERY_PLANE_KID_LINE };

  const ac = best.aircraft;
  const callsign = ac.flight?.trim() || ac.r?.trim() || ac.hex;
  return { kind: 'matched', flight: { hex: ac.hex, callsign, distanceNm: best.distanceNm }, ...describeAircraft(ac, lookupRoute) };
}
