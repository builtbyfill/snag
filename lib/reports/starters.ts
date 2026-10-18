// The suggestion chips above the field start the sentence ("A button doesn't work: …"). They stay
// on screen while the client types, so tapping one never moves the field; it only swaps the start.

/** The text after tapping `chip`: replaces another chip's start, keeps whatever the client typed. */
export function applyStarter(sentence: string, chip: string, chips: readonly string[]): string {
  const text = sentence.trimStart();
  const current = chips.find((c) => text.toLowerCase().startsWith(`${c.toLowerCase()}:`));
  const rest = current ? text.slice(current.length + 1).trimStart() : text.trim() === '' ? '' : text;
  return `${chip}: ${rest}`;
}
