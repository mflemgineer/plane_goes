/**
 * Sighting Engine: a pure module (no network, sensors or storage).
 * Takes an Observation, an Aircraft Snapshot and a caller-supplied route lookup, and returns a Sighting Result.
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
export type { Airport } from './airports';
export type { Route, RouteAirport, RouteLookup } from './route';
export type { GrownUpDetails } from './details';
export type { Verdict } from './verdict';
