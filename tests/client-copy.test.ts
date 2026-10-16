import { describe, expect, it } from 'vitest';
import { CLIENT_LOCALES, clientCopy, DEFAULT_CLIENT_LOCALE } from '@/lib/i18n/client-copy';
import { REPORT_ERROR_CODES } from '@/lib/reports/validate';

// Every string key, as "a.b.c" paths, so a missing translation shows up by name.
function keys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('client page copy', () => {
  it('defaults to Bosnian', () => {
    expect(DEFAULT_CLIENT_LOCALE).toBe('bs');
  });

  it('has the same keys in every language, so English can be switched on later', () => {
    const [first, ...rest] = CLIENT_LOCALES;
    for (const locale of rest) expect(keys(clientCopy[locale]).sort()).toEqual(keys(clientCopy[first]).sort());
  });

  it('has words for every report error code in every language', () => {
    for (const locale of CLIENT_LOCALES) {
      for (const code of REPORT_ERROR_CODES) expect(clientCopy[locale].errors[code], `${locale}.errors.${code}`).toMatch(/\S/);
    }
  });

  it('marks the sentence placeholder as an example', () => {
    expect(clientCopy.bs.sentence.placeholder).toMatch(/^npr\. /);
    expect(clientCopy.en.sentence.placeholder).toMatch(/^e\.g\. /);
  });

  it('carries the reassurance line under the button, word for word', () => {
    expect(clientCopy.bs.reassurance).toBe('Bez registracije. Javićemo vam se na WhatsApp ako trebamo više informacija.');
  });
});
