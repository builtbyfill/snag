import { describe, expect, it } from 'vitest';
import { ticketToMarkdown, type MarkdownTicket } from '@/lib/tickets/markdown';

const extracted: MarkdownTicket = {
  number: 14,
  extractionState: 'extracted',
  clientSentence: 'I clicked Next on the booking page and nothing happens.',
  title: 'Next button does nothing on step 3 of booking',
  location: 'Booking page, step 3 "Your details"',
  actualResult: 'Clicking Next leaves the form on step 3 with no message.',
  expectedResult: 'The form moves on to step 4 (confirmation).',
  expectedResultEvidence: 'The stepper shows a fourth step, "Confirm".',
  stepsToReproduce: ['Open the booking page', 'Fill in name and phone', 'Click Next'],
  stepsToReproduceEvidence: 'Name and phone fields are filled in the screenshot.',
  priority: 'high',
  tags: ['booking', 'form'],
  followUps: [],
};

describe('ticketToMarkdown', () => {
  it('writes the agreed GitHub format with the ticket number in the heading', () => {
    expect(ticketToMarkdown(extracted)).toBe(
      [
        '## SN-14: Next button does nothing on step 3 of booking',
        '**Where:** Booking page, step 3 "Your details"',
        '**What happened:** Clicking Next leaves the form on step 3 with no message.',
        '**Expected:** The form moves on to step 4 (confirmation). _(suggested)_',
        '**Steps to reproduce:** _(suggested)_',
        '1. Open the booking page',
        '2. Fill in name and phone',
        '3. Click Next',
        '**Priority:** High · **Tags:** booking, form',
        '> Client: "I clicked Next on the booking page and nothing happens."',
      ].join('\n'),
    );
  });

  it('adds one Later line per follow-up, oldest first', () => {
    const markdown = ticketToMarkdown({
      ...extracted,
      followUps: [{ body: 'It happens on Mondays too.' }, { body: 'Still broken today.' }],
    });
    expect(markdown.endsWith('> Client: "I clicked Next on the booking page and nothing happens."\n> Later: "It happens on Mondays too."\n> Later: "Still broken today."')).toBe(true);
  });

  it('omits empty fields entirely and never writes null', () => {
    const markdown = ticketToMarkdown({
      ...extracted,
      location: null,
      expectedResult: null,
      expectedResultEvidence: null,
      stepsToReproduce: [],
      stepsToReproduceEvidence: null,
      tags: [],
    });
    expect(markdown).toBe(
      [
        '## SN-14: Next button does nothing on step 3 of booking',
        '**What happened:** Clicking Next leaves the form on step 3 with no message.',
        '**Priority:** High',
        '> Client: "I clicked Next on the booking page and nothing happens."',
      ].join('\n'),
    );
    expect(markdown).not.toMatch(/null|undefined/);
  });

  it('marks only fields the extraction suggested: a field typed by hand has no evidence and no marker', () => {
    const markdown = ticketToMarkdown({ ...extracted, expectedResultEvidence: null, stepsToReproduceEvidence: null, priority: null });
    expect(markdown).toContain('**Expected:** The form moves on to step 4 (confirmation).\n');
    expect(markdown).toContain('**Steps to reproduce:**\n1. Open the booking page');
    expect(markdown).toContain('**Tags:** booking, form');
    expect(markdown).not.toContain('_(suggested)_');
  });

  it('reduces a pending ticket to the sentence as the title, the client line and follow-ups', () => {
    const pending: MarkdownTicket = {
      number: 15,
      extractionState: 'pending',
      clientSentence: 'The calendar is empty for next week.',
      title: null,
      location: null,
      actualResult: null,
      expectedResult: null,
      expectedResultEvidence: null,
      stepsToReproduce: null,
      stepsToReproduceEvidence: null,
      priority: null,
      tags: [],
      followUps: [{ body: 'Only on my phone.' }],
    };
    expect(ticketToMarkdown(pending)).toBe(
      ['## SN-15: The calendar is empty for next week.', '> Client: "The calendar is empty for next week."', '> Later: "Only on my phone."'].join('\n'),
    );
  });

  it('keeps the heading on one line when the title has a line break in it', () => {
    const [heading, next] = ticketToMarkdown({ ...extracted, title: 'Next button\n  does nothing' }).split('\n');
    expect(heading).toBe('## SN-14: Next button does nothing');
    expect(next).toMatch(/^\*\*Where:\*\*/);
  });

  it('keeps a long sentence title short, and a multi-line sentence inside the quote', () => {
    const sentence = `${'The payment page shows an error after I enter my card '.repeat(3)}\nand then it logs me out.`;
    const markdown = ticketToMarkdown({ ...extracted, title: null, clientSentence: sentence });
    const [heading] = markdown.split('\n');
    expect(heading.length).toBeLessThanOrEqual('## SN-14: '.length + 80);
    expect(heading.endsWith('…')).toBe(true);
    expect(markdown).toContain('> Client: "The payment page');
    expect(markdown).toContain('\n> and then it logs me out."');
  });
});
