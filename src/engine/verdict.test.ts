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

  it('calls a real JFK final approach an Arrival at JFK with minutes to landing', () => {
    // Real CAL012 (B77W) at 725 ft, sinking, tracking SW onto JFK's runway 22L.
    const result = spotOnly(real(jfkSnapshot, '899019'));

    expect(result.verdict).toMatchObject({ kind: 'arrival', airport: { code: 'JFK' } });
    expect(result.details).toEqual({ callsign: 'CAL012', aircraftType: 'B77W', altitudeFt: 725, minutesToLanding: 2 });
  });

  it('calls a real aircraft descending over Brooklyn toward LaGuardia an Arrival at LaGuardia, not JFK', () => {
    // Real RPA4791 (E75L) at 2,625 ft over Sunset Park, sinking 1,088 ft/min on track 032°, ~10 nm from LGA.
    const result = spotOnly(real(brooklynSnapshot, 'a026e1'));

    expect(result.verdict).toMatchObject({ kind: 'arrival', airport: { code: 'LGA' } });
    expect(result.kidLine).toBe('Coming down to LaGuardia! Bye-bye, sky! 🛬');
    expect(result.details.minutesToLanding).toBe(3);
  });

  it('calls a climbing aircraft near LaGuardia a Departure from LaGuardia', () => {
    // Just northeast of LGA, climbing out over Flushing Bay (JFK is farther away, behind it too).
    const result = spotOnly(
      aircraft({ flight: 'AAL2168 ', t: 'B738', lat: 40.8, lon: -73.84, alt_baro: 2500, gs: 180, track: 45, baro_rate: 2304 }),
    );

    expect(result.verdict).toMatchObject({ kind: 'departure', airport: { code: 'LGA', name: 'LaGuardia' } });
    expect(result.kidLine).toBe('Going up from LaGuardia! Up, up, up! 🛫');
    expect(result.details).toEqual({ callsign: 'AAL2168', aircraftType: 'B738', altitudeFt: 2500 });
  });

  it('does not call a climber heading back toward the airport a Departure', () => {
    // Real UAL51 (B764) climbing through 4,750 ft northwest of Newark, turning back south over it.
    const result = spotOnly(real(jfkSnapshot, 'aa44cf'));

    expect(result.verdict).toEqual({ kind: 'unknown' });
  });

  it('calls a real Newark climb-out a Departure from Newark', () => {
    // Real AAL1446 (B738): 9,575 ft, climbing 2,688 ft/min, heading SSW away from EWR.
    const result = spotOnly(real(brooklynSnapshot, 'aaee3b'));

    expect(result.verdict).toMatchObject({ kind: 'departure', airport: { code: 'EWR' } });
    expect(result.kidLine).toBe('Going up from Newark! Up, up, up! 🛫');
  });

  it('calls a high, level cruiser an Overflight', () => {
    const result = spotOnly(
      aircraft({ flight: 'JBU1601 ', t: 'A320', lat: 40.72, lon: -73.93, alt_baro: 35000, gs: 465, track: 205, baro_rate: 64 }),
    );

    expect(result.verdict).toEqual({ kind: 'overflight' });
    expect(result.kidLine).toBe('Flying far, far away! 🌍');
    expect(result.details).toEqual({ callsign: 'JBU1601', aircraftType: 'A320', altitudeFt: 35000 });
  });

  it('does not call a level plane at mid altitude near the airports an Overflight', () => {
    // Real CPA840 (A35K) at 12,425 ft, just out of JFK — not far, far away yet.
    const result = spotOnly(real(brooklynSnapshot, '789213'));

    expect(result.verdict).toEqual({ kind: 'unknown' });
  });

  it('calls a rotorcraft a helicopter', () => {
    // Real N217MH (Bell 206, category A7) low over the harbor.
    const result = spotOnly(real(brooklynSnapshot, 'a1d49e'));

    expect(result.verdict).toEqual({ kind: 'helicopter' });
    expect(result.kidLine).toBe('A helicopter! Whirr whirr! 🚁');
    expect(result.details).toEqual({ callsign: 'N217MH', aircraftType: 'B06', altitudeFt: 250 });
  });

  it('calls a rotorcraft a helicopter even when it is descending toward an airport', () => {
    const result = spotOnly(
      aircraft({ flight: 'N401FN  ', category: 'A7', lat: 40.62, lon: -73.86, alt_baro: 900, gs: 90, track: 72, baro_rate: -640 }),
    );

    expect(result.verdict).toEqual({ kind: 'helicopter' });
    expect(result.details).toEqual({ callsign: 'N401FN', altitudeFt: 900 });
  });

  it('calls a light aircraft with no route a small plane', () => {
    // Real N4431R (Cessna 172, category A1) over the Lower Bay.
    const result = spotOnly(real(brooklynSnapshot, 'a5584d'));

    expect(result.verdict).toEqual({ kind: 'small-plane' });
    expect(result.kidLine).toBe('A little plane! Putt-putt-putt! 🛩️');
    expect(result.details).toEqual({ callsign: 'N4431R', aircraftType: 'C172', altitudeFt: 500 });
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

  it('gives a Mystery Plane the Amelia Earhart Kid Line', () => {
    const result = spot({ ...brooklyn, heading: 120, elevation: 30, time: NOW }, { ac: [], now: NOW });

    expect(result).toEqual({
      kind: 'mystery',
      kidLine: 'Looks like Amelia Earhart is flying that one! We could not find it.',
    });
  });
});
