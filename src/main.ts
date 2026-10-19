/**
 * UI shell: wires the Spot button to location → proxy → Sighting Engine.
 * Flight data is fetched only on a tap, never in the background.
 */
import { spot } from './engine';
import { fetchNearbyAircraft } from './shell/aircraftApi';
import { readLocationOnce } from './shell/location';
import { setUpAbout } from './ui/about';
import { friendlyMessage } from './ui/friendlyMessage';

const kidLine = document.querySelector<HTMLParagraphElement>('#kid-line')!;
const details = document.querySelector<HTMLParagraphElement>('#details')!;
const button = document.querySelector<HTMLButtonElement>('#spot')!;

function show(line: string, detail = ''): void {
  kidLine.textContent = line;
  details.textContent = detail;
}

function showProblem(problem: unknown): void {
  const { kidLine: line, detail } = friendlyMessage(problem);
  show(line, detail);
}

async function onSpot(): Promise<void> {
  button.disabled = true;
  show('Looking… 👀');
  try {
    let position;
    try {
      position = await readLocationOnce();
    } catch (reason) {
      showProblem(reason);
      return;
    }

    const outcome = await fetchNearbyAircraft(position);
    if (!outcome.ok) {
      showProblem(outcome.reason);
      return;
    }

    const result = spot({ ...position, time: Date.now() }, outcome.snapshot);
    if (result.kind === 'matched') {
      show(`${result.flight.callsign} ✈️`, `${result.flight.distanceNm.toFixed(1)} nm away`);
    } else {
      show('Looks like Amelia Earhart is flying that one! We could not find it.');
    }
  } catch (reason) {
    // Never show a raw error to the Spotter.
    console.error(reason);
    showProblem(reason);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener('click', () => void onSpot());

setUpAbout();
