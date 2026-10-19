/**
 * Shapes the Sighting Log accepts, stores and returns.
 * Vocabulary follows GLOSSARY.md.
 */

/** A Verdict kind, plus Mystery Plane for Sightings where no Flight was matched. */
export type VerdictKind =
  | 'arrival'
  | 'departure'
  | 'overflight'
  | 'helicopter'
  | 'small-plane'
  | 'unknown'
  | 'mystery';

export interface LoggedVerdict {
  kind: VerdictKind;
  /** Airport codes the Verdict names (e.g. ['JFK'] for an Arrival at JFK), when any. */
  airports?: string[];
}

/** The plane (never the observer) at the moment of a matched Sighting. */
export interface LoggedAircraft {
  /** ICAO 24-bit address */
  hex: string;
  callsign?: string;
  /** Origin when known (city or airport code). */
  origin?: string;
  /** Destination when known (city or airport code). */
  destination?: string;
  /** The plane's position at the time of the Sighting. */
  position?: { lat: number; lon: number };
  /** The plane's altitude in feet at the time of the Sighting. */
  altitudeFt?: number;
}

/** What the app hands the log for one Sighting. */
export interface SightingInput {
  verdict: LoggedVerdict;
  kidLine: string;
  /** Matched Sightings only. Ignored for Mystery Planes. */
  aircraft?: LoggedAircraft;
}

/** Bumped whenever the stored Sighting shape changes. */
export const SIGHTING_FORMAT_VERSION = 1;

/** One Sighting as it is kept on the phone. */
export interface StoredSighting {
  /** Stable unique ID (for a future upload to a shared database). */
  id: string;
  formatVersion: number;
  /** The Spotter credited with the Sighting ('' if none was set yet). */
  spotter: string;
  /** ms since epoch */
  time: number;
  verdict: LoggedVerdict;
  kidLine: string;
  aircraft?: LoggedAircraft;
}

/** A group of Sightings made on the same outing. */
export interface Walk {
  /** The ID of the Walk's first Sighting; stable as long as that Sighting is kept. */
  id: string;
  /** Display name, e.g. "This morning's walk". */
  name: string;
  /** Time of the first Sighting, ms since epoch. */
  start: number;
  /** Time of the last Sighting, ms since epoch. */
  end: number;
  /** Oldest first. */
  sightings: StoredSighting[];
  planeCount: number;
}
