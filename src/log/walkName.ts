/** Names a Walk by when it started, relative to now, in the phone's local time. */

type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between two dates (DST-safe). */
function daysBetween(earlier: Date, later: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / 86_400_000);
}

interface WalkWhen {
  /** e.g. "This morning's walk", or a date. */
  name: string;
  /** e.g. "this morning", "last night", "on Wednesday, October 14". */
  phrase: string;
}

function walkWhen(start: number, now: number): WalkWhen {
  const startDate = new Date(start);
  const nowDate = new Date(now);
  const part = partOfDay(startDate.getHours());
  // Small hours belong to the night before.
  const dayOf = part === 'night' && startDate.getHours() < 5 ? new Date(start - 6 * 3_600_000) : startDate;
  const daysAgo = daysBetween(dayOf, nowDate);

  if (daysAgo === 0) {
    return part === 'night'
      ? { name: "Tonight's walk", phrase: 'tonight' }
      : { name: `This ${part}'s walk`, phrase: `this ${part}` };
  }
  if (daysAgo === 1) {
    return part === 'night'
      ? { name: "Last night's walk", phrase: 'last night' }
      : { name: `Yesterday ${part}'s walk`, phrase: `yesterday ${part}` };
  }

  // Dated by the same day it is counted from, so a 2 a.m. Walk reads as the night before.
  const sameYear = dayOf.getFullYear() === nowDate.getFullYear();
  const date = dayOf.toLocaleDateString(
    'en-US',
    sameYear ? { weekday: 'long', month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' },
  );
  return { name: date, phrase: `on ${date}` };
}

export function walkName(start: number, now: number): string {
  return walkWhen(start, now).name;
}

/** When the Walk happened, to finish "Davey spotted 4 planes …". */
export function walkPhrase(start: number, now: number): string {
  return walkWhen(start, now).phrase;
}
