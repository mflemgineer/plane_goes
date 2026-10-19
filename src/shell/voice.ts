/**
 * Voice: reads the Kid Line aloud with the browser's built-in speech.
 * Muted by default; the choice is remembered on the device.
 */

/** The bits of Web Storage the mute setting needs (localStorage in the app, a fake in tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MUTE_KEY = 'plane-goes:voice-unmuted';

/** Muted unless the parent has unmuted. Storage failures (private mode) leave it muted, never crash. */
export function muteSetting(storage: KeyValueStorage | undefined) {
  let muted = true;
  try {
    muted = storage?.getItem(MUTE_KEY) !== 'yes';
  } catch {
    // Blocked storage: stay muted.
  }
  return {
    isMuted: (): boolean => muted,
    setMuted(next: boolean): void {
      muted = next;
      try {
        storage?.setItem(MUTE_KEY, next ? 'no' : 'yes');
      } catch {
        // Blocked storage: remembered for this visit only.
      }
    },
  };
}

/** The two fields of a SpeechSynthesisVoice we choose by. */
export interface VoiceInfo {
  name: string;
  lang: string;
}

// Browsers expose no gender, so go by well-known female voice names (iOS, macOS, Windows, Google).
const FEMALE_NAMES = /samantha|karen|moira|tessa|serena|ava|allison|susan|zoe|victoria|kate|fiona|veena|nicky|zira|aria|jenny|female/i;

function voiceScore(v: VoiceInfo): number {
  const lang = v.lang.replace('_', '-').toLowerCase();
  if (!lang.startsWith('en')) return 0;
  const american = lang === 'en-us';
  const female = FEMALE_NAMES.test(v.name);
  if (female && /samantha/i.test(v.name) && american) return 5;
  if (female && american) return 4;
  if (female) return 3;
  if (american) return 2;
  return 1;
}

/** The best voice for the Kid Line: a female English voice where available, else any English voice. */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[]): V | undefined {
  let best: V | undefined;
  let bestScore = 0;
  for (const v of voices) {
    const score = voiceScore(v);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/** Kid Line text with emoji removed, so speech doesn't read "airplane arriving" aloud. */
export function speakableText(line: string): string {
  return line
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Voice {
  isMuted(): boolean;
  /** Call from a tap: unmuting there also unlocks speech on iPhone. */
  setMuted(muted: boolean): void;
  /** Call synchronously at the start of every tap handler, before any await. */
  unlock(): void;
  /** Speak a Kid Line, unless muted. Interrupts whatever is being said. */
  speak(line: string): void;
}

function safeLocalStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Browser speech. iPhone only lets a page speak after a speak() made inside a user gesture,
 * and the Kid Line arrives after awaits (location, network), so every tap calls unlock(),
 * which speaks a silent utterance once. getVoices() can be empty until 'voiceschanged'
 * (and iOS may never fire it), so the voice is looked up again on each speak.
 */
export function createVoice(storage: KeyValueStorage | undefined = safeLocalStorage()): Voice {
  const setting = muteSetting(storage);
  const synth: SpeechSynthesis | undefined = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;
  let unlocked = false;
  let voice: SpeechSynthesisVoice | undefined;

  const findVoice = (): SpeechSynthesisVoice | undefined => (voice ??= pickVoice(synth?.getVoices() ?? []));
  synth?.addEventListener?.('voiceschanged', () => {
    voice = undefined;
    findVoice();
  });
  findVoice();

  function say(text: string, volume = 1): void {
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const chosen = findVoice();
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = volume;
    synth.cancel();
    synth.speak(utterance);
  }

  return {
    isMuted: setting.isMuted,
    setMuted(muted) {
      setting.setMuted(muted);
      if (muted) synth?.cancel();
      else unlocked = true; // The caller speaks right away from this tap, which unlocks iPhone speech.
    },
    unlock() {
      if (unlocked || setting.isMuted() || !synth) return;
      unlocked = true;
      say(' ', 0);
    },
    speak(line) {
      if (setting.isMuted()) return;
      const text = speakableText(line);
      if (text) say(text);
    },
  };
}
