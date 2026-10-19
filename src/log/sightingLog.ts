import type { LogStorage } from './storage';
import {
  SIGHTING_FORMAT_VERSION,
  type LoggedAircraft,
  type LoggedVerdict,
  type SightingInput, type StoredSighting, type Walk } from './types';
import { walkName } from './walkName';

export interface Clock {
  /** ms since epoch */
  now(): number;
}

export interface SightingLogDeps {
  clock: Clock;
  storage: LogStorage;
  /** Makes a stable unique ID for each new Sighting. Defaults to `crypto.randomUUID`. */
  newId?: () => string;
}

/** A new Walk starts when more than this long has passed since the previous Sighting. */
export const WALK_GAP_MS = 60 * 60_000;

/** Matches the Sighting Engine's Mystery Plane Kid Line (GLOSSARY.md). */
export const MYSTERY_KID_LINE = 'Looks like Amelia Earhart is flying that one! We could not find it.';

const SPOTTER_KEY = 'plane-goes:spotter';
const SIGHTINGS_KEY = 'plane-goes:sightings';

/*
 * Records are built field by field from an allow-list, so nothing the app happens to pass in
 * (such as the observer's location or heading) can end up stored.
 */
function pickVerdict(verdict: LoggedVerdict): LoggedVerdict {
  const picked: LoggedVerdict = { kind: verdict.kind };
  if (verdict.airports?.length) picked.airports = verdict.airports.map(String);
  return picked;
}

function pickAircraft(aircraft: LoggedAircraft): LoggedAircraft {
  const picked: LoggedAircraft = { hex: aircraft.hex };
  if (aircraft.callsign) picked.callsign = aircraft.callsign;
  if (aircraft.origin) picked.origin = aircraft.origin;
  if (aircraft.destination) picked.destination = aircraft.destination;
  if (aircraft.position) picked.position = { lat: aircraft.position.lat, lon: aircraft.position.lon };
  if (typeof aircraft.altitudeFt === 'number') picked.altitudeFt = aircraft.altitudeFt;
  return picked;
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createSightingLog({ clock, storage, newId = defaultId }: SightingLogDeps) {
  function load(): StoredSighting[] {
    const raw = storage.getItem(SIGHTINGS_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredSighting[]) : [];
    } catch {
      return [];
    }
  }

  function save(sightings: StoredSighting[]): void {
    storage.setItem(SIGHTINGS_KEY, JSON.stringify(sightings));
  }

  const log = {
    getSpotterName(): string | null {
      return storage.getItem(SPOTTER_KEY);
    },

    setSpotterName(name: string): void {
      storage.setItem(SPOTTER_KEY, name);
    },

    /** Saves a Sighting, credited to the current Spotter, at the clock's current time. */
    addSighting(input: SightingInput): StoredSighting {
      const sighting: StoredSighting = {
        id: newId(),
        formatVersion: SIGHTING_FORMAT_VERSION,
        spotter: storage.getItem(SPOTTER_KEY) ?? '',
        time: clock.now(),
        verdict: pickVerdict(input.verdict),
        kidLine: input.kidLine,
      };
      if (input.verdict.kind !== 'mystery' && input.aircraft) sighting.aircraft = pickAircraft(input.aircraft);
      save([...load(), sighting]);
      return sighting;
    },

    /** An Ambiguous result the parent dismissed without choosing still counts: it is saved as a Mystery Plane. */
    addDismissedAmbiguous(): StoredSighting {
      return log.addSighting({ verdict: { kind: 'mystery' }, kidLine: MYSTERY_KID_LINE });
    },

    /** All Walks, newest first; each Walk's Sightings oldest first. */
    listWalks(): Walk[] {
      const sightings = load().sort((a, b) => a.time - b.time);
      const groups: StoredSighting[][] = [];
      for (const sighting of sightings) {
        const current = groups[groups.length - 1];
        if (current && sighting.time - current[current.length - 1].time <= WALK_GAP_MS) current.push(sighting);
        else groups.push([sighting]);
      }
      return groups.reverse().map((group) => ({
        id: group[0].id,
        name: walkName(group[0].time, clock.now()),
        start: group[0].time,
        end: group[group.length - 1].time,
        sightings: group,
        planeCount: group.length,
      }));
    },
  };
  return log;
}

export type SightingLog = ReturnType<typeof createSightingLog>;
