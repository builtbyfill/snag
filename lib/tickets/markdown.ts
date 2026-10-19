// A ticket as a GitHub issue body (prd.md > Reviewing a ticket, format decided by Filip). Empty
// fields are left out, never written as "null"; `_(suggested)_` marks only what the extraction
// filled in with evidence, so a field typed by hand carries no marker.
import type { tickets } from '@/lib/db/schema';

type Ticket = typeof tickets.$inferSelect;

export type MarkdownTicket = Pick<
  Ticket,
  | 'number'
  | 'extractionState'
  | 'clientSentence'
  | 'title'
  | 'location'
  | 'actualResult'
  | 'expectedResult'
  | 'expectedResultEvidence'
  | 'stepsToReproduce'
  | 'stepsToReproduceEvidence'
  | 'priority'
  | 'tags'
> & { followUps: { body: string }[] };

const PRIORITY = { low: 'Low', medium: 'Medium', high: 'High' } as const;
const SUGGESTED = '_(suggested)_';
const TITLE_MAX = 80;

/** A quoted line; a sentence with line breaks stays inside the quote. */
const quote = (label: string, text: string) => `> ${label}: "${text.replace(/\r?\n/g, '\n> ')}"`;

/** The title, or for a ticket without one (pending, failed) the client's sentence on one line. */
function headingTitle(t: MarkdownTicket): string {
  if (t.title?.trim()) return t.title.trim();
  const line = t.clientSentence.replace(/\s+/g, ' ').trim();
  return line.length <= TITLE_MAX ? line : `${line.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

export function ticketToMarkdown(t: MarkdownTicket): string {
  const lines = [`## SN-${t.number}: ${headingTitle(t)}`];
  if (t.location) lines.push(`**Where:** ${t.location}`);
  if (t.actualResult) lines.push(`**What happened:** ${t.actualResult}`);
  if (t.expectedResult) lines.push(`**Expected:** ${t.expectedResult}${t.expectedResultEvidence ? ` ${SUGGESTED}` : ''}`);

  const steps = t.stepsToReproduce?.filter((step) => step.trim()) ?? [];
  if (steps.length > 0) {
    lines.push(`**Steps to reproduce:**${t.stepsToReproduceEvidence ? ` ${SUGGESTED}` : ''}`);
    steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }

  const meta = [t.priority && `**Priority:** ${PRIORITY[t.priority]}`, t.tags.length > 0 && `**Tags:** ${t.tags.join(', ')}`];
  if (meta.some(Boolean)) lines.push(meta.filter(Boolean).join(' · '));

  lines.push(quote('Client', t.clientSentence));
  for (const followUp of t.followUps) lines.push(quote('Later', followUp.body));
  return lines.join('\n');
}
