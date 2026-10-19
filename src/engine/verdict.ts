/**
 * Verdict from motion only: altitude, vertical rate, ground speed, track,
 * and distance/bearing to each Home Airport. Route data never overrides this.
 */
import { HOME_AIRPORTS, type Airport } from './airports';
import type { SnapshotAircraft } from './types';

// ---- Tunable thresholds (adjust after real walks) ----

/** Arrivals: below this altitude… */
export const ARRIVAL_MAX_ALTITUDE_FT = 10_000;
/** …sinking at least this fast (ft/min)… */
export const DESCENT_MIN_RATE_FPM = 300;
/** …within this distance of the airport… */
export const ARRIVAL_MAX_DISTANCE_NM = 40;
/** …with the track pointing at the airport to within this angle. */
export const ARRIVAL_TRACK_TOLERANCE_DEG = 30;

/** Departures: below this altitude… */
export const DEPARTURE_MAX_ALTITUDE_FT = 10_000;
/** …climbing at least this fast (ft/min)… */
export const CLIMB_MIN_RATE_FPM = 300;
/** …within this distance of the nearest Home Airport… */
export const DEPARTURE_MAX_DISTANCE_NM = 25;
/** …with the track pointing away from the airport to within this angle. */
export const DEPARTURE_TRACK_TOLERANCE_DEG = 75;

/** Overflights: at or above this altitude (flight levels — cruising, not arriving or leaving)… */
export const OVERFLIGHT_MIN_ALTITUDE_FT = 18_000;
/** …and holding level: vertical rate within ± this (ft/min). */
export const LEVEL_MAX_RATE_FPM = 500;

export type Verdict =
  | { kind: 'arrival'; airport: Airport; distanceNm: number }
  | { kind: 'departure'; airport: Airport; distanceNm: number }
  | { kind: 'overflight' }
  | { kind: 'unknown' };

const UNKNOWN: Verdict = { kind: 'unknown' };

const EARTH_RADIUS_NM = 3440.065;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

/** Initial great-circle bearing from point 1 to point 2, degrees true. */
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest angle between two bearings, 0–180. */
function angleBetween(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function judgeVerdict(ac: SnapshotAircraft): Verdict {
  const { lat, lon, track } = ac;
  const altitude = typeof ac.alt_baro === 'number' ? ac.alt_baro : undefined;
  const rate = ac.baro_rate ?? ac.geom_rate;
  if (lat === undefined || lon === undefined || track === undefined || altitude === undefined || rate === undefined) {
    return UNKNOWN;
  }

  if (altitude >= OVERFLIGHT_MIN_ALTITUDE_FT && Math.abs(rate) <= LEVEL_MAX_RATE_FPM) {
    return { kind: 'overflight' };
  }

  if (altitude < ARRIVAL_MAX_ALTITUDE_FT && rate <= -DESCENT_MIN_RATE_FPM) {
    // Of the airports ahead, pick the one the aircraft will pass closest to (smallest cross-track distance).
    let best: { airport: Airport; distanceNm: number; crossTrackNm: number } | undefined;
    for (const airport of HOME_AIRPORTS) {
      const d = distanceNm(lat, lon, airport.lat, airport.lon);
      const off = angleBetween(track, bearingDeg(lat, lon, airport.lat, airport.lon));
      if (d > ARRIVAL_MAX_DISTANCE_NM || off > ARRIVAL_TRACK_TOLERANCE_DEG) continue;
      const crossTrackNm = d * Math.sin(toRad(off));
      if (!best || crossTrackNm < best.crossTrackNm) best = { airport, distanceNm: d, crossTrackNm };
    }
    if (best) return { kind: 'arrival', airport: best.airport, distanceNm: best.distanceNm };
  }

  if (altitude < DEPARTURE_MAX_ALTITUDE_FT && rate >= CLIMB_MIN_RATE_FPM) {
    // A climber took off from the nearest airport, so it must be moving away from that one.
    let nearest: { airport: Airport; distanceNm: number } | undefined;
    for (const airport of HOME_AIRPORTS) {
      const d = distanceNm(lat, lon, airport.lat, airport.lon);
      if (!nearest || d < nearest.distanceNm) nearest = { airport, distanceNm: d };
    }
    if (nearest && nearest.distanceNm <= DEPARTURE_MAX_DISTANCE_NM) {
      const { airport } = nearest;
      const off = angleBetween(track, bearingDeg(airport.lat, airport.lon, lat, lon));
      if (off <= DEPARTURE_TRACK_TOLERANCE_DEG) return { kind: 'departure', ...nearest };
    }
  }

  return UNKNOWN;
}
