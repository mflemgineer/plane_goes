/**
 * Shapes the Sighting Engine accepts and returns.
 * Vocabulary follows GLOSSARY.md.
 */

/** Where the parent is standing and where the phone points, at the moment of a Sighting. */
export interface Observation {
  lat: number;
  lon: number;
  /** Compass heading the phone points along, degrees true, 0 = north, clockwise. */
  heading: number;
  /** Phone elevation angle in degrees above the horizon (0 = horizon, 90 = straight up). */
  elevation: number;
  /** ms since epoch */
  time: number;
}

/** One aircraft as returned by adsb.lol (`/v2/point`). Only the fields we read are typed. */
export interface SnapshotAircraft {
  hex: string;
  /** Callsign, space-padded to 8 chars by adsb.lol. */
  flight?: string;
  /** Registration */
  r?: string;
  /** ICAO type designator */
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  category?: string;
  [key: string]: unknown;
}

/** The list of nearby aircraft returned by the position proxy (adsb.lol response shape). */
export interface AircraftSnapshot {
  ac: SnapshotAircraft[];
  now?: number;
  [key: string]: unknown;
}

/** The Flight the engine picked. */
export interface Flight {
  hex: string;
  /** Trimmed callsign, or registration / hex when the aircraft broadcasts no callsign. */
  callsign: string;
  /** Great-circle distance from the observer, in nautical miles. */
  distanceNm: number;
}

/**
 * One plane the engine offers as an answer. A Matched result is one of these; an Ambiguous
 * result and the all-nearby-planes list are lists of them, so choosing one makes it the answer
 * (`{ kind: 'matched', ...candidate }`). Per-plane answer fields (Verdict, Kid Line, Grown-up
 * Details) belong here so every candidate carries its own.
 */
export interface Match {
  flight: Flight;
}

export type SightingResult =
  | ({ kind: 'matched' } & Match)
  /** "Not that one?": a short list of planes close to the aim, best-aimed first. */
  | { kind: 'ambiguous'; candidates: Match[] }
  | { kind: 'mystery'; kidLine: string };
