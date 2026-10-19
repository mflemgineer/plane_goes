import { displayCallsign } from './callsign';
import { describeAircraft } from './describeAircraft';
import { MYSTERY_PLANE_KID_LINE } from './kidLine';
import { likelyMatches, rankByAim, type Candidate } from './match';
import { noRoutes, type RouteLookup } from './route';
import type { AircraftSnapshot, Match, Observation, SightingResult } from './types';

/**
 * Picks the aircraft the phone is pointing at. Several planes close to the aim → Ambiguous;
 * none close enough → Mystery Plane. `lookupRoute` (callsign → route or nothing) is supplied
 * by the caller; the engine never fetches.
 */
export function spot(
  observation: Observation,
  snapshot: AircraftSnapshot,
  lookupRoute: RouteLookup = noRoutes,
): SightingResult {
  const matches = likelyMatches(observation, snapshot.ac).map((c) => toMatch(c, lookupRoute));
  if (matches.length === 0) return { kind: 'mystery', kidLine: MYSTERY_PLANE_KID_LINE };
  if (matches.length > 1) return { kind: 'ambiguous', candidates: matches };
  return { kind: 'matched', ...matches[0] };
}

/**
 * Every plane within the search radius, closest to where the phone points first, for when
 * pointing doesn't work. Pass a pick to `choose` to make it the answer.
 */
export function nearbyPlanes(
  observation: Observation,
  snapshot: AircraftSnapshot,
  lookupRoute: RouteLookup = noRoutes,
): Match[] {
  return rankByAim(observation, snapshot.ac).map((c) => toMatch(c, lookupRoute));
}

/** The parent picked a plane from "not that one?" or the all-nearby-planes list: it becomes the answer. */
export function choose(candidate: Match): SightingResult {
  return { kind: 'matched', ...candidate };
}

function toMatch({ aircraft: ac, distanceNm }: Candidate, lookupRoute: RouteLookup): Match {
  return { flight: { hex: ac.hex, callsign: displayCallsign(ac), distanceNm }, ...describeAircraft(ac, lookupRoute) };
}
