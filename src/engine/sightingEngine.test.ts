import { describe, expect, it } from 'vitest';
import { spot, type AircraftSnapshot, type Observation, type SightingResult, type SnapshotAircraft } from './index';
import brooklynSnapshot from './__fixtures__/adsblol-point-brooklyn.json';

const time = 1792367920501;

// Standing in Prospect Heights, Brooklyn — the point the fixture was queried at.
const brooklyn = { lat: 40.68, lon: -73.97, time };

const pointing = (heading: number, elevation: number): Observation => ({ ...brooklyn, heading, elevation });

describe('Sighting Engine: picking the plane being pointed at', () => {
  it('picks the plane the phone points at, not the nearest one', () => {
    // DAL2561 is ~10.5 nm away to the south-southwest (bearing ~209°) at ~12,000 ft,
    // so it sits about 11° above the horizon. AAL3225 is the nearest plane (1 nm, northeast).
    const result = spot(pointing(209, 11), brooklynSnapshot as AircraftSnapshot);

    expect(result.kind).toBe('matched');
    if (result.kind !== 'matched') return;
    expect(result.flight.callsign).toBe('DAL2561');
    expect(result.flight.hex).toBe('a77645');
  });

  it('considers high-altitude cruisers, telling them apart from low planes on the same bearing', () => {
    // Both due east, 20 miles out. At 38,000 ft the cruiser is ~17° up; the low one is ~1° up.
    const snapshot = sky(
      plane('cruiser', { milesEast: 20, altFt: 38000 }),
      plane('low', { milesEast: 20, altFt: 1500 }),
    );

    expect(callsignOf(spot(pointing(90, 17), snapshot))).toBe('cruiser');
    expect(callsignOf(spot(pointing(90, 1), snapshot))).toBe('low');
  });

  it('ignores aircraft beyond about 25 miles, even when pointing right at them', () => {
    // 30 miles east at 38,000 ft appears ~11.5° up.
    const snapshot = sky(plane('far', { milesEast: 30, altFt: 38000 }));

    expect(spot(pointing(90, 11.5), snapshot).kind).toBe('mystery');
  });

  it('still picks a plane just inside the search radius', () => {
    // 24 miles east at 38,000 ft appears ~14.3° up.
    const snapshot = sky(plane('near-edge', { milesEast: 24, altFt: 38000 }));

    expect(callsignOf(spot(pointing(90, 14.3), snapshot))).toBe('near-edge');
  });

  it('measures direction from where the parent stands', () => {
    // Standing at JFK, DAL1636 (climbing out near Howard Beach) is ~3 nm to the west, ~3.6° up.
    const atJfk: Observation = { lat: 40.6467, lon: -73.7755, heading: 278, elevation: 4, time };

    expect(callsignOf(spot(atJfk, brooklynSnapshot as AircraftSnapshot))).toBe('DAL1636');
  });

  it('names a plane by its registration when it broadcasts no callsign, else by its hex code', () => {
    const snapshot = sky(
      { hex: 'a1b2ee', r: 'N2086J', ...eastOf(5), alt_geom: 3000 },
      { hex: '~275c05', lat: brooklyn.lat + 5 / 60, lon: brooklyn.lon, alt_geom: 3000 },
    );

    expect(callsignOf(spot(pointing(90, 6), snapshot))).toBe('N2086J');
    expect(callsignOf(spot(pointing(0, 6), snapshot))).toBe('~275c05');
  });
});

describe('Sighting Engine: Mystery Plane', () => {
  const mystery = {
    kind: 'mystery',
    kidLine: 'Looks like Amelia Earhart is flying that one! We could not find it.',
  };

  it('returns a Mystery Plane when the sky is empty', () => {
    expect(spot(pointing(90, 20), { ac: [], now: time })).toEqual(mystery);
  });

  it('returns a Mystery Plane when nothing is within the match tolerance', () => {
    // Due east, 10 miles, 5,000 ft → ~5.4° up. Pointing 30° away along the horizon.
    const snapshot = sky(plane('elsewhere', { milesEast: 10, altFt: 5000 }));

    expect(spot(pointing(120, 5), snapshot)).toEqual(mystery);
  });

  it('still matches a plane a little off where the phone points (compass drift)', () => {
    const snapshot = sky(plane('drifty', { milesEast: 10, altFt: 5000 }));

    expect(callsignOf(spot(pointing(105, 5), snapshot))).toBe('drifty');
  });

  it('returns a Mystery Plane when pointing at the real Brooklyn sky where no plane is', () => {
    // Straight up: nothing in the fixture is anywhere near overhead.
    expect(spot(pointing(0, 89), brooklynSnapshot as AircraftSnapshot)).toEqual(mystery);
  });
});

// --- helpers to build Aircraft Snapshots shaped like adsb.lol responses ---

const MILES_PER_DEG_LAT = 69.05;

function eastOf(miles: number) {
  return { lat: brooklyn.lat, lon: brooklyn.lon + miles / (MILES_PER_DEG_LAT * Math.cos((brooklyn.lat * Math.PI) / 180)) };
}

function plane(callsign: string, { milesEast, altFt }: { milesEast: number; altFt: number }): SnapshotAircraft {
  return { hex: `x-${callsign}`, flight: callsign.padEnd(8, ' '), ...eastOf(milesEast), alt_baro: altFt, alt_geom: altFt };
}

function sky(...ac: SnapshotAircraft[]): AircraftSnapshot {
  return { ac, now: time };
}

function callsignOf(result: SightingResult): string | undefined {
  return result.kind === 'matched' ? result.flight.callsign : undefined;
}
