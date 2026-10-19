/**
 * UI shell: wires the Spot button to location + compass → proxy → Sighting Engine.
 * Flight data is fetched only on a tap, never in the background.
 */
import {
  choose,
  nearbyPlanes,
  spot,
  type AircraftSnapshot,
  type Match,
  type Observation,
  type RouteLookup,
  type SightingResult,
} from './engine';
import { fetchNearbyAircraft } from './shell/aircraftApi';
import { readLocationOnce } from './shell/location';
import { createRouteClient, fetchRoutesForSighting } from './shell/routeApi';
import { requestMotionPermission, waitForPointing, type MotionPermission } from './shell/orientation';
import { matchedSighting, sightingLog } from './shell/sightingLog';
import { createLogScreen } from './ui/logScreen';
import { createVoice } from './shell/voice';
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
const spotterScreen = document.querySelector<HTMLElement>('#spotter')!;
const spotterForm = document.querySelector<HTMLFormElement>('#spotter-form')!;
const spotterInput = document.querySelector<HTMLInputElement>('#spotter-name')!;
const spotterCancel = document.querySelector<HTMLButtonElement>('#spotter-cancel')!;
const logScreen = document.querySelector<HTMLElement>('#log')!;
const logView = createLogScreen(sightingLog, {
  list: document.querySelector<HTMLUListElement>('#walks')!,
  clearButton: document.querySelector<HTMLButtonElement>('#clear-log')!,
  clearConfirm: document.querySelector<HTMLElement>('#clear-confirm')!,
  clearYes: document.querySelector<HTMLButtonElement>('#clear-yes')!,
  clearNo: document.querySelector<HTMLButtonElement>('#clear-no')!,
});
const pick = document.querySelector<HTMLElement>('#pick')!;
const pickTitle = document.querySelector<HTMLParagraphElement>('#pick-title')!;
const pickList = document.querySelector<HTMLUListElement>('#pick-list')!;
const allNearbyButton = document.querySelector<HTMLButtonElement>('#all-nearby')!;

/** The last Sighting's inputs, kept in memory only so the parent can open the all-nearby-planes list. */
let lastSighting: { observation: Observation; snapshot: AircraftSnapshot; routes: RouteLookup } | undefined;

const SETUP_DONE_KEY = 'plane-goes:permissions-asked';

const routeClient = createRouteClient({ storage: safeLocalStorage() });

function safeLocalStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

const motionProblems: Record<Exclude<MotionPermission, 'granted'>, CompassProblem> = {
  denied: 'motion-denied',
  unsupported: 'motion-unsupported',
};

function show(line: string, detail = ''): void {
  kidLine.textContent = line;
  details.textContent = detail;
  hidePicker();
}

function hidePicker(): void {
  pick.hidden = true;
  pickList.replaceChildren();
}

/** A list of planes to choose from; tapping one makes it the answer. */
function showPicker(title: string, candidates: Match[]): void {
  pickTitle.textContent = title;
  pickList.replaceChildren(
    ...candidates.map((candidate) => {
      const item = document.createElement('li');
      const choice = document.createElement('button');
      choice.type = 'button';
      // Each candidate shows its own Kid Line, plus the callsign so the parent can tell them apart.
      choice.textContent = `${candidate.kidLine} · ${candidate.flight.callsign}`;
      choice.addEventListener('click', () => onChosen(candidate));
      item.append(choice);
      return item;
    }),
  );
  pick.hidden = false;
}

function showResult(result: SightingResult): void {
  if (result.kind === 'matched') {
    show(result.kidLine);
    renderGrownUpDetails(details, result.details);
  } else if (result.kind === 'ambiguous') {
    show('Which plane? 🤔', 'A few planes are close to where you pointed.');
    showPicker('Not that one? Tap the right plane:', result.candidates);
  } else {
    show(result.kidLine);
  }
  voice.speak(kidLine.textContent ?? '');
}

