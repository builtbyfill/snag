// One threshold for the "low" confidence label and the Ask client flag (PRD: below 0.6). The
// database computes `ask_client` with the same number (lib/db/schema.ts).
export const LOW_CONFIDENCE = 0.6;

export type ConfidenceLevel = 'low' | 'high';

export function confidenceLevel(value: number): ConfidenceLevel {
  return value < LOW_CONFIDENCE ? 'low' : 'high';
}

/** The visible label, once: "0.80 · high", "0.41 · low". */
export function confidenceText(value: number, words: Record<ConfidenceLevel, string>): { number: string; level: ConfidenceLevel; word: string } {
  const level = confidenceLevel(value);
  return { number: value.toFixed(2), level, word: words[level] };
}
