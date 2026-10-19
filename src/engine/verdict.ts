/**
 * Verdict from motion first: altitude, vertical rate, ground speed, track,
 * and distance/bearing to each known airport. A route only adds city names
 * (or names an Other Nearby Airport) when it agrees with the motion; it never overrides it.
 */
import { altitudeFt } from './altitude';
import { AIRPORTS, HOME_AIRPORTS, type Airport } from './airports';
import { angleBetween, bearingDeg, distanceNm, toRad, type LatLon } from './geo';
import { inNewYorkArea, knownAirportAt, type Route, type RouteAirport } from './route';
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
/** An Overflight's route fits only if its destination lies ahead (and its origin behind), within this angle of the track. */
export const OVERFLIGHT_ROUTE_TRACK_TOLERANCE_DEG = 90;

/** A route fits only if flying via the aircraft's position is at most this much longer than flying direct… */
export const ROUTE_MAX_DETOUR_RATIO = 1.3;
/** …plus this many nautical miles of slack for vectoring near the airports. */
export const ROUTE_DETOUR_SLACK_NM = 30;

/** ADS-B emitter category for rotorcraft → helicopter. */
export const ROTORCRAFT_CATEGORIES: readonly string[] = ['A7'];
/** ADS-B emitter categories for light aircraft → small plane (unless a fitting route says otherwise). */
export const LIGHT_AIRCRAFT_CATEGORIES: readonly string[] = ['A1'];

export type Verdict =
  | { kind: 'arrival'; airport: Airport; distanceNm: number; origin?: RouteAirport }
  | { kind: 'departure'; airport: Airport; distanceNm: number; destination?: RouteAirport }
  | { kind: 'overflight'; origin?: RouteAirport; destination?: RouteAirport }
  | { kind: 'helicopter' }
  | { kind: 'small-plane' }
  | { kind: 'unknown' };

const UNKNOWN: Verdict = { kind: 'unknown' };

interface Motion {
  position: LatLon;
  track: number;
  altitude: number;
  rate: number;
}

function motionOf(ac: SnapshotAircraft): Motion | undefined {
  const { lat, lon, track } = ac;
  const altitude = altitudeFt(ac);
  const rate = ac.baro_rate ?? ac.geom_rate;
  if (lat === undefined || lon === undefined || track === undefined || altitude === undefined || rate === undefined) {
    return undefined;
  }
  return { position: { lat, lon }, track, altitude, rate };
}

/**
 * The aircraft is plausibly somewhere along the route: going via its position is not much
 * longer than flying origin → destination directly (with slack for turns near the airports).
 */
function isEnRoute(position: LatLon, route: Route): boolean {
  const direct = distanceNm(route.origin, route.destination);
  const via = distanceNm(route.origin, position) + distanceNm(position, route.destination);
  return via <= direct * ROUTE_MAX_DETOUR_RATIO + ROUTE_DETOUR_SLACK_NM;
}

/** An airport the aircraft's motion fits, and how far away it is. */
interface AirportFit {
  airport: Airport;
  distanceNm: number;
}

/** Airports a descending aircraft is tracking toward, with how close it will pass each, closest first. */
function arrivalAirports({ position, track }: Motion): (AirportFit & { crossTrackNm: number })[] {
  const ahead: (AirportFit & { crossTrackNm: number })[] = [];
  for (const airport of AIRPORTS) {
    const d = distanceNm(position, airport);
    const off = angleBetween(track, bearingDeg(position, airport));
    if (d > ARRIVAL_MAX_DISTANCE_NM || off > ARRIVAL_TRACK_TOLERANCE_DEG) continue;
    ahead.push({ airport, distanceNm: d, crossTrackNm: d * Math.sin(toRad(off)) });
  }
  return ahead.sort((a, b) => a.crossTrackNm - b.crossTrackNm);
}

function judgeArrival(motion: Motion, route: Route | undefined): Verdict | undefined {
  const ahead = arrivalAirports(motion);
  const routeAirport = route && knownAirportAt(route.destination);
  const fitting = routeAirport && ahead.find((a) => a.airport === routeAirport);
  if (route && fitting && isEnRoute(motion.position, route)) {
    return { kind: 'arrival', airport: fitting.airport, distanceNm: fitting.distanceNm, origin: route.origin };
  }
  // Without a fitting route, only a Home Airport is named from motion alone, and only when no
  // Other Nearby Airport fits at least as well (then we can't tell which one it is).
  const home = ahead.find((a) => a.airport.group === 'home');
  if (!home) return undefined;
  const otherFitsAsWell = ahead.some((a) => a.airport.group === 'other-nearby' && a.crossTrackNm <= home.crossTrackNm);
  return otherFitsAsWell ? undefined : { kind: 'arrival', airport: home.airport, distanceNm: home.distanceNm };
}

