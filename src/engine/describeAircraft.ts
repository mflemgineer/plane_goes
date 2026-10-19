/**
 * Everything the parent sees about one aircraft: its Verdict, Kid Line and Grown-up Details.
 * Independent of how the aircraft was matched.
 */
import { detailsFor, type GrownUpDetails } from './details';
import { kidLineFor } from './kidLine';
import type { SnapshotAircraft } from './types';
import { judgeVerdict, type Verdict } from './verdict';

export interface AircraftDescription {
  verdict: Verdict;
  kidLine: string;
  details: GrownUpDetails;
}

export function describeAircraft(ac: SnapshotAircraft): AircraftDescription {
  const verdict = judgeVerdict(ac);
  return { verdict, kidLine: kidLineFor(verdict), details: detailsFor(ac, verdict) };
}
