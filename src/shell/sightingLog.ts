/**
 * Shell glue for the Sighting Log: the app's log instance on device storage, and the
 * mapping from what the Sighting Engine returned to what the log stores.
 */
import type { AircraftSnapshot, Flight } from '../engine';
import { createSightingLog, memoryStorage, type LogStorage, type LoggedVerdict, type SightingInput } from '../log';

/** localStorage when the browser allows it; otherwise in-memory (e.g. some private modes). */
function deviceStorage(): LogStorage {
  try {
    const probe = 'plane-goes:probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage();
  }
}

export const sightingLog = createSightingLog({ clock: { now: () => Date.now() }, storage: deviceStorage() });

export interface MatchedSightingFacts {
  flight: Flight;
  /** The Kid Line shown for the Sighting. */
  kidLine: string;
  /** The snapshot the Flight was picked from; supplies the plane's position and altitude. */
  snapshot: AircraftSnapshot;
  /** The Verdict, once the engine provides one. Defaults to 'unknown'. */
  verdict?: LoggedVerdict;
  origin?: string;
  destination?: string;
}

/** Builds the log record for a matched Sighting. Only the plane's data is used, never the observer's. */
export function matchedSighting({ flight, kidLine, snapshot, verdict, origin, destination }: MatchedSightingFacts): SightingInput {
  const ac = snapshot.ac.find((a) => a.hex === flight.hex);
  const altitude = typeof ac?.alt_baro === 'number' ? ac.alt_baro : ac?.alt_baro === 'ground' ? 0 : ac?.alt_geom;
  return {
    verdict: verdict ?? { kind: 'unknown' },
    kidLine,
    aircraft: {
      hex: flight.hex,
      callsign: flight.callsign,
      origin,
      destination,
      position: typeof ac?.lat === 'number' && typeof ac.lon === 'number' ? { lat: ac.lat, lon: ac.lon } : undefined,
      altitudeFt: altitude,
    },
  };
}
