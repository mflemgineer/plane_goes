/**
 * Turns anything that goes wrong during a Sighting into a gentle, toddler-safe
 * message. The UI shows only these, never raw error text.
 */
import type { FetchAircraftOutcome } from '../shell/aircraftApi';
import type { LocationError } from '../shell/location';

export interface FriendlyMessage {
  /** Big line Davey sees. */
  kidLine: string;
  /** Smaller hint for the parent. */
  detail: string;
}

type AircraftProblem = Extract<FetchAircraftOutcome, { ok: false }>['reason'];
export type Problem = LocationError | AircraftProblem;

const WHERE_ARE_WE = 'Where are we? 🗺️';
const HIDING = 'Planes are hiding! ☁️';

const messages: Record<Problem, FriendlyMessage> = {
  denied: { kidLine: WHERE_ARE_WE, detail: 'Turn on Location for this site in Settings so we can find planes.' },
  unavailable: { kidLine: WHERE_ARE_WE, detail: "We couldn't tell where we are. Try again in a moment." },
  timeout: { kidLine: WHERE_ARE_WE, detail: 'Finding where we are took too long. Try again!' },
  unsupported: { kidLine: WHERE_ARE_WE, detail: "This browser can't share location. Try opening the app in Safari." },
  busy: { kidLine: HIDING, detail: 'The plane finder is busy. Try again in a few seconds.' },
  offline: { kidLine: HIDING, detail: 'No signal right now. Try again when we have bars.' },
  error: { kidLine: HIDING, detail: 'The plane finder needs a little rest. Try again soon.' },
};

/** Accepts anything (including a thrown value) so every catch can use it. */
export function friendlyMessage(problem: unknown): FriendlyMessage {
  if (typeof problem === 'string' && Object.hasOwn(messages, problem)) {
    return messages[problem as Problem];
  }
  return { kidLine: 'Oops, the clouds got in the way! ☁️', detail: 'Let’s try again in a moment.' };
}
