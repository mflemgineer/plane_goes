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

export function walkName(start: number, now: number): string {
  const startDate = new Date(start);
  const nowDate = new Date(now);
  const part = partOfDay(startDate.getHours());
  // Small hours belong to the night before.
  const dayOf = part === 'night' && startDate.getHours() < 5 ? new Date(start - 6 * 3_600_000) : startDate;
  const daysAgo = daysBetween(dayOf, nowDate);

  if (daysAgo === 0) return part === 'night' ? "Tonight's walk" : `This ${part}'s walk`;
  if (daysAgo === 1) return part === 'night' ? "Last night's walk" : `Yesterday ${part}'s walk`;

  const sameYear = startDate.getFullYear() === nowDate.getFullYear();
  return startDate.toLocaleDateString(
    'en-US',
    sameYear ? { weekday: 'long', month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' },
  );
}
