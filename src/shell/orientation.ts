/**
 * Where the phone is pointing: compass heading and elevation angle of the back camera.
 * Thin sensor adapter, verified by hand on an iPhone (not unit-tested).
 *
 * Pose: phone held upright in portrait, screen facing the parent, back camera aimed at the plane.
 */

export type MotionPermission = 'granted' | 'denied' | 'unsupported';

export interface Pointing {
  /** Degrees true, 0 = north, clockwise. */
  heading: number;
  /** Degrees above the horizon, 0–90. */
  elevation: number;
}

/** Magnetic declination around New York City (≈13° west): true = magnetic − 13. */
const NYC_DECLINATION_DEG = -13;
/** Readings older than this are not used at tap time. */
const MAX_READING_AGE_MS = 1000;
/** Readings averaged at tap time, to steady a shaky hand. */
const READINGS_AVERAGED = 5;

interface Reading extends Pointing {
  at: number;
}

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const readings: Reading[] = [];
let listening = false;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Asks for motion/compass access. On iPhone this must be called directly from a tap,
 * before any other `await` in the handler. Safe to call on every tap: once granted it
 * resolves straight away without prompting.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
  if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
  const ctor = DeviceOrientationEvent as OrientationEventCtor;
  let result: MotionPermission = 'granted';
  if (typeof ctor.requestPermission === 'function') {
    try {
      result = await ctor.requestPermission();
    } catch {
      result = 'denied';
    }
  }
  if (result === 'granted') startListening();
  return result;
}

function startListening(): void {
  if (listening) return;
  listening = true;
  // iOS gives webkitCompassHeading on `deviceorientation`; other browsers give an
  // earth-referenced alpha on `deviceorientationabsolute`.
  const absoluteEvent = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(absoluteEvent, onOrientation as EventListener);
  if (absoluteEvent !== 'deviceorientation') window.addEventListener('deviceorientation', onOrientation as EventListener);
}

function onOrientation(event: IOSOrientationEvent): void {
  const { alpha, beta, gamma } = event;
  if (beta === null || gamma === null) return;

  // Elevation of the back-camera axis: β − 90 when the phone isn't rolled, roll-robust form below.
  const up = -Math.cos(toRad(beta)) * Math.cos(toRad(gamma));
  const elevation = Math.min(90, Math.max(0, toDeg(Math.asin(up))));

  let heading: number | undefined;
  if (typeof event.webkitCompassHeading === 'number' && event.webkitCompassHeading >= 0) {
    heading = event.webkitCompassHeading + NYC_DECLINATION_DEG;
  } else if (event.absolute && alpha !== null) {
    // Back-camera direction in East/North from the W3C rotation (Z·X·Y).
    const [a, b, g] = [toRad(alpha), toRad(beta), toRad(gamma)];
    const east = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
    const north = Math.cos(a) * Math.sin(b) * Math.cos(g) - Math.sin(a) * Math.sin(g);
    heading = toDeg(Math.atan2(east, north)) + NYC_DECLINATION_DEG;
  }
  if (heading === undefined) return;

  readings.push({ heading: (heading + 360) % 360, elevation, at: performance.now() });
  if (readings.length > READINGS_AVERAGED) readings.shift();
}

/** Where the phone points right now (averaged over the last few readings), or undefined if the compass is silent. */
export function readPointing(): Pointing | undefined {
  const now = performance.now();
  const fresh = readings.filter((r) => now - r.at <= MAX_READING_AGE_MS);
  if (fresh.length === 0) return undefined;

  // Circular mean for the heading so 359° and 1° average to 0°, not 180°.
  const x = fresh.reduce((s, r) => s + Math.cos(toRad(r.heading)), 0);
  const y = fresh.reduce((s, r) => s + Math.sin(toRad(r.heading)), 0);
  const heading = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const elevation = fresh.reduce((s, r) => s + r.elevation, 0) / fresh.length;
  return { heading, elevation };
}

/** Waits briefly for the first compass reading after permission is granted. */
export async function waitForPointing(timeoutMs = 1500): Promise<Pointing | undefined> {
  const start = performance.now();
  for (;;) {
    const pointing = readPointing();
    if (pointing || performance.now() - start > timeoutMs) return pointing;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
