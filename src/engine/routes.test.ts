import { describe, expect, it } from 'vitest';
import { spot, type AircraftSnapshot, type Observation, type Route, type RouteLookup, type SnapshotAircraft } from './index';
import brooklynSnapshot from './__fixtures__/adsblol-point-brooklyn.json';

// Standing in Prospect Heights, Brooklyn.
const brooklyn = { lat: 40.68, lon: -73.97 };
const NOW = 1792367920501;

/** An Observation in Brooklyn with the phone aimed straight at `ac`. */
function aimedAt(ac: SnapshotAircraft): Observation {
  const rad = Math.PI / 180;
  const dNorthNm = (ac.lat! - brooklyn.lat) * 60;
  const dEastNm = (ac.lon! - brooklyn.lon) * 60 * Math.cos(brooklyn.lat * rad);
  const heading = ((Math.atan2(dEastNm, dNorthNm) / rad) + 360) % 360;
  const altFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : 0;
  const elevation = Math.atan2(altFt, Math.hypot(dNorthNm, dEastNm) * 6076) / rad;
  return { ...brooklyn, heading, elevation, time: NOW };
}

/** Spot a sky holding just this one aircraft, aimed straight at it, with a fake route lookup. */
function spotOnly(ac: SnapshotAircraft, lookupRoute?: RouteLookup) {
  const snapshot: AircraftSnapshot = { ac: [ac], now: NOW };
  const result = spot(aimedAt(ac), snapshot, lookupRoute);
  if (result.kind !== 'matched') throw new Error(`expected a match, got ${result.kind}`);
  return result;
}

/** A fake route lookup that knows only the given callsigns. */
function routes(byCallsign: Record<string, Route>): RouteLookup {
  return (callsign) => byCallsign[callsign];
}

/** One real aircraft record from the recorded Brooklyn adsb.lol snapshot. */
function real(hex: string): SnapshotAircraft {
  const ac = (brooklynSnapshot as AircraftSnapshot).ac.find((a) => a.hex === hex);
  if (!ac) throw new Error(`no ${hex} in fixture`);
  return ac;
}

/** Hand-built aircraft in the adsb.lol `/v2/point` shape. */
function aircraft(fields: Partial<SnapshotAircraft>): SnapshotAircraft {
  return { hex: 'a0b1c2', type: 'adsb_icao', category: 'A3', seen: 0.2, seen_pos: 0.4, messages: 1200, rssi: -12, ...fields };
}

const BOS = { code: 'BOS', city: 'Boston', lat: 42.3643, lon: -71.0052 };
const MIA = { code: 'MIA', city: 'Miami', lat: 25.7932, lon: -80.2906 };
const JFK = { code: 'JFK', city: 'New York', lat: 40.6397, lon: -73.7789 };
const TEB = { code: 'TEB', city: 'Teterboro', lat: 40.8501, lon: -74.0608 };
const HPN = { code: 'HPN', city: 'White Plains', lat: 41.067, lon: -73.7076 };
const MVY = { code: 'MVY', city: "Martha's Vineyard", lat: 41.3931, lon: -70.6144 };

/** A light aircraft (Cirrus SR22) over the Bronx, descending north-northeast toward Westchester. */
const cirrus = () =>
  aircraft({ flight: 'N123AB  ', category: 'A1', t: 'SR22', lat: 40.85, lon: -73.78, alt_baro: 3000, gs: 150, track: 14, baro_rate: -600 });

/** A low aircraft over Jamaica Bay on final toward JFK. */
const jfkFinal = () =>
  aircraft({ flight: 'DAL412  ', t: 'A321', lat: 40.62, lon: -73.86, alt_baro: 1500, gs: 140, track: 72, baro_rate: -768 });

