/**
 * UI shell: wires the Spot button to location + compass → proxy → Sighting Engine.
 * Flight data is fetched only on a tap, never in the background.
 */
import { spot } from './engine';
import { fetchNearbyAircraft } from './shell/aircraftApi';
import { readLocationOnce, type LocationError } from './shell/location';
import { requestMotionPermission, waitForPointing, type MotionPermission } from './shell/orientation';
import { matchedSighting, sightingLog } from './shell/sightingLog';
import { renderWalks } from './ui/logScreen';

const kidLine = document.querySelector<HTMLParagraphElement>('#kid-line')!;
const details = document.querySelector<HTMLParagraphElement>('#details')!;
const button = document.querySelector<HTMLButtonElement>('#spot')!;
const app = document.querySelector<HTMLElement>('#app')!;
const permissions = document.querySelector<HTMLElement>('#permissions')!;
const permissionsHelp = document.querySelector<HTMLParagraphElement>('#permissions-help')!;
const allowButton = document.querySelector<HTMLButtonElement>('#allow')!;
const spotterScreen = document.querySelector<HTMLElement>('#spotter')!;
const spotterForm = document.querySelector<HTMLFormElement>('#spotter-form')!;
const spotterInput = document.querySelector<HTMLInputElement>('#spotter-name')!;
const spotterCancel = document.querySelector<HTMLButtonElement>('#spotter-cancel')!;
const logScreen = document.querySelector<HTMLElement>('#log')!;
const walksList = document.querySelector<HTMLUListElement>('#walks')!;

const SETUP_DONE_KEY = 'plane-goes:permissions-asked';

const locationMessages: Record<LocationError, string> = {
  denied:
    'Location is turned off for this app. On iPhone: Settings › Privacy & Security › Location Services › Safari Websites › While Using the App. Then try again.',
  unavailable: "We couldn't tell where we are. Try again in a moment.",
  timeout: "Finding where we are took too long. Try again!",
  unsupported: "This browser can't share location.",
};

const motionMessages: Record<Exclude<MotionPermission, 'granted'>, string> = {
  denied:
    "The compass is turned off, so we can't tell which plane you're pointing at. Close the app completely, open it again, and tap Allow when your iPhone asks about Motion & Orientation.",
  unsupported: "This phone can't share its compass, so we can't tell which plane you're pointing at.",
};

const silentCompassMessage =
  "The compass isn't answering. Hold the phone up toward the plane and try again. If it keeps happening, wave the phone in a figure-eight to wake the compass.";

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

type Screen = 'permissions' | 'spot' | 'spotter' | 'log';

function showScreen(screen: Screen): void {
  permissions.hidden = screen !== 'permissions';
  app.hidden = screen !== 'spot';
  spotterScreen.hidden = screen !== 'spotter';
  logScreen.hidden = screen !== 'log';
}

/** First-run screen: asks for motion/compass (must be first, straight from the tap) and then location. */
async function onAllow(): Promise<void> {
  allowButton.disabled = true;
  try {
    const motion = await requestMotionPermission();
    if (motion !== 'granted') {
      permissionsHelp.textContent = motionMessages[motion];
      return;
    }
    try {
      await readLocationOnce();
    } catch (reason) {
      permissionsHelp.textContent = locationMessages[reason as LocationError] ?? locationMessages.unavailable;
      return;
    }
    rememberSetupDone();
    showScreen('spot');
  } finally {
    allowButton.disabled = false;
  }
}

async function onSpot(): Promise<void> {
  button.disabled = true;
  try {
    // iPhone needs the motion request to come straight from the tap, before anything else is awaited.
    const motion = await requestMotionPermission();
    show('Looking… 👀');
    if (motion !== 'granted') {
      show('Which way is up? 🧭', motionMessages[motion]);
      return;
    }

    let position;
    try {
      position = await readLocationOnce();
    } catch (reason) {
      show('Where are we? 🗺️', locationMessages[reason as LocationError] ?? locationMessages.unavailable);
      return;
    }

    // Capture where the phone points as close to the tap as we can.
    const pointing = await waitForPointing();
    const time = Date.now();
    if (!pointing) {
      show('Which way is up? 🧭', silentCompassMessage);
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

    const result = spot({ ...position, ...pointing, time }, outcome.snapshot);
    if (result.kind === 'matched') {
      const line = `${result.flight.callsign} ✈️`;
      show(line, `${result.flight.distanceNm.toFixed(1)} nm away`);
      saveSighting(() => sightingLog.addSighting(matchedSighting({ flight: result.flight, kidLine: line, snapshot: outcome.snapshot })));
    } else {
      show(result.kidLine);
      saveSighting(() => sightingLog.addSighting({ verdict: { kind: 'mystery' }, kidLine: result.kidLine }));
    }
  } finally {
    button.disabled = false;
  }
}

/** Every Sighting is saved without an extra tap. A storage failure must never spoil the Verdict. */
function saveSighting(save: () => unknown): void {
  try {
    save();
  } catch {
    // Storage full or blocked: the Sighting just isn't kept.
  }
}

/**
 * Call when the parent closes an Ambiguous "not that one?" list without choosing:
 * the Sighting still counts, as a Mystery Plane.
 */
export function onAmbiguousDismissed(): void {
  saveSighting(() => sightingLog.addDismissedAmbiguous());
}

/** The screen to show once the Spotter has a name. */
function homeScreen(): Screen {
  return readSetupDone() ? 'spot' : 'permissions';
}

/** First launch asks for the Spotter's name; the ⚙️ button on the Log screen changes it later. */
function openSpotterPrompt(changing: boolean): void {
  spotterInput.value = sightingLog.getSpotterName() ?? '';
  spotterCancel.hidden = !changing;
  showScreen('spotter');
  spotterInput.focus();
}

function onSpotterSaved(event: SubmitEvent): void {
  event.preventDefault();
  const name = spotterInput.value.trim();
  if (!name) return;
  const changing = sightingLog.getSpotterName() !== null;
  try {
    sightingLog.setSpotterName(name);
  } catch {
    // Storage blocked: keep going; we'll ask again next launch.
  }
  if (changing) openLog();
  else showScreen(homeScreen());
}

function openLog(): void {
  let walks: ReturnType<typeof sightingLog.listWalks> = [];
  try {
    walks = sightingLog.listWalks();
  } catch {
    // Unreadable storage: show an empty log.
  }
  renderWalks(walksList, walks, sightingLog.getSpotterName());
  showScreen('log');
}

allowButton.addEventListener('click', () => void onAllow());
button.addEventListener('click', () => void onSpot());
spotterForm.addEventListener('submit', onSpotterSaved);
spotterCancel.addEventListener('click', openLog);
document.querySelector('#open-log')!.addEventListener('click', openLog);
document.querySelector('#log-back')!.addEventListener('click', () => showScreen('spot'));
document.querySelector('#settings')!.addEventListener('click', () => openSpotterPrompt(true));

if (sightingLog.getSpotterName() === null) openSpotterPrompt(false);
else showScreen(homeScreen());
