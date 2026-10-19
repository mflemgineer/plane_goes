/**
 * Sighting Engine: a pure module (no network, sensors or storage).
 * Takes an Observation and an Aircraft Snapshot and returns a Sighting Result.
 * This is the public interface; tests go through it only.
 */
export { choose, nearbyPlanes, spot } from './spot';
export type {
  AircraftSnapshot,
  Flight,
  Match,
  Observation,
  SightingResult,
  SnapshotAircraft,
} from './types';
export type { Airport } from './airports';
export type { GrownUpDetails } from './details';
export type { Verdict } from './verdict';
