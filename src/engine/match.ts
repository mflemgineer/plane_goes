/**
 * Aircraft matching: which plane is the phone pointing at?
 *
 * For each aircraft we work out where it appears in the sky from where the parent stands
 * (bearing, and elevation angle above the horizon allowing for altitude and earth curvature),
 * then score it by the angle between that direction and where the phone points.
 */
import type { Observation, SnapshotAircraft } from './types';

/** Tunable: aircraft farther than this from the parent are ignored, at any altitude. */
export const SEARCH_RADIUS_MILES = 25;

/** Tunable: the best plane must be within this many degrees of where the phone points. */
export const MATCH_TOLERANCE_DEG = 20;

const EARTH_RADIUS_NM = 3440.065;
const NM_PER_MILE = 0.868976;
const FEET_PER_NM = 6076.12;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export interface Candidate {
  aircraft: SnapshotAircraft;
  /** Great-circle distance from the parent, nautical miles. */
  distanceNm: number;
  /** Degrees between where the phone points and where the aircraft appears. */
  offAimDeg: number;
}

/** Altitude above mean sea level in feet: GNSS altitude preferred, `ground` treated as 0. */
function altitudeFt(ac: SnapshotAircraft): number {
  if (typeof ac.alt_geom === 'number') return ac.alt_geom;
  if (typeof ac.alt_baro === 'number') return ac.alt_baro;
  return 0;
}

/** Central angle (radians) and initial bearing (degrees true) from the parent to a point. */
function centralAngleAndBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const angle = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return { angle, bearing: (toDeg(Math.atan2(y, x)) + 360) % 360 };
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
function angleBetween(az1: number, el1: number, az2: number, el2: number): number {
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
    const { angle, bearing } = centralAngleAndBearing(observation.lat, observation.lon, ac.lat, ac.lon);
    const distanceNm = angle * EARTH_RADIUS_NM;
    if (distanceNm > radiusNm) continue;
    const elevation = elevationDeg(angle, altitudeFt(ac) / FEET_PER_NM);
    const offAimDeg = angleBetween(observation.heading, observation.elevation, bearing, elevation);
    candidates.push({ aircraft: ac, distanceNm, offAimDeg });
  }

  return candidates.sort((a, b) => a.offAimDeg - b.offAimDeg);
}

/** The aircraft the phone points at, or undefined when nothing is within tolerance. */
export function bestMatch(observation: Observation, aircraft: SnapshotAircraft[]): Candidate | undefined {
  const [best] = rankByAim(observation, aircraft);
  return best && best.offAimDeg <= MATCH_TOLERANCE_DEG ? best : undefined;
}
