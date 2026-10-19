/** Grown-up Details: the smaller facts under the Kid Line, from the Aircraft Snapshot and (when it fits) the route. */
import { altitudeFt, onGround } from './altitude';
import { displayCallsign } from './callsign';
import { placeOf, type Route, type RoutePlace } from './route';
import type { SnapshotAircraft } from './types';
import { usesRoute, type Verdict } from './verdict';

export interface GrownUpDetails {
  /** Callsign / flight number, or registration / hex when none is broadcast. */
  callsign: string;
  /** Airline name from route data, when known. */
  airline?: string;
  /** ICAO type designator, e.g. "B738", when known. */
  aircraftType?: string;
  /** Where the Flight came from, e.g. { code: 'BOS', city: 'Boston' } — only when the route fits the motion. */
  origin?: RoutePlace;
  /** Where the Flight is going, e.g. { code: 'MIA', city: 'Miami' } — only when the route fits the motion. */
  destination?: RoutePlace;
  /** Altitude in feet (barometric, else GNSS), when airborne. */
  altitudeFt?: number;
  /** Arrivals only: distance to the airport ÷ ground speed, rounded. */
  minutesToLanding?: number;
}

export function detailsFor(ac: SnapshotAircraft, verdict: Verdict, route?: Route): GrownUpDetails {
  const details: GrownUpDetails = { callsign: displayCallsign(ac) };
  // The airline comes from the callsign itself, so it holds even when the route is stale.
  if (route?.airline) details.airline = route.airline;
  if (ac.t) details.aircraftType = ac.t;
  if (route && usesRoute(verdict)) {
    details.origin = placeOf(route.origin);
    details.destination = placeOf(route.destination);
  }
  const altitude = altitudeFt(ac);
  if (altitude !== undefined && !onGround(ac)) details.altitudeFt = altitude;
  if (verdict.kind === 'arrival' && ac.gs) {
    details.minutesToLanding = Math.round((verdict.distanceNm / ac.gs) * 60);
  }
  return details;
}

