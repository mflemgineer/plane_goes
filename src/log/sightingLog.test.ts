import { describe, expect, it } from 'vitest';
import { createSightingLog, memoryStorage, type Clock, type SightingInput } from './index';

/** A clock the test moves by hand. */
function fakeClock(start: Date): Clock & { set(d: Date): void; advanceMinutes(m: number): void } {
  let now = start.getTime();
  return {
    now: () => now,
    set: (d) => {
      now = d.getTime();
    },
    advanceMinutes: (m) => {
      now += m * 60_000;
    },
  };
}

describe('Spotter', () => {
  it('has no Spotter name until one is set, then remembers it across app launches', () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage });
    expect(log.getSpotterName()).toBeNull();

    log.setSpotterName('Davey');
    expect(log.getSpotterName()).toBe('Davey');

    const relaunched = createSightingLog({ clock, storage });
    expect(relaunched.getSpotterName()).toBe('Davey');
    relaunched.setSpotterName('Davy');
    expect(createSightingLog({ clock, storage }).getSpotterName()).toBe('Davy');
  });

  it('credits every Sighting to the Spotter at the time, Mystery Planes included', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.setSpotterName('Davey');
    log.addSighting(jfkArrival);
    clock.advanceMinutes(5);
    log.addSighting(mysteryPlane);
    clock.advanceMinutes(5);
    log.setSpotterName('Rosie');
    log.addSighting(mysteryPlane);

    const [walk] = log.listWalks();
    expect(walk.sightings.map((s) => [s.spotter, s.verdict.kind])).toEqual([
      ['Davey', 'arrival'],
      ['Davey', 'mystery'],
      ['Rosie', 'mystery'],
    ]);
    expect(walk.planeCount).toBe(3);
  });

  it('saves an Ambiguous result the parent dismisses without choosing as a Mystery Plane for the Spotter', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.setSpotterName('Davey');
    log.addDismissedAmbiguous();

    const [sighting] = log.listWalks()[0].sightings;
    expect(sighting.spotter).toBe('Davey');
    expect(sighting.verdict.kind).toBe('mystery');
    expect(sighting.kidLine).toBe('Looks like Amelia Earhart is flying that one! We could not find it.');
    expect(sighting.aircraft).toBeUndefined();
  });
});

const jfkArrival: SightingInput = {
  verdict: { kind: 'arrival', airports: ['JFK'] },
  kidLine: 'Coming down to JFK! Bye-bye, sky! 🛬',
  aircraft: {
    hex: 'a1b2c3',
    callsign: 'DAL1636',
    origin: 'Atlanta',
    destination: 'JFK',
    position: { lat: 40.62, lon: -73.86 },
    altitudeFt: 2400,
  },
};

const mysteryPlane: SightingInput = {
  verdict: { kind: 'mystery' },
  kidLine: 'Looks like Amelia Earhart is flying that one! We could not find it.',
};

describe('Stored Sightings', () => {
  // Where the family was standing and where the phone pointed: must never be kept.
  const observer = { lat: 40.68765, lon: -73.97541, heading: 137.5, elevation: 22.25 };

  it('keeps the plane but never the observer location or heading, even if the app passes them in', () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage });
    const careless = {
      ...jfkArrival,
      observation: observer,
      ...observer,
      aircraft: { ...jfkArrival.aircraft!, observer, heading: observer.heading },
    } as unknown as SightingInput;
    log.addSighting(careless);
    log.addSighting({ ...mysteryPlane, observation: observer, ...observer } as unknown as SightingInput);

    const persisted = JSON.stringify(storage.dump());
    for (const value of Object.values(observer)) expect(persisted).not.toContain(String(value));
    expect(persisted).not.toMatch(/heading|elevation|observ/i);

    const [arrival, mystery] = log.listWalks()[0].sightings;
    expect(arrival.aircraft).toEqual(jfkArrival.aircraft);
    expect(arrival.verdict).toEqual({ kind: 'arrival', airports: ['JFK'] });
    expect(Object.keys(arrival).sort()).toEqual(
      ['aircraft', 'formatVersion', 'id', 'kidLine', 'spotter', 'time', 'verdict'].sort(),
    );
    expect(Object.keys(mystery)).not.toContain('aircraft');
  });

  it('gives each record a unique ID that stays the same after relaunch, and a format version', () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage });
    const added = [log.addSighting(jfkArrival), log.addSighting(mysteryPlane), log.addSighting(jfkArrival)];

    const ids = added.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/\S{8,}/);

    const reloaded = createSightingLog({ clock, storage }).listWalks()[0].sightings;
    expect(reloaded.map((s) => s.id)).toEqual(ids);
    expect(reloaded.map((s) => s.formatVersion)).toEqual([2, 2, 2]);
    expect(reloaded[0].time).toBe(new Date(2026, 9, 19, 9, 0).getTime());
  });

  it('corrects a Sighting when the parent picks the right plane afterwards, keeping its ID, time and Spotter', () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage });
    log.setSpotterName('Davey');
    const first = log.addSighting(mysteryPlane);
    clock.advanceMinutes(1);
    log.setSpotterName('Rosie');
    const corrected = log.correctSighting(first.id, jfkArrival);

    const sightings = createSightingLog({ clock, storage }).listWalks()[0].sightings;
    expect(sightings).toHaveLength(1);
    expect(sightings[0]).toEqual(corrected);
    expect(corrected).toMatchObject({
      id: first.id,
      time: first.time,
      spotter: 'Davey',
      verdict: { kind: 'arrival', airports: ['JFK'] },
      aircraft: jfkArrival.aircraft,
    });
  });

  it('adds a new Sighting when asked to correct one that is no longer kept', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.correctSighting('gone', jfkArrival);
    expect(log.listWalks()[0].sightings).toHaveLength(1);
  });

  it("keeps the plane's Grown-up Details so a Walk can show them later", () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const withDetails: SightingInput = {
      ...jfkArrival,
      aircraft: { ...jfkArrival.aircraft!, airline: 'Delta Air Lines', aircraftType: 'B739', minutesToLanding: 6 },
    };
    createSightingLog({ clock, storage }).addSighting(withDetails);

    const [sighting] = createSightingLog({ clock, storage }).listWalks()[0].sightings;
    expect(sighting.formatVersion).toBe(2);
    expect(sighting.aircraft).toEqual({
      hex: 'a1b2c3',
      callsign: 'DAL1636',
      airline: 'Delta Air Lines',
      aircraftType: 'B739',
      origin: 'Atlanta',
      destination: 'JFK',
      position: { lat: 40.62, lon: -73.86 },
      altitudeFt: 2400,
      minutesToLanding: 6,
    });
  });

  it('keeps aircraft identifiers only for matched Sightings', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.addSighting({ ...mysteryPlane, aircraft: jfkArrival.aircraft });
    expect(log.listWalks()[0].sightings[0].aircraft).toBeUndefined();
  });
});

