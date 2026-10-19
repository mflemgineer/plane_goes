/** Kid Lines: one big, playful line per Verdict, with classic airport names and big emoji. */
import type { Verdict } from './verdict';

export function kidLineFor(verdict: Verdict): string {
  switch (verdict.kind) {
    case 'arrival':
      return `Coming down to ${verdict.airport.name}! Bye-bye, sky! 🛬`;
    case 'unknown':
      return 'A plane! Way up in the sky! ✈️';
  }
}
