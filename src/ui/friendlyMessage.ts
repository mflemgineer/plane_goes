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
/** Compass/motion problems, prefixed so they don't clash with location's `denied`/`unsupported`. */
export type CompassProblem = 'motion-denied' | 'motion-unsupported' | 'compass-silent';
export type Problem = LocationError | AircraftProblem | CompassProblem;

const WHERE_ARE_WE = 'Where are we? 🗺️';
const HIDING = 'Planes are hiding! ☁️';
const WHICH_WAY = 'Which way is up? 🧭';

const messages: Record<Problem, FriendlyMessage> = {
  denied: {
    kidLine: WHERE_ARE_WE,
    detail:
      'Location is turned off for this app. On iPhone: Settings › Privacy & Security › Location Services › Safari Websites › While Using the App. Then try again.',
  },
  unavailable: { kidLine: WHERE_ARE_WE, detail: "We couldn't tell where we are. Try again in a moment." },
  timeout: { kidLine: WHERE_ARE_WE, detail: 'Finding where we are took too long. Try again!' },
  unsupported: { kidLine: WHERE_ARE_WE, detail: "This browser can't share location. Try opening the app in Safari." },
  busy: { kidLine: HIDING, detail: 'The plane finder is busy. Try again in a few seconds.' },
  offline: { kidLine: HIDING, detail: 'No signal right now. Try again when we have bars.' },
  error: { kidLine: HIDING, detail: 'The plane finder needs a little rest. Try again soon.' },
  'motion-denied': {
    kidLine: WHICH_WAY,
    detail:
      "The compass is turned off, so we can't tell which plane you're pointing at. Close the app completely, open it again, and tap Allow when your iPhone asks about Motion & Orientation.",
  },
  'motion-unsupported': {
    kidLine: WHICH_WAY,
    detail: "This phone can't share its compass, so we can't tell which plane you're pointing at.",
  },
  'compass-silent': {
    kidLine: WHICH_WAY,
    detail:
      "The compass isn't answering. Hold the phone up toward the plane and try again. If it keeps happening, wave the phone in a figure-eight to wake the compass.",
  },
};

/** Accepts anything (including a thrown value) so every catch can use it. */
export function friendlyMessage(problem: unknown): FriendlyMessage {
  if (typeof problem === 'string' && Object.hasOwn(messages, problem)) {
    return messages[problem as Problem];
  }
  return { kidLine: 'Oops, the clouds got in the way! ☁️', detail: 'Let’s try again in a moment.' };
}
