// Shared by the report form (browser) and submitReport (server): limits, error codes, and the
// checks that don't need the bytes. Pure, so it can ship in the client bundle. The words for
// each code live in lib/copy/client.ts.

export const REPORT_ERROR_CODES = [
  'sentenceShort',
  'sentenceLong',
  'missingImage',
  'invalidType',
  'unreadableImage', // browser only: the image could not be decoded
  'tooLarge',
  'tooManyPixels',
  'oneFile', // browser only: more than one file dropped
  'rateLimited',
  'notFound',
  'server',
  'followUpEmpty', // a follow-up with no real text
] as const;
export type ReportErrorCode = (typeof REPORT_ERROR_CODES)[number];

// 4 MB: under Vercel's 4.5 MB request body limit with room for the form, so an oversized file
// gets this app's own "too large" message rather than the platform's error.
export const MAX_BYTES = 4 * 1024 * 1024;
export const MAX_EDGE_PX = 8000; // the API's hard limit per image edge
export const SENTENCE_MIN = 10;
export const SENTENCE_MAX = 1000;
export const FOLLOW_UP_MIN = 2; // a follow-up only needs to say something, not describe a problem
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function checkSentence(sentence: string): ReportErrorCode | null {
  const length = sentence.trim().length;
  if (length < SENTENCE_MIN) return 'sentenceShort';
  if (length > SENTENCE_MAX) return 'sentenceLong';
  return null;
}

/**
 * Browser only: a starter chip ("A button doesn't work") is not a report by itself. When the
 * sentence begins with one, the words after it must pass the length rule on their own.
 */
export function checkSentenceDetail(sentence: string, starters: readonly string[]): ReportErrorCode | null {
  const base = checkSentence(sentence);
  if (base) return base;
  const text = sentence.trim();
  const starter = starters.find((s) => text.toLowerCase().startsWith(s.toLowerCase()));
  if (!starter) return null;
  const rest = text.slice(starter.length).replace(/^[\s:.,;-]+/, '');
  return rest.length < SENTENCE_MIN ? 'sentenceShort' : null;
}

/** Browser pre-check on the declared type and size. The server ignores the declared type and sniffs the bytes. */
export function checkScreenshot(file: { type: string; size: number }): ReportErrorCode | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'invalidType';
  if (file.size > MAX_BYTES) return 'tooLarge';
  return null;
}
