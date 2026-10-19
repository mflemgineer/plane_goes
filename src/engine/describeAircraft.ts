/**
 * Everything the parent sees about one aircraft: its Verdict, Kid Line and Grown-up Details.
 * Independent of how the aircraft was matched.
 */
import { detailsFor, type GrownUpDetails } from './details';
import { kidLineFor } from './kidLine';
import { noRoutes, type RouteLookup } from './route';
import type { SnapshotAircraft } from './types';
import { judgeVerdict, type Verdict } from './verdict';

export interface AircraftDescription {
  verdict: Verdict;
  kidLine: string;
  details: GrownUpDetails;
}

/** Describes one aircraft, asking `lookupRoute` for its route by callsign. */
export function describeAircraft(ac: SnapshotAircraft, lookupRoute: RouteLookup = noRoutes): AircraftDescription {
  const callsign = ac.flight?.trim();
  const route = callsign ? lookupRoute(callsign) : undefined;
  const verdict = judgeVerdict(ac, route);
  return { verdict, kidLine: kidLineFor(verdict), details: detailsFor(ac, verdict, route) };
}
