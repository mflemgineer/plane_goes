/**
 * Shapes the Sighting Log accepts, stores and returns.
 * Vocabulary follows GLOSSARY.md.
 */

import type { Verdict } from '../engine';

/** A Verdict kind, plus Mystery Plane for Sightings where no Flight was matched. */
export type VerdictKind = Verdict['kind'] | 'mystery';

export interface LoggedVerdict {
  kind: VerdictKind;
  /** Airport codes the Verdict names (e.g. ['JFK'] for an Arrival at JFK), when any. */
  airports?: string[];
}

/** One end of a Flight's route, e.g. { code: 'LHR', city: 'London' }. */
export interface LoggedPlace {
  /** IATA code when known, else ICAO. */
  code: string;
  /** City (or short airport name) to say out loud. */
  city: string;
}

/** The plane (never the observer) at the moment of a matched Sighting. */
export interface LoggedAircraft {
  /** ICAO 24-bit address */
  hex: string;
  callsign?: string;
  /** Airline name, when route data knows it (Grown-up Details). */
  airline?: string;
  /** ICAO type designator, e.g. "B738", when known (Grown-up Details). */
  aircraftType?: string;
  /** Origin, when the route fitted the motion. */
  origin?: LoggedPlace;
  /** Destination, when the route fitted the motion. */
  destination?: LoggedPlace;
  /** The plane's position at the time of the Sighting. */
  position?: { lat: number; lon: number };
  /** The plane's altitude in feet at the time of the Sighting. */
  altitudeFt?: number;
  /** Arrivals only: estimated minutes to landing at the time of the Sighting (Grown-up Details). */
  minutesToLanding?: number;
}

/** What the app hands the log for one Sighting. */
export interface SightingInput {
  verdict: LoggedVerdict;
  kidLine: string;
  /** Matched Sightings only. Ignored for Mystery Planes. */
  aircraft?: LoggedAircraft;
}

/**
 * Bumped whenever the stored Sighting shape changes.
 * 1: first shape. 2: adds optional airline, aircraftType and minutesToLanding to the aircraft
 * (additive, so version 1 records still read as they are). 3: origin and destination are
 * { code, city } instead of a display string like "London (LHR)"; older records keep their
 * strings and still read.
 */
export const SIGHTING_FORMAT_VERSION = 3;

/** The plane as kept on the phone: as logged, except records before version 3 hold places as display strings. */
export interface StoredAircraft extends Omit<LoggedAircraft, 'origin' | 'destination'> {
  origin?: LoggedPlace | string;
  destination?: LoggedPlace | string;
}

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
  aircraft?: StoredAircraft;
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
  /** Planes on the Walk: repeat Sightings of one Flight count once; each Mystery Plane counts. */
  planeCount: number;
  /** e.g. "5 planes — 2 JFK Arrivals, 1 LaGuardia Departure, 1 Overflight to London, 1 Mystery Plane" */
  summary: string;
  /** e.g. "Davey spotted 4 planes this morning" */
  credit: string;
}
