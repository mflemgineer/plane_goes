/**
 * Sighting Log: a pure module that keeps past Sightings on the phone, credited to the
 * Spotter and grouped into Walks. The clock and storage backend are injected.
 * This is the public interface; tests go through it only.
 */
export { createSightingLog } from './sightingLog';
export type { Clock, SightingLog, SightingLogDeps } from './sightingLog';
export { SIGHTING_FORMAT_VERSION } from './types';
export type {
  LoggedAircraft,
  LoggedVerdict,
  SightingInput,
  StoredSighting,
  VerdictKind,
  Walk,
} from './types';
export { memoryStorage } from './storage';
export type { LogStorage } from './storage';
