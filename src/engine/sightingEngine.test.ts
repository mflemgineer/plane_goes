import { describe, expect, it } from 'vitest';
import { spot, type AircraftSnapshot, type Observation } from './index';
import brooklynSnapshot from './__fixtures__/adsblol-point-brooklyn.json';

// Standing in Prospect Heights, Brooklyn — the point the fixture was queried at.
const brooklyn: Observation = {
  lat: 40.68,
  lon: -73.97,
  time: 1792367920501,
};

describe('Sighting Engine', () => {
  it('matches the nearest aircraft in a real Brooklyn snapshot', () => {
    const result = spot(brooklyn, brooklynSnapshot as AircraftSnapshot);

    expect(result.kind).toBe('matched');
    if (result.kind !== 'matched') return;
    expect(result.flight.callsign).toBe('AAL3225');
    expect(result.flight.hex).toBe('aae960');
  });

  it('returns a Mystery Plane when the sky is empty', () => {
    const result = spot(brooklyn, { ac: [], now: brooklyn.time });

    expect(result.kind).toBe('mystery');
  });

  it('measures distance from where the parent stands, not from the query point', () => {
    // Standing by LaGuardia: JBU699 (on the ground at LGA) is now the closest.
    const atLaGuardia: Observation = { lat: 40.7772, lon: -73.8726, time: brooklyn.time };

    const result = spot(atLaGuardia, brooklynSnapshot as AircraftSnapshot);

    expect(result.kind === 'matched' && result.flight.callsign).toBe('JBU699');
  });

  it('falls back to the registration when the aircraft broadcasts no callsign', () => {
    // a1b2ee (N2086J) sits on the ground at JFK with no `flight` field.
    const atJfk: Observation = { lat: 40.6467, lon: -73.7755, time: brooklyn.time };

    const result = spot(atJfk, brooklynSnapshot as AircraftSnapshot);

    expect(result.kind === 'matched' && result.flight.callsign).toBe('N2086J');
  });
});