function onChosen(candidate: Match): void {
  const result = choose(candidate);
  showResult(result);
  if (lastSighting) recordResult(result, lastSighting.snapshot, lastSighting.observation.time, true);
}

function showAllNearby(): void {
  if (!lastSighting) return;
  const planes = nearbyPlanes(lastSighting.observation, lastSighting.snapshot, lastSighting.routes);
  if (planes.length === 0) {
    showPicker('No planes nearby right now.', []);
    return;
  }
  showPicker('All nearby planes (closest to where you pointed first):', planes);
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
  voice.unlock(); // iPhone: speech must be unlocked from the tap itself, before any await.
  settleAmbiguous();
  savedSightingId = undefined;
  button.disabled = true;
  lastSighting = undefined;
  allNearbyButton.hidden = true;
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

    const observation: Observation = { ...position, ...pointing, time };
    const routes = await fetchRoutesForSighting(observation, outcome.snapshot, routeClient);
    lastSighting = { observation, snapshot: outcome.snapshot, routes };
    const result = spot(observation, outcome.snapshot, routes);
    showResult(result);
    recordResult(result, outcome.snapshot, time);
    allNearbyButton.hidden = false;
  } catch (reason) {
    // Never show a raw error to the Spotter.
    console.error(reason);
    showProblem(reason);
  } finally {
    button.disabled = false;
  }
}

/*
 * Sighting Log: every Sighting is saved without an extra tap. A storage failure must never spoil the Verdict.
 * An Ambiguous result waits for the parent to choose; if they move on without choosing
 * (spot again, open the Log, leave the app), it is saved as a Mystery Plane.
 */
let savedSightingId: string | undefined;
/** The Spot tap time of an Ambiguous result still waiting for the parent to choose. */
let ambiguousPendingAt: number | undefined;

function saveSighting(save: () => { id: string }): void {
  try {
    savedSightingId = save().id;
  } catch {
    // Storage full or blocked: the Sighting just isn't kept.
  }
}

/** Saves the result of a Spot tap, or of a plane chosen from a list (`chosen`). */
function recordResult(result: SightingResult, snapshot: AircraftSnapshot, tappedAt: number, chosen = false): void {
  if (result.kind === 'ambiguous') {
    ambiguousPendingAt = tappedAt;
    savedSightingId = undefined;
    return;
  }
  ambiguousPendingAt = undefined;
  const input =
    result.kind === 'matched'
      ? matchedSighting(result, snapshot)
      : { verdict: { kind: 'mystery' as const }, kidLine: result.kidLine };
  // Picking from the all-nearby list after a save corrects that Sighting rather than adding a second plane.
  const correcting = chosen ? savedSightingId : undefined;
  saveSighting(() => (correcting ? sightingLog.correctSighting(correcting, input) : sightingLog.addSighting(input)));
}

/** The parent moved on from an Ambiguous list without choosing: it still counts, as a Mystery Plane. */
function settleAmbiguous(): void {
  if (ambiguousPendingAt === undefined) return;
  const tappedAt = ambiguousPendingAt;
  ambiguousPendingAt = undefined;
  saveSighting(() => sightingLog.addDismissedAmbiguous(tappedAt));
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
  settleAmbiguous();
  logView.render();
  showScreen('log');
}

spotterForm.addEventListener('submit', onSpotterSaved);
spotterCancel.addEventListener('click', openLog);
document.querySelector('#open-log')!.addEventListener('click', openLog);
document.querySelector('#log-back')!.addEventListener('click', () => showScreen('spot'));
document.querySelector('#settings')!.addEventListener('click', () => openSpotterPrompt(true));

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
allNearbyButton.addEventListener('click', showAllNearby);
window.addEventListener('pagehide', settleAmbiguous);
setUpAbout();
if (sightingLog.getSpotterName() === null) openSpotterPrompt(false);
else showScreen(homeScreen());
