/**
 * One line about an error for the server log: its name and the first line of its message. A
 * database driver's message can carry the whole query and its parameters (a client's sentence,
 * a report link), which don't belong in a log.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error.cause as { code?: string } | undefined)?.code;
  const firstLine = error.message.split('\n')[0].slice(0, 200);
  return `${error.name}${code ? ` (${code})` : ''}: ${firstLine}`;
}
