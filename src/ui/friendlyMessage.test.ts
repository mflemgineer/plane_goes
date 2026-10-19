import { describe, expect, it } from 'vitest';
import { friendlyMessage } from './friendlyMessage';

const scaryWords = /error|fail|exception|undefined|null|429|5\d\d|http|fetch|json|stack/i;

describe('friendlyMessage', () => {
  it('tells the parent the plane finder is busy when the proxy says busy', () => {
    const message = friendlyMessage('busy');
    expect(message.detail).toMatch(/busy/i);
    expect(message.detail).toMatch(/try again/i);
  });

  it('tells the parent there is no signal when the phone is offline', () => {
    expect(friendlyMessage('offline').detail).toMatch(/no signal/i);
  });

  it('explains how to turn location back on when permission is denied', () => {
    expect(friendlyMessage('denied').detail).toMatch(/settings/i);
  });

  it('explains how to turn the compass back on when motion permission is denied', () => {
    expect(friendlyMessage('motion-denied').detail).toMatch(/motion & orientation/i);
  });

  it('turns anything unexpected, even a thrown Error, into a gentle try-again', () => {
    const message = friendlyMessage(new TypeError('Cannot read properties of undefined (reading "ac")'));
    expect(message.kidLine).not.toMatch(scaryWords);
    expect(message.detail).toMatch(/try again/i);
    expect(message.detail).not.toMatch(/Cannot read/);
  });

  it.each([
    'busy',
    'offline',
    'error',
    'denied',
    'unavailable',
    'timeout',
    'unsupported',
    'motion-denied',
    'motion-unsupported',
    'compass-silent',
    undefined,
    'something new',
    { status: 500 },
  ])('never shows a scary word for %s', (problem) => {
    const { kidLine, detail } = friendlyMessage(problem);
    expect(kidLine.length).toBeGreaterThan(0);
    expect(detail.length).toBeGreaterThan(0);
    expect(`${kidLine} ${detail}`).not.toMatch(scaryWords);
  });
});
