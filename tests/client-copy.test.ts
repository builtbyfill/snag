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

  it('asks in the placeholder what was tapped and what happened instead', () => {
    expect(clientCopy.composer.placeholder).toBe('What did you tap, and what happened instead?');
  });

  it('offers three suggestion chips that start a sentence', () => {
    expect(clientCopy.composer.chips).toHaveLength(3);
    for (const chip of clientCopy.composer.chips) expect(chip.length).toBeGreaterThanOrEqual(10);
  });

  it('never makes the client count characters or press a platform key', () => {
    expect(clientCopy.errors.sentenceShort).not.toMatch(/\d/);
  });

  it('has a headline and a next line for every status, and an announcement for a sent report', () => {
    for (const status of ['new', 'in_progress', 'done'] as const) {
      expect(clientCopy.report.headline[status], status).toMatch(/\S/);
      expect(clientCopy.report.detail[status], status).toMatch(/\S/);
    }
    expect(clientCopy.report.announce).toMatch(/\S/);
  });

  it('has one short line under each timeline step', () => {
    for (const status of ['new', 'in_progress', 'done'] as const) expect(clientCopy.report.stepLines[status], status).toMatch(/\S/);
    expect(clientCopy.list.help).toBe('Help');
  });

  it('explains how to take a screenshot in three steps, with a line per device in step 2', () => {
    expect(clientCopy.help.steps).toHaveLength(3);
    expect(clientCopy.help.steps[1].map((line) => line.split(':')[0])).toEqual(['iPhone', 'Android', 'Windows', 'Mac']);
    expect(clientCopy.report.sentOn).toContain('{date}');
  });

  it('names the statuses a client can see', () => {
    expect(clientCopy.status).toEqual({ new: 'Received', in_progress: 'In progress', done: 'Done' });
  });

  it('fills the contact note from the developer', () => {
    expect(clientCopy.welcome.contact.body).toContain('{name}');
  });

  it('says who the line reaches, explains three steps and counts reports in progress', () => {
    expect(clientCopy.intro.greeting).toBe("This is your direct line to {name} for anything that doesn't work.");
    expect(clientCopy.intro.steps).toHaveLength(3);
    expect(clientCopy.intro.inProgressMany).toContain('{count}');
    expect(clientCopy.header.back).toBe('Back {when} at {time}');
  });
});
