/**
 * The one place the engine (and the shell) reads an aircraft's altitude. Both readings treat
 * `ground` as 0 and fall back to the other source when theirs is missing.
 *
 * - `altitudeFt`: barometric first. Aviation altitude: what the Verdict's thresholds (flight
 *   levels) are written in, and what flight trackers show, so it is the one the parent sees.
 * - `skyHeightFt`: GNSS first. The plane's true height, for where it appears in the sky.
 *   Barometric altitude is not corrected for local pressure: on a high-pressure day it reads
 *   ~500 ft low, enough to blur a low plane into the helicopters beneath it.
 */
import type { SnapshotAircraft } from './types';

export function altitudeFt(ac: SnapshotAircraft): number | undefined {
  if (ac.alt_baro === 'ground') return 0;
  if (typeof ac.alt_baro === 'number') return ac.alt_baro;
  if (typeof ac.alt_geom === 'number') return ac.alt_geom;
  return undefined;
}

export function skyHeightFt(ac: SnapshotAircraft): number | undefined {
  if (ac.alt_baro === 'ground') return 0;
  if (typeof ac.alt_geom === 'number') return ac.alt_geom;
  return altitudeFt(ac);
}

/** Whether the aircraft reports it is on the ground. */
export const onGround = (ac: SnapshotAircraft): boolean => ac.alt_baro === 'ground';
