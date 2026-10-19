import { bestMatch } from './match';
import type { AircraftSnapshot, Observation, SightingResult } from './types';

const MYSTERY_KID_LINE = 'Looks like Amelia Earhart is flying that one! We could not find it.';

/** Picks the aircraft the phone is pointing at, or a Mystery Plane when none is close enough. */
export function spot(observation: Observation, snapshot: AircraftSnapshot): SightingResult {
  const best = bestMatch(observation, snapshot.ac);
  if (!best) return { kind: 'mystery', kidLine: MYSTERY_KID_LINE };

  const ac = best.aircraft;
  const callsign = ac.flight?.trim() || ac.r?.trim() || ac.hex;
  return { kind: 'matched', flight: { hex: ac.hex, callsign, distanceNm: best.distanceNm } };
}
