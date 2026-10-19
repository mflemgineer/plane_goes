import { describeAircraft } from './describeAircraft';
import { MYSTERY_PLANE_KID_LINE } from './kidLine';
import type { AircraftSnapshot, Observation, SightingResult, SnapshotAircraft } from './types';

const EARTH_RADIUS_NM = 3440.065;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

/**
 * Walking-skeleton matching: the nearest aircraft by distance wins.
 * Pointing (heading/elevation) comes in a later ticket.
 */
export function spot(observation: Observation, snapshot: AircraftSnapshot): SightingResult {
  let best: { hex: string; callsign: string; distanceNm: number } | undefined;
  let bestAircraft: SnapshotAircraft | undefined;

  for (const ac of snapshot.ac) {
    if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue;
    const d = distanceNm(observation.lat, observation.lon, ac.lat, ac.lon);
    if (!best || d < best.distanceNm) {
      const callsign = ac.flight?.trim() || ac.r?.trim() || ac.hex;
      best = { hex: ac.hex, callsign, distanceNm: d };
      bestAircraft = ac;
    }
  }

  if (!best || !bestAircraft) return { kind: 'mystery', kidLine: MYSTERY_PLANE_KID_LINE };
  return { kind: 'matched', flight: best, ...describeAircraft(bestAircraft) };
}