/** Climbing out from this airport: close to it and moving away from it. */
function departingFrom({ position, track }: Motion, airport: Airport): AirportFit | undefined {
  const d = distanceNm(position, airport);
  if (d > DEPARTURE_MAX_DISTANCE_NM) return undefined;
  const off = angleBetween(track, bearingDeg(airport, position));
  return off <= DEPARTURE_TRACK_TOLERANCE_DEG ? { airport, distanceNm: d } : undefined;
}

function judgeDeparture(motion: Motion, route: Route | undefined): Verdict | undefined {
  const routeAirport = route && knownAirportAt(route.origin);
  const fitting = routeAirport && departingFrom(motion, routeAirport);
  if (route && fitting && isEnRoute(motion.position, route)) {
    return { kind: 'departure', ...fitting, destination: route.destination };
  }
  // Without a fitting route: a climber took off from the nearest Home Airport, so it must be moving away from that one…
  let nearest: Airport | undefined;
  for (const airport of HOME_AIRPORTS) {
    if (!nearest || distanceNm(motion.position, airport) < distanceNm(motion.position, nearest)) nearest = airport;
  }
  const home = nearest && departingFrom(motion, nearest);
  if (!home) return undefined;
  // …unless it is also climbing away from an Other Nearby Airport at least as close: then we can't tell which.
  const otherFitsAsWell = AIRPORTS.some(
    (airport) =>
      airport.group === 'other-nearby' && (departingFrom(motion, airport)?.distanceNm ?? Infinity) <= home.distanceNm,
  );
  return otherFitsAsWell ? undefined : { kind: 'departure', ...home };
}

/** Both ends outside the New York area, the aircraft between them, flying from origin toward destination. */
function overflightRouteFits({ position, track }: Motion, route: Route): boolean {
  if (inNewYorkArea(route.origin) || inNewYorkArea(route.destination)) return false;
  if (!isEnRoute(position, route)) return false;
  const towardDestination = angleBetween(track, bearingDeg(position, route.destination));
  const awayFromOrigin = angleBetween(track, bearingDeg(route.origin, position));
  return (
    towardDestination <= OVERFLIGHT_ROUTE_TRACK_TOLERANCE_DEG && awayFromOrigin <= OVERFLIGHT_ROUTE_TRACK_TOLERANCE_DEG
  );
}

/** The Verdict from motion, with route city names only where the route agrees. */
function judgeMotion(ac: SnapshotAircraft, route: Route | undefined): Verdict {
  const motion = motionOf(ac);
  if (!motion) return UNKNOWN;
  const { altitude, rate } = motion;

  if (altitude >= OVERFLIGHT_MIN_ALTITUDE_FT && Math.abs(rate) <= LEVEL_MAX_RATE_FPM) {
    return route && overflightRouteFits(motion, route)
      ? { kind: 'overflight', origin: route.origin, destination: route.destination }
      : { kind: 'overflight' };
  }
  if (altitude < ARRIVAL_MAX_ALTITUDE_FT && rate <= -DESCENT_MIN_RATE_FPM) {
    return judgeArrival(motion, route) ?? UNKNOWN;
  }
  if (altitude < DEPARTURE_MAX_ALTITUDE_FT && rate >= CLIMB_MIN_RATE_FPM) {
    return judgeDeparture(motion, route) ?? UNKNOWN;
  }
  return UNKNOWN;
}

export function judgeVerdict(ac: SnapshotAircraft, route?: Route): Verdict {
  if (ac.category && ROTORCRAFT_CATEGORIES.includes(ac.category)) return { kind: 'helicopter' };
  const verdict = judgeMotion(ac, route);
  if (ac.category && LIGHT_AIRCRAFT_CATEGORIES.includes(ac.category)) {
    // Light aircraft wander; only a route that fits the motion beats the small-plane catch-all.
    return usesRoute(verdict) ? verdict : { kind: 'small-plane' };
  }
  return verdict;
}

/** Whether the Verdict took its city names from a fitting route. */
export function usesRoute(verdict: Verdict): boolean {
  switch (verdict.kind) {
    case 'arrival':
      return verdict.origin !== undefined;
    case 'departure':
      return verdict.destination !== undefined;
    case 'overflight':
      return verdict.origin !== undefined;
    default:
      return false;
  }
}
