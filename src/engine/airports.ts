/**
 * The airports the Verdict knows about. Edit this list to add or tune airports.
 * Coordinates are the airport reference points (degrees).
 */

export interface Airport {
  /** IATA code, e.g. "JFK". */
  code: string;
  /** Classic name the family says out loud, used in the Kid Line. */
  name: string;
  lat: number;
  lon: number;
  /** Home Airports are judged from motion alone; Other Nearby Airports also need a matching route (later ticket). */
  group: 'home' | 'other-nearby';
}

export const AIRPORTS: readonly Airport[] = [
  { code: 'LGA', name: 'LaGuardia', lat: 40.7772, lon: -73.8726, group: 'home' },
  { code: 'EWR', name: 'Newark', lat: 40.6925, lon: -74.1686, group: 'home' },
  { code: 'JFK', name: 'JFK', lat: 40.6397, lon: -73.7789, group: 'home' },
  { code: 'HPN', name: 'Westchester', lat: 41.067, lon: -73.7076, group: 'other-nearby' },
  { code: 'TEB', name: 'Teterboro', lat: 40.8501, lon: -74.0608, group: 'other-nearby' },
  { code: 'ISP', name: 'MacArthur', lat: 40.7952, lon: -73.1002, group: 'other-nearby' },
];

export const HOME_AIRPORTS: readonly Airport[] = AIRPORTS.filter((a) => a.group === 'home');