describe('Walks', () => {
  it('keeps Sightings 59 minutes apart on the same Walk', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.addSighting(jfkArrival);
    clock.advanceMinutes(59);
    log.addSighting(lgaDeparture);

    const walks = log.listWalks();
    expect(walks).toHaveLength(1);
    expect(walks[0].sightings).toHaveLength(2);
    expect(walks[0].planeCount).toBe(2);
  });

  it('starts a new Walk when Sightings are 61 minutes apart, newest Walk first', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.addSighting(jfkArrival);
    clock.advanceMinutes(30);
    log.addSighting(lgaDeparture);
    clock.advanceMinutes(61);
    log.addSighting(mysteryPlane);

    const walks = log.listWalks();
    expect(walks.map((w) => w.planeCount)).toEqual([1, 2]);
    expect(walks[0].sightings[0].verdict.kind).toBe('mystery');
    expect(walks[0].start).toBe(new Date(2026, 9, 19, 10, 31).getTime());
  });

  it.each([
    ['this morning', new Date(2026, 9, 19, 8, 15), "This morning's walk"],
    ['this afternoon', new Date(2026, 9, 19, 13, 0), "This afternoon's walk"],
    ['this evening', new Date(2026, 9, 19, 18, 30), "This evening's walk"],
    ['yesterday morning', new Date(2026, 9, 18, 10, 0), "Yesterday morning's walk"],
    ['yesterday afternoon', new Date(2026, 9, 18, 15, 45), "Yesterday afternoon's walk"],
    ['yesterday evening', new Date(2026, 9, 18, 19, 0), "Yesterday evening's walk"],
    ['an older date', new Date(2026, 9, 14, 10, 0), 'Wednesday, October 14'],
    ['a date last year', new Date(2025, 11, 30, 10, 0), 'December 30, 2025'],
  ])('names a Walk from %s', (_when, walkTime, name) => {
    const clock = fakeClock(walkTime);
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.addSighting(jfkArrival);
    clock.set(new Date(2026, 9, 19, 20, 0));
    expect(log.listWalks()[0].name).toBe(name);
  });

  it('keeps Walks after the app is relaunched', () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    createSightingLog({ clock, storage }).addSighting(jfkArrival);
    expect(createSightingLog({ clock, storage }).listWalks()[0].sightings[0].kidLine).toBe(jfkArrival.kidLine);
  });
});

const lgaDeparture: SightingInput = {
  verdict: { kind: 'departure', airports: ['LGA'] },
  kidLine: 'Going up from LaGuardia! 🛫',
  aircraft: { hex: 'b2c3d4', callsign: 'RPA4791', position: { lat: 40.79, lon: -73.88 }, altitudeFt: 3100 },
};

function overflight(hex: string, destination?: string): SightingInput {
  return {
    verdict: { kind: 'overflight' },
    kidLine: 'Flying far, far away! 🌍',
    aircraft: { hex, callsign: `BAW${hex.slice(0, 3)}`, origin: 'Boston', destination, altitudeFt: 36000 },
  };
}

function arrivalAt(code: string, hex: string): SightingInput {
  return { ...jfkArrival, verdict: { kind: 'arrival', airports: [code] }, aircraft: { ...jfkArrival.aircraft!, hex } };
}

