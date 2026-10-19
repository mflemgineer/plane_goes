import type { SnapshotAircraft } from './types';

/** How a plane is named to the parent: trimmed callsign, else registration, else hex code. */
export function displayCallsign(ac: SnapshotAircraft): string {
  return ac.flight?.trim() || ac.r?.trim() || ac.hex;
}
