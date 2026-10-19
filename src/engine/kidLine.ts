/** Kid Lines: one big, playful line per Verdict, with classic airport names and big emoji. */
import type { RouteAirport } from './route';
import type { Verdict } from './verdict';

/** Kid Line for a Mystery Plane: no Flight could be matched. */
export const MYSTERY_PLANE_KID_LINE = 'Looks like Amelia Earhart is flying that one! We could not find it.';

const from = (end?: RouteAirport) => (end ? ` from ${end.city}` : '');
const to = (end?: RouteAirport) => (end ? ` to ${end.city}` : '');

export function kidLineFor(verdict: Verdict): string {
  switch (verdict.kind) {
    case 'arrival':
      return `Coming down to ${verdict.airport.name}${from(verdict.origin)}! Bye-bye, sky! 🛬`;
    case 'departure':
      return `Going up from ${verdict.airport.name}${to(verdict.destination)}! Up, up, up! 🛫`;
    case 'overflight':
      return `Flying far, far away${from(verdict.origin)}${to(verdict.destination)}! 🌍`;
    case 'helicopter':
      return 'A helicopter! Whirr whirr! 🚁';
    case 'small-plane':
      return 'A little plane! Putt-putt-putt! 🛩️';
    case 'unknown':
      return 'A plane! Way up in the sky! ✈️';
  }
}
