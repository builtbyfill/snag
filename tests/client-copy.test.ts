import { describe, expect, it } from 'vitest';
import { clientCopy } from '@/lib/copy/client';
import { REPORT_ERROR_CODES } from '@/lib/reports/validate';

// Every string, as "a.b.c" paths, so an empty one shows up by name.
function strings(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k));
}

describe('client page copy (English only, Filip 2026-10-17)', () => {
  it('has no empty strings', () => {
    for (const [path, text] of strings(clientCopy)) expect(text, path).toMatch(/\S/);
  });

  it('has words for every report error code', () => {
    for (const code of REPORT_ERROR_CODES) expect(clientCopy.errors[code], code).toMatch(/\S/);
  });

  it('contains no Bosnian and never mentions WhatsApp', () => {
    const all = JSON.stringify(clientCopy);
    expect(all).not.toMatch(/[čćđšžČĆĐŠŽ]/);
    expect(all).not.toMatch(/whatsapp/i);
  });

  it('marks the sentence placeholder as an example', () => {
    expect(clientCopy.newReport.placeholder).toMatch(/^e\.g\. /);
  });

  it('offers three suggestion chips that start a sentence', () => {
    expect(clientCopy.newReport.chips).toHaveLength(3);
    for (const chip of clientCopy.newReport.chips) expect(chip.length).toBeGreaterThanOrEqual(10);
  });

  it('never makes the client count characters or press a platform key', () => {
    expect(clientCopy.errors.sentenceShort).not.toMatch(/\d/);
    expect(clientCopy.newReport.pasteHint).not.toMatch(/ctrl|cmd|⌘/i);
  });

  it('has a headline and a next line for every status, and an announcement for a sent report', () => {
    for (const status of ['new', 'in_progress', 'done'] as const) {
      expect(clientCopy.report.headline[status], status).toMatch(/\S/);
      expect(clientCopy.report.detail[status], status).toMatch(/\S/);
    }
    expect(clientCopy.report.announce).toMatch(/\S/);
  });

  it('names the statuses a client can see and the two groups', () => {
    expect(clientCopy.status).toEqual({ new: 'Received', in_progress: 'In progress', done: 'Done' });
    expect(clientCopy.list.groups).toEqual({ open: 'In progress', done: 'Done' });
  });

  it('fills the contact note from the developer', () => {
    expect(clientCopy.welcome.contact.body).toContain('{name}');
  });
});
