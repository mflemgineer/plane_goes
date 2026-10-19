/**
 * Walk counts and summaries, e.g.
 * "5 planes — 2 JFK Arrivals, 1 LaGuardia Departure, 1 Overflight to London, 1 Mystery Plane".
 */
import { airportByCode } from '../engine';
import type { StoredSighting, VerdictKind } from './types';

/**
 * The planes a Walk counts: repeat Sightings of the same Flight (ICAO hex) count once, using the
 * latest Sighting of it. Mystery Planes have no Flight identity, so each one counts.
 */
export function distinctPlanes(sightings: StoredSighting[]): StoredSighting[] {
  const latestByHex = new Map<string, StoredSighting>();
  const planes: (StoredSighting | string)[] = [];
  for (const sighting of sightings) {
    const hex = sighting.aircraft?.hex;
    if (!hex) {
      planes.push(sighting);
      continue;
    }
    if (!latestByHex.has(hex)) planes.push(hex);
    latestByHex.set(hex, sighting);
  }
  return planes.map((p) => (typeof p === 'string' ? latestByHex.get(p)! : p));
}

const KIND_ORDER: VerdictKind[] = ['arrival', 'departure', 'overflight', 'helicopter', 'small-plane', 'unknown', 'mystery'];

const KIND_NOUN: Record<VerdictKind, [string, string]> = {
  arrival: ['Arrival', 'Arrivals'],
  departure: ['Departure', 'Departures'],
  overflight: ['Overflight', 'Overflights'],
  helicopter: ['Helicopter', 'Helicopters'],
  'small-plane': ['Small Plane', 'Small Planes'],
  unknown: ['Other Plane', 'Other Planes'],
  mystery: ['Mystery Plane', 'Mystery Planes'],
};

function airportName(code: string): string {
  return airportByCode(code)?.name ?? code;
}

/** What a plane is grouped under: its Verdict kind plus, where it helps, the airport or Overflight destination. */
function groupOf(plane: StoredSighting): { kind: VerdictKind; prefix?: string; suffix?: string } {
  const { kind, airports } = plane.verdict;
  if ((kind === 'arrival' || kind === 'departure') && airports?.length) return { kind, prefix: airportName(airports[0]) };
  // "London (LHR)" reads as "London" in a summary.
  const destination = plane.aircraft?.destination?.replace(/\s*\([^)]*\)\s*$/, '');
  if (kind === 'overflight' && destination) return { kind, suffix: `to ${destination}` };
  return { kind };
}

export function planeCountText(count: number): string {
  return `${count} ${count === 1 ? 'plane' : 'planes'}`;
}

export function walkSummary(sightings: StoredSighting[]): string {
  const planes = distinctPlanes(sightings);
  const groups = new Map<string, { kind: VerdictKind; prefix?: string; suffix?: string; count: number; first: number }>();
  planes.forEach((plane, index) => {
    const group = groupOf(plane);
    const key = `${group.kind}|${group.prefix ?? ''}|${group.suffix ?? ''}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { ...group, count: 1, first: index });
  });
  const parts = [...groups.values()]
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.count - a.count || a.first - b.first,
    )
    .map((g) => {
      const noun = KIND_NOUN[g.kind][g.count === 1 ? 0 : 1];
      return [String(g.count), g.prefix, noun, g.suffix].filter(Boolean).join(' ');
    });
  return `${planeCountText(planes.length)} — ${parts.join(', ')}`;
}

/** Everyone credited on the Walk, in order: "Davey", "Davey and Rosie", "Davey, Rosie and Sam"; "You" if no name. */
function spotterNames(sightings: StoredSighting[]): string {
  const names = [...new Set(sightings.map((s) => s.spotter.trim()).filter(Boolean))];
  if (names.length === 0) return 'You';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** e.g. "Davey spotted 4 planes this morning". */
export function walkCredit(sightings: StoredSighting[], when: string): string {
  return `${spotterNames(sightings)} spotted ${planeCountText(distinctPlanes(sightings).length)} ${when}`;
}