describe('Walk summaries', () => {
  it('counts pointing at the same Flight several times on one Walk as one plane', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.addSighting(jfkArrival);
    clock.advanceMinutes(1);
    log.addSighting(jfkArrival);
    clock.advanceMinutes(1);
    log.addSighting(lgaDeparture);
    clock.advanceMinutes(1);
    log.addSighting(jfkArrival);

    const [walk] = log.listWalks();
    expect(walk.sightings).toHaveLength(4);
    expect(walk.planeCount).toBe(2);
    expect(walk.summary).toBe('2 planes — 1 JFK Arrival, 1 LaGuardia Departure');
  });

  it('counts two Mystery Planes on one Walk as two planes', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.addSighting(mysteryPlane);
    clock.advanceMinutes(2);
    log.addDismissedAmbiguous();

    const [walk] = log.listWalks();
    expect(walk.planeCount).toBe(2);
    expect(walk.summary).toBe('2 planes — 2 Mystery Planes');
  });

  it('groups the summary by Verdict kind and airport, naming Overflight destinations when known', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    const spotted = [
      mysteryPlane,
      overflight('c0ffee', 'London'),
      arrivalAt('JFK', 'aaa001'),
      lgaDeparture,
      arrivalAt('EWR', 'aaa002'),
      arrivalAt('JFK', 'aaa003'),
      overflight('c0ffef'),
      { verdict: { kind: 'helicopter' }, kidLine: 'A helicopter! Whirr whirr! 🚁', aircraft: { hex: 'heli01' } },
      arrivalAt('JFK', 'aaa001'), // the same Flight again
    ] satisfies SightingInput[];
    for (const input of spotted) {
      log.addSighting(input);
      clock.advanceMinutes(3);
    }

    expect(log.listWalks()[0].summary).toBe(
      '8 planes — 2 JFK Arrivals, 1 Newark Arrival, 1 LaGuardia Departure, 1 Overflight to London, 1 Overflight, 1 Helicopter, 1 Mystery Plane',
    );
  });
});

describe('Spotter credit', () => {
  it.each([
    [new Date(2026, 9, 19, 8, 15), 'Davey spotted 2 planes this morning'],
    [new Date(2026, 9, 18, 15, 0), 'Davey spotted 2 planes yesterday afternoon'],
    [new Date(2026, 9, 18, 22, 0), 'Davey spotted 2 planes last night'],
    [new Date(2026, 9, 14, 10, 0), 'Davey spotted 2 planes on Wednesday, October 14'],
  ])('credits the Spotter with the Walk (from %s)', (walkTime, credit) => {
    const clock = fakeClock(walkTime);
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.setSpotterName('Davey');
    log.addSighting(jfkArrival);
    log.addSighting(jfkArrival);
    log.addSighting(mysteryPlane);
    clock.set(new Date(2026, 9, 19, 20, 0));
    expect(log.listWalks()[0].credit).toBe(credit);
  });

  it('says "1 plane", names every Spotter credited on the Walk, and copes with no name', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    log.addSighting(jfkArrival);
    expect(log.listWalks()[0].credit).toBe('You spotted 1 plane this morning');

    log.clear();
    log.setSpotterName('Davey');
    log.addSighting(jfkArrival);
    log.setSpotterName('Rosie');
    log.addSighting(lgaDeparture);
    expect(log.listWalks()[0].credit).toBe('Davey and Rosie spotted 2 planes this morning');
  });
});

describe('Delete and clear', () => {
  it("deleting a Sighting removes it and updates the Walk's count and summary, even after relaunch", () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage });
    log.addSighting(jfkArrival);
    clock.advanceMinutes(5);
    const departure = log.addSighting(lgaDeparture);
    clock.advanceMinutes(5);
    log.addSighting(mysteryPlane);
    expect(log.listWalks()[0].planeCount).toBe(3);

    log.deleteSighting(departure.id);

    const [walk] = createSightingLog({ clock, storage }).listWalks();
    expect(walk.sightings.map((s) => s.verdict.kind)).toEqual(['arrival', 'mystery']);
    expect(walk.planeCount).toBe(2);
    expect(walk.summary).toBe('2 planes — 1 JFK Arrival, 1 Mystery Plane');
  });

  it('deleting the only Sighting of a Walk removes the Walk', () => {
    const clock = fakeClock(new Date(2026, 9, 19, 9, 0));
    const log = createSightingLog({ clock, storage: memoryStorage() });
    const only = log.addSighting(jfkArrival);
    log.deleteSighting(only.id);
    log.deleteSighting('not-kept');
    expect(log.listWalks()).toEqual([]);
  });

  it("clear empties the log but keeps the Spotter's name", () => {
    const storage = memoryStorage();
    const clock = fakeClock(new Date(2026, 9, 18, 9, 0));
    const log = createSightingLog({ clock, storage });
    log.setSpotterName('Davey');
    log.addSighting(jfkArrival);
    clock.advanceMinutes(24 * 60);
    log.addSighting(mysteryPlane);

    log.clear();

    const relaunched = createSightingLog({ clock, storage });
    expect(relaunched.listWalks()).toEqual([]);
    expect(relaunched.getSpotterName()).toBe('Davey');
  });
});
