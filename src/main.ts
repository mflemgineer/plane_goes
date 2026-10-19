/**
 * UI shell: wires the Spot button to location → proxy → Sighting Engine.
 * Flight data is fetched only on a tap, never in the background.
 */
import { spot } from './engine';
import { fetchNearbyAircraft } from './shell/aircraftApi';
import { readLocationOnce, type LocationError } from './shell/location';

const kidLine = document.querySelector<HTMLParagraphElement>('#kid-line')!;
const details = document.querySelector<HTMLParagraphElement>('#details')!;
const button = document.querySelector<HTMLButtonElement>('#spot')!;

const locationMessages: Record<LocationError, string> = {
  denied: 'Turn on Location for this site in Settings so we can find planes.',
  unavailable: "We couldn't tell where we are. Try again in a moment.",
  timeout: "Finding where we are took too long. Try again!",
  unsupported: "This browser can't share location.",
};

function show(line: string, detail = ''): void {
  kidLine.textContent = line;
  details.textContent = detail;
}

async function onSpot(): Promise<void> {
  button.disabled = true;
  show('Looking… 👀');
  try {
    let position;
    try {
      position = await readLocationOnce();
    } catch (reason) {
      show('Where are we? 🗺️', locationMessages[reason as LocationError] ?? locationMessages.unavailable);
      return;
    }

    const outcome = await fetchNearbyAircraft(position);
    if (!outcome.ok) {
      const detail =
        outcome.reason === 'busy'
          ? 'The plane finder is busy. Try again in a few seconds.'
          : outcome.reason === 'offline'
            ? 'No signal right now. Try again soon.'
            : 'The plane finder had a hiccup. Try again.';
      show('Planes are hiding! ☁️', detail);
      return;
    }

    const result = spot({ ...position, time: Date.now() }, outcome.snapshot);
    if (result.kind === 'matched') {
      show(`${result.flight.callsign} ✈️`, `${result.flight.distanceNm.toFixed(1)} nm away`);
    } else {
      show('Looks like Amelia Earhart is flying that one! We could not find it.');
    }
  } finally {
    button.disabled = false;
  }
}

button.addEventListener('click', () => void onSpot());