describe('Routes: city names, airline and Other Nearby Airports', () => {
  it('names the origin city for an Arrival at JFK with a matching route', () => {
    const result = spotOnly(jfkFinal(), routes({ DAL412: { airline: 'Delta Air Lines', origin: BOS, destination: JFK } }));

    expect(result.verdict).toMatchObject({ kind: 'arrival', airport: { code: 'JFK' } });
    expect(result.kidLine).toBe('Coming down to JFK from Boston! Bye-bye, sky! 🛬');
    expect(result.details).toEqual({
      callsign: 'DAL412',
      airline: 'Delta Air Lines',
      aircraftType: 'A321',
      origin: 'Boston (BOS)',
      destination: 'New York (JFK)',
      altitudeFt: 1500,
      minutesToLanding: 2,
    });
  });

  it('names both ends for a high, level cruiser with an out-of-area route', () => {
    // Over Brooklyn at 35,000 ft, heading south-southwest: from Boston, on the way to Miami.
    const cruiser = aircraft({ flight: 'JBU1601 ', t: 'A320', lat: 40.72, lon: -73.93, alt_baro: 35000, gs: 465, track: 205, baro_rate: 64 });
    const result = spotOnly(cruiser, routes({ JBU1601: { airline: 'JetBlue Airways', origin: BOS, destination: MIA } }));

    expect(result.verdict).toMatchObject({ kind: 'overflight', origin: { city: 'Boston' }, destination: { city: 'Miami' } });
    expect(result.kidLine).toBe('Flying far, far away from Boston to Miami! 🌍');
    expect(result.details).toEqual({
      callsign: 'JBU1601',
      airline: 'JetBlue Airways',
      aircraftType: 'A320',
      origin: 'Boston (BOS)',
      destination: 'Miami (MIA)',
      altitudeFt: 35000,
    });
  });

  it('keeps the motion Verdict and drops the city names when a stale route contradicts the motion', () => {
    // Real DAL1636 climbing out of JFK at 700 ft; adsbdb's stale route says Salt Lake City → Austin.
    const stale: Route = {
      airline: 'Delta Air Lines',
      origin: { code: 'SLC', city: 'Salt Lake City', lat: 40.78575, lon: -111.97975 },
      destination: { code: 'AUS', city: 'Austin', lat: 30.1975, lon: -97.6664 },
    };
    const result = spotOnly(real('a45586'), routes({ DAL1636: stale }));

    expect(result.verdict).toEqual({ kind: 'departure', airport: expect.objectContaining({ code: 'JFK' }), distanceNm: expect.any(Number) });
    expect(result.kidLine).toBe('Going up from JFK! Up, up, up! 🛫');
    expect(result.details).toEqual({ callsign: 'DAL1636', airline: 'Delta Air Lines', aircraftType: 'B738', altitudeFt: 700 });
  });

  it('drops the city names when an Overflight is flying the wrong way for its route', () => {
    // Heading south-southwest, but the route says Miami → Boston.
    const cruiser = aircraft({ flight: 'JBU1601 ', lat: 40.72, lon: -73.93, alt_baro: 35000, gs: 465, track: 205, baro_rate: 64 });
    const result = spotOnly(cruiser, routes({ JBU1601: { origin: MIA, destination: BOS } }));

    expect(result.verdict).toEqual({ kind: 'overflight' });
    expect(result.kidLine).toBe('Flying far, far away! 🌍');
    expect(result.details.origin).toBeUndefined();
  });

  it('names the destination city for a Departure from LaGuardia with a matching route', () => {
    const climber = aircraft({ flight: 'AAL2168 ', lat: 40.8, lon: -73.84, alt_baro: 2500, gs: 180, track: 45, baro_rate: 2304 });
    const LGA = { code: 'LGA', city: 'New York', lat: 40.7772, lon: -73.8726 };
    const result = spotOnly(climber, routes({ AAL2168: { airline: 'American Airlines', origin: LGA, destination: MIA } }));

    expect(result.verdict).toMatchObject({ kind: 'departure', airport: { code: 'LGA' }, destination: { city: 'Miami' } });
    expect(result.kidLine).toBe('Going up from LaGuardia to Miami! Up, up, up! 🛫');
    expect(result.details).toMatchObject({ origin: 'New York (LGA)', destination: 'Miami (MIA)' });
  });

  it('calls a bizjet descending toward Teterboro with a matching route an Arrival at Teterboro', () => {
    // Real N807LP (C680): 700 ft, sinking 576 ft/min, tracking NE toward Teterboro.
    const PBI = { code: 'PBI', city: 'West Palm Beach', lat: 26.6832, lon: -80.0956 };
    const result = spotOnly(real('aafce6'), routes({ N807LP: { origin: PBI, destination: TEB } }));

    expect(result.verdict).toMatchObject({ kind: 'arrival', airport: { code: 'TEB', name: 'Teterboro' }, origin: { city: 'West Palm Beach' } });
    expect(result.kidLine).toBe('Coming down to Teterboro from West Palm Beach! Bye-bye, sky! 🛬');
    expect(result.details).toMatchObject({ origin: 'West Palm Beach (PBI)', destination: 'Teterboro (TEB)' });
  });

  it('does not let a route name Teterboro when the motion points at JFK', () => {
    const result = spotOnly(jfkFinal(), routes({ DAL412: { origin: BOS, destination: TEB } }));

    expect(result.verdict).toEqual({ kind: 'arrival', airport: expect.objectContaining({ code: 'JFK' }), distanceNm: expect.any(Number) });
    expect(result.kidLine).toBe('Coming down to JFK! Bye-bye, sky! 🛬');
  });

  it('uses a fitting route for a light aircraft rather than the small-plane catch-all', () => {
    // A Cirrus over the Bronx, descending north-northeast toward Westchester, from Martha's Vineyard.
    const result = spotOnly(cirrus(), routes({ N123AB: { origin: MVY, destination: HPN } }));

    expect(result.verdict).toMatchObject({ kind: 'arrival', airport: { code: 'HPN', name: 'Westchester' } });
    expect(result.kidLine).toBe("Coming down to Westchester from Martha's Vineyard! Bye-bye, sky! 🛬");
  });

  it('keeps the small-plane catch-all for a light aircraft whose route does not fit', () => {
    const result = spotOnly(cirrus(), routes({ N123AB: { origin: BOS, destination: MIA } }));

    expect(result.verdict).toEqual({ kind: 'small-plane' });
    expect(result.details.origin).toBeUndefined();
  });

  it('gives the motion Verdict when the route lookup knows nothing', () => {
    const result = spotOnly(jfkFinal(), () => undefined);

    expect(result.verdict).toMatchObject({ kind: 'arrival', airport: { code: 'JFK' } });
    expect(result.details).toEqual({ callsign: 'DAL412', aircraftType: 'A321', altitudeFt: 1500, minutesToLanding: 2 });
  });
});
