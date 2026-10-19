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

export type SightingResult =
  | { kind: 'matched'; flight: Flight }
  | { kind: 'mystery'; kidLine: string };
