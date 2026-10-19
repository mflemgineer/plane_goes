/** Grown-up Details: the smaller facts under the Kid Line, from the Aircraft Snapshot alone for now. */
import type { SnapshotAircraft } from './types';
import type { Verdict } from './verdict';

export interface GrownUpDetails {
  /** Callsign / flight number, or registration / hex when none is broadcast. */
  callsign: string;
  /** ICAO type designator, e.g. "B738", when known. */
  aircraftType?: string;
  /** Barometric altitude in feet, when airborne. */
  altitudeFt?: number;
  /** Arrivals only: distance to the airport ÷ ground speed, rounded. */
  minutesToLanding?: number;
}

export function detailsFor(ac: SnapshotAircraft, verdict: Verdict): GrownUpDetails {
  const details: GrownUpDetails = { callsign: ac.flight?.trim() || ac.r?.trim() || ac.hex };
  if (ac.t) details.aircraftType = ac.t;
  if (typeof ac.alt_baro === 'number') details.altitudeFt = ac.alt_baro;
  if (verdict.kind === 'arrival' && ac.gs) {
    details.minutesToLanding = Math.round((verdict.distanceNm / ac.gs) * 60);
  }
  return details;
}
