/** Grown-up Details: the smaller facts under the Kid Line, from the Aircraft Snapshot and (when it fits) the route. */
import { altitudeFt, onGround } from './altitude';
import { displayCallsign } from './callsign';
import { describeEnd, type Route } from './route';
import type { SnapshotAircraft } from './types';
import { usesRoute, type Verdict } from './verdict';

export interface GrownUpDetails {
  /** Callsign / flight number, or registration / hex when none is broadcast. */
  callsign: string;
  /** Airline name from route data, when known. */
  airline?: string;
  /** ICAO type designator, e.g. "B738", when known. */
  aircraftType?: string;
  /** Where the Flight came from, e.g. "Boston (BOS)" — only when the route fits the motion. */
  origin?: string;
  /** Where the Flight is going, e.g. "Miami (MIA)" — only when the route fits the motion. */
  destination?: string;
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
    details.origin = describeEnd(route.origin);
    details.destination = describeEnd(route.destination);
  }
  const altitude = altitudeFt(ac);
  if (altitude !== undefined && !onGround(ac)) details.altitudeFt = altitude;
  if (verdict.kind === 'arrival' && ac.gs) {
    details.minutesToLanding = Math.round((verdict.distanceNm / ac.gs) * 60);
  }
  return details;
}

