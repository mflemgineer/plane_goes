import { likelyMatches, rankByAim, type Candidate } from './match';
import type { AircraftSnapshot, Match, Observation, SightingResult } from './types';

const MYSTERY_KID_LINE = 'Looks like Amelia Earhart is flying that one! We could not find it.';

/**
 * Picks the aircraft the phone is pointing at. Several planes close to the aim → Ambiguous;
 * none close enough → Mystery Plane.
 */
export function spot(observation: Observation, snapshot: AircraftSnapshot): SightingResult {
  const matches = likelyMatches(observation, snapshot.ac).map(toMatch);
  if (matches.length === 0) return { kind: 'mystery', kidLine: MYSTERY_KID_LINE };
  if (matches.length > 1) return { kind: 'ambiguous', candidates: matches };
  return { kind: 'matched', ...matches[0] };
}

/**
 * Every plane within the search radius, closest to where the phone points first, for when
 * pointing doesn't work. Pass a pick to `choose` to make it the answer.
 */
export function nearbyPlanes(observation: Observation, snapshot: AircraftSnapshot): Match[] {
  return rankByAim(observation, snapshot.ac).map(toMatch);
}

/** The parent picked a plane from "not that one?" or the all-nearby-planes list: it becomes the answer. */
export function choose(candidate: Match): SightingResult {
  return { kind: 'matched', ...candidate };
}

function toMatch({ aircraft: ac, distanceNm }: Candidate): Match {
  const callsign = ac.flight?.trim() || ac.r?.trim() || ac.hex;
  return { flight: { hex: ac.hex, callsign, distanceNm } };
}
