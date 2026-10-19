/**
 * Aircraft matching: which plane is the phone pointing at?
 *
 * For each aircraft we work out where it appears in the sky from where the parent stands
 * (bearing, and elevation angle above the horizon allowing for altitude and earth curvature),
 * then score it by the angle between that direction and where the phone points.
 */
import { skyHeightFt } from './altitude';
import { bearingDeg, distanceNm, EARTH_RADIUS_NM, toDeg, toRad } from './geo';
import type { Observation, SnapshotAircraft } from './types';

/** Tunable: aircraft farther than this from the parent are ignored, at any altitude. */
export const SEARCH_RADIUS_MILES = 25;

/** Tunable: the best plane must be within this many degrees of where the phone points. */
export const MATCH_TOLERANCE_DEG = 20;

/**
 * Tunable: when other planes are within this many degrees of the best match's off-aim angle,
 * we can't be sure which one is meant (the iPhone compass drifts 10–20°), so we ask "not that one?".
 */
export const AMBIGUITY_MARGIN_DEG = 5;

/** Tunable: the most planes offered in a "not that one?" list. */
export const MAX_AMBIGUOUS_CANDIDATES = 3;

const NM_PER_MILE = 0.868976;
const FEET_PER_NM = 6076.12;

export interface Candidate {
  aircraft: SnapshotAircraft;
  /** Great-circle distance from the parent, nautical miles. */
  distanceNm: number;
  /** Degrees between where the phone points and where the aircraft appears. */
  offAimDeg: number;
}

/**
 * Elevation angle (degrees) of a point at `heightNm` above a spherical earth,
 * seen from sea level `angle` radians of arc away. Far, low planes dip below the horizon.
 */
function elevationDeg(angle: number, heightNm: number): number {
  const r = EARTH_RADIUS_NM + heightNm;
  return toDeg(Math.atan2(r * Math.cos(angle) - EARTH_RADIUS_NM, r * Math.sin(angle)));
}

/** Angle between two sky directions (bearing/elevation pairs), degrees. */
function skyAngleBetween(az1: number, el1: number, az2: number, el2: number): number {
  const cos =
    Math.sin(toRad(el1)) * Math.sin(toRad(el2)) +
    Math.cos(toRad(el1)) * Math.cos(toRad(el2)) * Math.cos(toRad(az1 - az2));
  return toDeg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

/** Every aircraft within the search radius, best-aimed first. */
export function rankByAim(observation: Observation, aircraft: SnapshotAircraft[]): Candidate[] {
  const radiusNm = SEARCH_RADIUS_MILES * NM_PER_MILE;
  const candidates: Candidate[] = [];

  for (const ac of aircraft) {
    if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue;
    const position = { lat: ac.lat, lon: ac.lon };
    const d = distanceNm(observation, position);
    if (d > radiusNm) continue;
    const elevation = elevationDeg(d / EARTH_RADIUS_NM, (skyHeightFt(ac) ?? 0) / FEET_PER_NM);
    const offAimDeg = skyAngleBetween(observation.heading, observation.elevation, bearingDeg(observation, position), elevation);
    candidates.push({ aircraft: ac, distanceNm: d, offAimDeg });
  }

  return candidates.sort((a, b) => a.offAimDeg - b.offAimDeg);
}

/**
 * The aircraft the phone could be pointing at, best-aimed first: empty when nothing is within
 * tolerance, one when there is a clear winner, several (at most MAX_AMBIGUOUS_CANDIDATES) when
 * runners-up are within AMBIGUITY_MARGIN_DEG of the best.
 */
export function likelyMatches(observation: Observation, aircraft: SnapshotAircraft[]): Candidate[] {
  const ranked = rankByAim(observation, aircraft);
  const [best] = ranked;
  if (!best || best.offAimDeg > MATCH_TOLERANCE_DEG) return [];
  return ranked
    .filter((c) => c.offAimDeg <= MATCH_TOLERANCE_DEG && c.offAimDeg - best.offAimDeg <= AMBIGUITY_MARGIN_DEG)
    .slice(0, MAX_AMBIGUOUS_CANDIDATES);
}
