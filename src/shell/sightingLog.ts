/**
 * Shell glue for the Sighting Log: the app's log instance on device storage, and the
 * mapping from what the Sighting Engine returned to what the log stores.
 */
import type { AircraftSnapshot, Match } from '../engine';
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

function loggedVerdict(verdict: Match['verdict']): LoggedVerdict {
  if (verdict.kind === 'arrival' || verdict.kind === 'departure') {
    return { kind: verdict.kind, airports: [verdict.airport.code] };
  }
  return { kind: verdict.kind };
}

/**
 * Builds the log record for a matched Sighting (or a plane chosen from a list).
 * Only the plane's data is used, never the observer's.
 */
export function matchedSighting(match: Match, snapshot: AircraftSnapshot): SightingInput {
  const ac = snapshot.ac.find((a) => a.hex === match.flight.hex);
  const altitudeFt = match.details.altitudeFt ?? (ac?.alt_baro === 'ground' ? 0 : ac?.alt_geom);
  // Origin/destination: route lookups (adsbdb/hexdb) haven't landed yet; fill these when they do.
  return {
    verdict: loggedVerdict(match.verdict),
    kidLine: match.kidLine,
    aircraft: {
      hex: match.flight.hex,
      callsign: match.flight.callsign,
      position: typeof ac?.lat === 'number' && typeof ac.lon === 'number' ? { lat: ac.lat, lon: ac.lon } : undefined,
      altitudeFt,
    },
  };
}
