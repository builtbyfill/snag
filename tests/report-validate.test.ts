import { describe, expect, it } from 'vitest';
import { checkScreenshot, checkSentence, checkSentenceDetail } from '@/lib/reports/validate';

// The checks return error codes; the page turns codes into words in the client's language.
describe('checkSentence (browser and server use the same rule)', () => {
  it('accepts 10 or more characters after trimming', () => {
    expect(checkSentence('Ne radi kad kliknem.')).toBeNull();
  });

  it.each(['', '   Ne radi   ', 'kratko'])('asks for at least 10 characters: %j', (s) => {
    expect(checkSentence(s)).toBe('sentenceShort');
  });

  it('asks to keep it under 1000 characters', () => {
    expect(checkSentence('a'.repeat(1001))).toBe('sentenceLong');
  });
});

describe('checkScreenshot (browser pre-check; the server sniffs the real format)', () => {
  it('accepts png, jpeg and webp up to 5 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(checkScreenshot({ type, size: 5 * 1024 * 1024 })).toBeNull();
    }
  });

  it('rejects other types', () => {
    expect(checkScreenshot({ type: 'image/gif', size: 10 })).toBe('invalidType');
    expect(checkScreenshot({ type: 'image/heic', size: 10 })).toBe('invalidType');
  });

  it('rejects files over 5 MB', () => {
    expect(checkScreenshot({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('tooLarge');
  });
});

describe('checkSentenceDetail (browser only: a starter chip alone is not a report)', () => {
  const starters = ["A button doesn't work", "A page won't load"];

  it('refuses a starter with nothing after it', () => {
    expect(checkSentenceDetail("A button doesn't work: ", starters)).toBe('sentenceShort');
    expect(checkSentenceDetail("a button doesn't work", starters)).toBe('sentenceShort');
  });

  it('refuses a starter followed by only a word or two', () => {
    expect(checkSentenceDetail("A page won't load: help", starters)).toBe('sentenceShort');
  });

  it('accepts a starter followed by real detail', () => {
    expect(checkSentenceDetail("A button doesn't work: Save on the appointment", starters)).toBeNull();
  });

  it('falls back to the normal rule for anything else', () => {
    expect(checkSentenceDetail('too short', starters)).toBe('sentenceShort');
    expect(checkSentenceDetail('I tapped Save and nothing happened', starters)).toBeNull();
  });
});
