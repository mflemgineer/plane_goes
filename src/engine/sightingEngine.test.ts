import { describe, expect, it } from 'vitest';
import { choose, nearbyPlanes, spot, type AircraftSnapshot, type Observation, type SightingResult, type SnapshotAircraft } from './index';
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

describe('Sighting Engine: not that one? (Ambiguous)', () => {
  it('returns Ambiguous, best-aimed first, when two planes are close to where the phone points', () => {
    // Both 10 miles out at 5,000 ft (~5.4° up): one 2° off the aim, the other 4° off on the other side.
    const snapshot = sky(
      plane('second', { milesEast: 10, altFt: 5000, bearing: 94 }),
      plane('first', { milesEast: 10, altFt: 5000, bearing: 88 }),
    );

    const result = spot(pointing(90, 5.4), snapshot);

    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.candidates.map((c) => c.flight.callsign)).toEqual(['first', 'second']);
  });

  it('gives each candidate its own Verdict and Kid Line', () => {
    const snapshot = sky(
      { ...plane('N401FN', { milesEast: 10, altFt: 5000, bearing: 94 }), category: 'A7' },
      { ...plane('N4431R', { milesEast: 10, altFt: 5000, bearing: 88 }), category: 'A1' },
    );

    const result = spot(pointing(90, 5.4), snapshot);

    if (result.kind !== 'ambiguous') throw new Error('expected Ambiguous');
    expect(result.candidates.map((c) => [c.flight.callsign, c.verdict.kind, c.kidLine])).toEqual([
      ['N4431R', 'small-plane', 'A little plane! Putt-putt-putt! 🛩️'],
      ['N401FN', 'helicopter', 'A helicopter! Whirr whirr! 🚁'],
    ]);
  });

  it('returns a single match when the runner-up is clearly farther from the aim', () => {
    // The winner is 1° off the aim; the runner-up is 12° off: still in tolerance, but well outside the margin.
    const snapshot = sky(
      plane('runner-up', { milesEast: 10, altFt: 5000, bearing: 102 }),
      plane('winner', { milesEast: 10, altFt: 5000, bearing: 91 }),
    );

    const result = spot(pointing(90, 5.4), snapshot);

    expect(result.kind).toBe('matched');
    expect(callsignOf(result)).toBe('winner');
  });

  it('offers only a short list, best-aimed first, when many planes crowd the aim', () => {
    const snapshot = sky(
      ...[86, 87, 88, 89, 90].map((bearing) => plane(`b${bearing}`, { milesEast: 10, altFt: 5000, bearing })),
    );

    const result = spot(pointing(90, 5.4), snapshot);

    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.candidates.map((c) => c.flight.callsign)).toEqual(['b90', 'b89', 'b88']);
  });

  it('choosing a candidate makes it the answer', () => {
    const snapshot = sky(
      plane('second', { milesEast: 10, altFt: 5000, bearing: 94 }),
      plane('first', { milesEast: 10, altFt: 5000, bearing: 88 }),
    );
    const result = spot(pointing(90, 5.4), snapshot);
    if (result.kind !== 'ambiguous') throw new Error('expected Ambiguous');

    const chosen = choose(result.candidates[1]);

    expect(chosen.kind).toBe('matched');
    expect(callsignOf(chosen)).toBe('second');
  });
});

describe('Sighting Engine: all nearby planes', () => {
  it('lists every plane in the search radius, closest to the aim first, even ones far off the aim', () => {
    const snapshot = sky(
      plane('behind-you', { milesEast: 10, altFt: 5000, bearing: 270 }),
      plane('too-far', { milesEast: 30, altFt: 38000, bearing: 90 }),
      plane('close', { milesEast: 10, altFt: 5000, bearing: 92 }),
      { hex: 'no-position', flight: 'NOPOS   ' },
      plane('off-a-bit', { milesEast: 10, altFt: 5000, bearing: 130 }),
    );

    const nearby = nearbyPlanes(pointing(90, 5.4), snapshot);

    expect(nearby.map((c) => c.flight.callsign)).toEqual(['close', 'off-a-bit', 'behind-you']);
  });

  it('lists the real Brooklyn sky, starting with the plane being pointed at', () => {
    const nearby = nearbyPlanes(pointing(209, 11), brooklynSnapshot as AircraftSnapshot);

    expect(nearby[0].flight.callsign).toBe('DAL2561');
    expect(nearby.length).toBe(brooklynSnapshot.ac.length);
  });

  it('choosing a plane from the list makes it the answer, even with nothing near the aim', () => {
    const snapshot = sky(plane('behind-you', { milesEast: 10, altFt: 5000, bearing: 270 }));
    expect(spot(pointing(90, 5.4), snapshot).kind).toBe('mystery');

    const [picked] = nearbyPlanes(pointing(90, 5.4), snapshot);

    expect(callsignOf(choose(picked))).toBe('behind-you');
  });
});

// --- helpers to build Aircraft Snapshots shaped like adsb.lol responses ---

const MILES_PER_DEG_LAT = 69.05;

function eastOf(miles: number) {
  return { lat: brooklyn.lat, lon: brooklyn.lon + miles / (MILES_PER_DEG_LAT * Math.cos((brooklyn.lat * Math.PI) / 180)) };
}

/** A plane `milesEast` miles away (or that far along `bearing`, degrees true), at `altFt`. */
function plane(
  callsign: string,
  { milesEast, altFt, bearing = 90 }: { milesEast: number; altFt: number; bearing?: number },
): SnapshotAircraft {
  const b = (bearing * Math.PI) / 180;
  const north = milesEast * Math.cos(b);
  const east = milesEast * Math.sin(b);
  const lat = brooklyn.lat + north / MILES_PER_DEG_LAT;
  const lon = eastOf(east).lon;
  return { hex: `x-${callsign}`, flight: callsign.padEnd(8, ' '), lat, lon, alt_baro: altFt, alt_geom: altFt };
}

function sky(...ac: SnapshotAircraft[]): AircraftSnapshot {
  return { ac, now: time };
}

function callsignOf(result: SightingResult): string | undefined {
  return result.kind === 'matched' ? result.flight.callsign : undefined;
}
