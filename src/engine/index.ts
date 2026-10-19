/**
 * Sighting Engine: a pure module (no network, sensors or storage).
 * Takes an Observation and an Aircraft Snapshot and returns a Sighting Result.
 * This is the public interface; tests go through it only.
 */
export { spot } from './spot';
export type {
  AircraftSnapshot,
  Flight,
  Observation,
  SightingResult,
  SnapshotAircraft,
} from './types';
