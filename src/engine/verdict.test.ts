import { describe, expect, it } from 'vitest';
import { spot, type AircraftSnapshot, type Observation, type SnapshotAircraft } from './index';
import brooklynSnapshot from './__fixtures__/adsblol-point-brooklyn.json';
import jfkSnapshot from './__fixtures__/adsblol-point-jfk.json';

// Standing in Prospect Heights, Brooklyn.
const brooklyn = { lat: 40.68, lon: -73.97 };
const NOW = 1792367920501;

/**
 * An Observation standing in Brooklyn with the phone aimed straight at `ac`,
 * so these tests hold whichever way the engine matches the pointed-at aircraft.
 */
function aimedAt(ac: SnapshotAircraft): Observation {
  const lat = ac.lat!;
  const lon = ac.lon!;
  const rad = Math.PI / 180;
  const dNorthNm = (lat - brooklyn.lat) * 60;
  const dEastNm = (lon - brooklyn.lon) * 60 * Math.cos(brooklyn.lat * rad);
  const heading = ((Math.atan2(dEastNm, dNorthNm) / rad) + 360) % 360;
  const altFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : 0;
  const distFt = Math.hypot(dNorthNm, dEastNm) * 6076;
  const elevation = Math.atan2(altFt, distFt) / rad;
  return { ...brooklyn, heading, elevation, time: NOW };
}

/** Spot a sky holding just this one aircraft, aimed straight at it. */
function spotOnly(ac: SnapshotAircraft) {
  const snapshot: AircraftSnapshot = { ac: [ac], now: NOW };
  const result = spot(aimedAt(ac), snapshot);
  if (result.kind !== 'matched') throw new Error(`expected a match, got ${result.kind}`);
  return result;
}

/** One real aircraft record from a recorded adsb.lol snapshot. */
function real(snapshot: unknown, hex: string): SnapshotAircraft {
  const ac = (snapshot as AircraftSnapshot).ac.find((a) => a.hex === hex);
  if (!ac) throw new Error(`no ${hex} in fixture`);
  return ac;
}

/** Hand-built aircraft in the adsb.lol `/v2/point` shape. */
function aircraft(fields: Partial<SnapshotAircraft>): SnapshotAircraft {
  return { hex: 'a0b1c2', type: 'adsb_icao', category: 'A3', seen: 0.2, seen_pos: 0.4, messages: 1200, rssi: -12, ...fields };
}

describe('Verdict, Kid Line and Grown-up Details', () => {
  it('calls a low aircraft descending toward JFK an Arrival at JFK', () => {
    // Southeast of Brooklyn over Jamaica Bay, on final toward JFK.
    const result = spotOnly(
      aircraft({ flight: 'DAL412  ', t: 'A321', lat: 40.62, lon: -73.86, alt_baro: 1500, gs: 140, track: 72, baro_rate: -768 }),
    );

    expect(result.verdict).toMatchObject({ kind: 'arrival', airport: { code: 'JFK', name: 'JFK' } });
    expect(result.kidLine).toBe('Coming down to JFK! Bye-bye, sky! 🛬');
    expect(result.details).toEqual({ callsign: 'DAL412', aircraftType: 'A321', altitudeFt: 1500, minutesToLanding: 2 });
  });

  it('does not force a bizjet descending toward Teterboro into a Home Airport Arrival', () => {
    // Real N807LP (C680): 700 ft, sinking 576 ft/min, tracking NE toward Teterboro.
    const result = spotOnly(real(brooklynSnapshot, 'aafce6'));

    expect(result.verdict).toEqual({ kind: 'unknown' });
    expect(result.kidLine).toBe('A plane! Way up in the sky! ✈️');
    expect(result.details).toEqual({ callsign: 'N807LP', aircraftType: 'C680', altitudeFt: 700 });
  });

  it('calls an aircraft on the ground unknown, with no altitude in the Grown-up Details', () => {
    const result = spotOnly(aircraft({ flight: 'JBU699  ', t: 'A320', lat: 40.7732, lon: -73.8692, alt_baro: 'ground', gs: 0 }));

    expect(result.verdict).toEqual({ kind: 'unknown' });
    expect(result.details).toEqual({ callsign: 'JBU699', aircraftType: 'A320' });
  });
});
