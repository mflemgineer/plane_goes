/**
 * UI shell: wires the Spot button to location + compass → proxy → Sighting Engine.
 * Flight data is fetched only on a tap, never in the background.
 */
import { spot } from './engine';
import { fetchNearbyAircraft } from './shell/aircraftApi';
import { readLocationOnce, type LocationError } from './shell/location';
import { requestMotionPermission, waitForPointing, type MotionPermission } from './shell/orientation';
import { createVoice } from './shell/voice';

const kidLine = document.querySelector<HTMLParagraphElement>('#kid-line')!;
const details = document.querySelector<HTMLParagraphElement>('#details')!;
const button = document.querySelector<HTMLButtonElement>('#spot')!;
const app = document.querySelector<HTMLElement>('#app')!;
const permissions = document.querySelector<HTMLElement>('#permissions')!;
const permissionsHelp = document.querySelector<HTMLParagraphElement>('#permissions-help')!;
const allowButton = document.querySelector<HTMLButtonElement>('#allow')!;

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
  voice.unlock(); // iPhone: speech must be unlocked from the tap itself, before any await.
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
      show(`${result.flight.callsign} ✈️`, `${result.flight.distanceNm.toFixed(1)} nm away`);
    } else {
      show(result.kidLine);
    }
    voice.speak(kidLine.textContent ?? '');
  } finally {
    button.disabled = false;
  }
}

// Voice: muted by default; the sound toggle and replay sit on the result screen.
const voice = createVoice();
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
const replayButton = document.querySelector<HTMLButtonElement>('#replay')!;

function renderVoiceControls(): void {
  const on = !voice.isMuted();
  soundButton.textContent = on ? '🔊 Sound on' : '🔇 Sound off';
  soundButton.setAttribute('aria-pressed', String(on));
  replayButton.hidden = !on;
}

soundButton.addEventListener('click', () => {
  voice.setMuted(!voice.isMuted());
  renderVoiceControls();
  voice.speak(kidLine.textContent ?? ''); // Speaking from this tap also unlocks iPhone speech.
});
replayButton.addEventListener('click', () => voice.speak(kidLine.textContent ?? ''));
renderVoiceControls();

allowButton.addEventListener('click', () => void onAllow());
button.addEventListener('click', () => void onSpot());
showScreen(readSetupDone() ? 'spot' : 'permissions');
