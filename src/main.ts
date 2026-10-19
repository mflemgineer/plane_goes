/**
 * UI shell: wires the Spot button to location + compass → proxy → Sighting Engine.
 * Flight data is fetched only on a tap, never in the background.
 */
import { spot } from './engine';
import { fetchNearbyAircraft } from './shell/aircraftApi';
import { readLocationOnce } from './shell/location';
import { requestMotionPermission, waitForPointing, type MotionPermission } from './shell/orientation';
import { setUpAbout } from './ui/about';
import { friendlyMessage, type CompassProblem } from './ui/friendlyMessage';
import { renderGrownUpDetails } from './ui/grownUpDetails';

const kidLine = document.querySelector<HTMLParagraphElement>('#kid-line')!;
const details = document.querySelector<HTMLParagraphElement>('#details')!;
const button = document.querySelector<HTMLButtonElement>('#spot')!;
const app = document.querySelector<HTMLElement>('#app')!;
const permissions = document.querySelector<HTMLElement>('#permissions')!;
const permissionsHelp = document.querySelector<HTMLParagraphElement>('#permissions-help')!;
const allowButton = document.querySelector<HTMLButtonElement>('#allow')!;

const SETUP_DONE_KEY = 'plane-goes:permissions-asked';

const motionProblems: Record<Exclude<MotionPermission, 'granted'>, CompassProblem> = {
  denied: 'motion-denied',
  unsupported: 'motion-unsupported',
};

function show(line: string, detail = ''): void {
  kidLine.textContent = line;
  details.textContent = detail;
}

function readSetupDone(): boolean {
  try {
    return localStorage.getItem(SETUP_DONE_KEY) === 'yes';
  } catch {
    return false;
  }
}

function rememberSetupDone(): void {
  try {
    localStorage.setItem(SETUP_DONE_KEY, 'yes');
  } catch {
    // Private mode: we'll just ask again next time.
  }
}

function showScreen(screen: 'permissions' | 'spot'): void {
  permissions.hidden = screen !== 'permissions';
  app.hidden = screen !== 'spot';
}

/** First-run screen: asks for motion/compass (must be first, straight from the tap) and then location. */
async function onAllow(): Promise<void> {
  allowButton.disabled = true;
  try {
    const motion = await requestMotionPermission();
    if (motion !== 'granted') {
      permissionsHelp.textContent = friendlyMessage(motionProblems[motion]).detail;
      return;
    }
    try {
      await readLocationOnce();
    } catch (reason) {
      permissionsHelp.textContent = friendlyMessage(reason).detail;
      return;
    }
    rememberSetupDone();
    showScreen('spot');
  } finally {
    allowButton.disabled = false;
  }
}

function showProblem(problem: unknown): void {
  const { kidLine: line, detail } = friendlyMessage(problem);
  show(line, detail);
}

async function onSpot(): Promise<void> {
  button.disabled = true;
  try {
    // iPhone needs the motion request to come straight from the tap, before anything else is awaited.
    const motion = await requestMotionPermission();
    show('Looking… 👀');
    if (motion !== 'granted') {
      showProblem(motionProblems[motion]);
      return;
    }

    let position;
    try {
      position = await readLocationOnce();
    } catch (reason) {
      showProblem(reason);
      return;
    }

    // Capture where the phone points as close to the tap as we can.
    const pointing = await waitForPointing();
    const time = Date.now();
    if (!pointing) {
      showProblem('compass-silent');
      return;
    }

    const outcome = await fetchNearbyAircraft(position);
    if (!outcome.ok) {
      showProblem(outcome.reason);
      return;
    }

    const result = spot({ ...position, ...pointing, time }, outcome.snapshot);
    show(result.kidLine);
    if (result.kind === 'matched') renderGrownUpDetails(details, result.details);
  } catch (reason) {
    // Never show a raw error to the Spotter.
    console.error(reason);
    showProblem(reason);
  } finally {
    button.disabled = false;
  }
}

allowButton.addEventListener('click', () => void onAllow());
button.addEventListener('click', () => void onSpot());
showScreen(readSetupDone() ? 'spot' : 'permissions');
setUpAbout();
