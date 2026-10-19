/**
 * Route data (callsign → origin/destination) supplied by the caller.
 * Community route data can be stale, so the Verdict uses a route only when it agrees with the motion.
 */
import { AIRPORTS, type Airport } from './airports';
import { distanceNm, type LatLon } from './geo';

/** One end of a route. */
export interface RouteAirport {
  /** IATA code when known (e.g. "BOS"), else ICAO (e.g. "KBOS"). */
  code: string;
  /** City (or short airport name) to say out loud, e.g. "Boston". */
  city: string;
  lat: number;
  lon: number;
}

export interface Route {
  /** Airline name, e.g. "Delta Air Lines", when known. */
  airline?: string;
  origin: RouteAirport;
  destination: RouteAirport;
}

/** Callsign (trimmed, as broadcast) → route, or undefined when none is known. Must not do I/O. */
export type RouteLookup = (callsign: string) => Route | undefined;

export const noRoutes: RouteLookup = () => undefined;

/** Tunable: a route endpoint this close to a known airport is that airport. */
export const SAME_AIRPORT_MAX_NM = 3;

/** Tunable: a route endpoint this close to any known airport is in the New York area. */
export const NY_AREA_RADIUS_NM = 50;

/** The known airport a route endpoint refers to, if any. */
export function knownAirportAt(end: LatLon): Airport | undefined {
  return AIRPORTS.find((airport) => distanceNm(end, airport) <= SAME_AIRPORT_MAX_NM);
}

export function inNewYorkArea(end: LatLon): boolean {
  return AIRPORTS.some((airport) => distanceNm(end, airport) <= NY_AREA_RADIUS_NM);
}

/** "Boston (BOS)" for the Grown-up Details. */
export function describeEnd(end: RouteAirport): string {
  return `${end.city} (${end.code})`;
}
