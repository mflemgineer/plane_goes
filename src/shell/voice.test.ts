import { describe, expect, it } from 'vitest';
import { muteSetting, pickVoice, speakableText } from './voice';

describe('speakableText', () => {
  it('drops emoji so they are not read out', () => {
    expect(speakableText('Coming down to JFK! Bye-bye, sky! 🛬')).toBe('Coming down to JFK! Bye-bye, sky!');
  });

  it('drops joined and flag emoji in the middle of a line', () => {
    expect(speakableText('👨‍✈️ Flying far, far away to London 🇬🇧! 🌍')).toBe('Flying far, far away to London !');
  });
});

const voice = (name: string, lang: string) => ({ name, lang });

describe('pickVoice', () => {
  it('prefers Samantha, the iPhone US female voice', () => {
    const voices = [voice('Daniel', 'en-GB'), voice('Karen', 'en-AU'), voice('Samantha', 'en-US'), voice('Fred', 'en-US')];
    expect(pickVoice(voices)?.name).toBe('Samantha');
  });

  it('falls back to another female English voice', () => {
    const voices = [voice('Thomas', 'fr-FR'), voice('Daniel', 'en-GB'), voice('Moira', 'en-IE'), voice('Amélie', 'fr-CA')];
    expect(pickVoice(voices)?.name).toBe('Moira');
  });

  it('prefers an American female voice over other English ones', () => {
    const voices = [voice('Karen', 'en-AU'), voice('Google US English Female', 'en_US'), voice('Tessa', 'en-ZA')];
    expect(pickVoice(voices)?.name).toBe('Google US English Female');
  });

  it('settles for any English voice when no female one is known', () => {
    const voices = [voice('Thomas', 'fr-FR'), voice('Daniel', 'en-GB')];
    expect(pickVoice(voices)?.name).toBe('Daniel');
  });

  it('picks nothing when there is no English voice', () => {
    expect(pickVoice([voice('Thomas', 'fr-FR')])).toBeUndefined();
    expect(pickVoice([])).toBeUndefined();
  });
});

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe('muteSetting', () => {
  it('starts muted on a fresh install', () => {
    expect(muteSetting(memoryStorage()).isMuted()).toBe(true);
  });

  it('remembers an unmute after the app is reopened', () => {
    const storage = memoryStorage();
    muteSetting(storage).setMuted(false);
    expect(muteSetting(storage).isMuted()).toBe(false);
  });

  it('remembers muting again', () => {
    const storage = memoryStorage();
    muteSetting(storage).setMuted(false);
    muteSetting(storage).setMuted(true);
    expect(muteSetting(storage).isMuted()).toBe(true);
  });

  it('stays muted, without crashing, when storage is blocked', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
      setItem: (): void => {
        throw new Error('QuotaExceededError');
      },
    };
    const setting = muteSetting(blocked);
    expect(setting.isMuted()).toBe(true);
    setting.setMuted(false);
    expect(setting.isMuted()).toBe(false);
  });
});
