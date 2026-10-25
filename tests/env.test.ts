import { describe, expect, it } from 'vitest';
import { readExtractionEnv } from '@/lib/env';

const KEY = 'fake-key-for-tests-only';

describe('readExtractionEnv', () => {
  it('applies the defaults for non-secret values', () => {
    const env = readExtractionEnv({ ANTHROPIC_API_KEY: KEY });
    expect(env.EXTRACTION_MODEL).toBe('claude-sonnet-5-5');
    expect(env.EXTRACTION_MAX_EDGE).toBe(1568);
  });

  it('reads EXTRACTION_MAX_EDGE as a number', () => {
    const env = readExtractionEnv({ ANTHROPIC_API_KEY: KEY, EXTRACTION_MAX_EDGE: '2576' });
    expect(env.EXTRACTION_MAX_EDGE).toBe(2576);
  });

  it('rejects a missing API key and names the variable', () => {
    expect(() => readExtractionEnv({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('rejects a placeholder left in from .env.example', () => {
    expect(() =>
      readExtractionEnv({ ANTHROPIC_API_KEY: 'replace-with-your-anthropic-api-key' }),
    ).toThrow(/ANTHROPIC_API_KEY.*placeholder/);
  });

  it('never puts a secret value in the error message', () => {
    try {
      readExtractionEnv({ ANTHROPIC_API_KEY: KEY, EXTRACTION_MAX_EDGE: 'not-a-number' });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toMatch(/EXTRACTION_MAX_EDGE/);
      expect(String(error)).not.toContain(KEY);
    }
  });
});

describe('readDatabaseEnv', () => {
  it('requires DATABASE_URL and rejects the placeholder inside it', async () => {
    const { readDatabaseEnv } = await import('@/lib/env');
    expect(() => readDatabaseEnv({})).toThrow(/DATABASE_URL: is required/);
    expect(() => readDatabaseEnv({ DATABASE_URL: 'postgres://snag:replace-with-a-postgres-password@localhost:5433/snag' }))
      .toThrow(/DATABASE_URL: still holds the placeholder/);
    expect(readDatabaseEnv({ DATABASE_URL: 'postgres://snag:pw@localhost:5433/snag' }).DATABASE_URL).toContain('5433');
  });
});

describe('readReportEnv', () => {
  const SECRET = 'a'.repeat(44);

  it('defaults the uploads folder', async () => {
    const { readReportEnv } = await import('@/lib/env');
    expect(readReportEnv({ IP_HASH_SECRET: SECRET })).toEqual({ IP_HASH_SECRET: SECRET, UPLOAD_DIR: './.uploads' });
  });

  it('rejects a short or placeholder IP_HASH_SECRET', async () => {
    const { readReportEnv } = await import('@/lib/env');
    expect(() => readReportEnv({ IP_HASH_SECRET: 'short' })).toThrow(/IP_HASH_SECRET/);
    expect(() => readReportEnv({ IP_HASH_SECRET: 'replace-with-32-random-bytes-xxxxxxxxxxxx' })).toThrow(/placeholder/);
  });
});

describe('readAuthEnv', () => {
  const valid = {
    ADMIN_SECRET: 'access-code-for-tests-only',
    SESSION_SECRET: 's'.repeat(44),
    IP_HASH_SECRET: 'i'.repeat(44),
  };

  it('reads the three secrets and defaults APP_URL', async () => {
    const { readAuthEnv } = await import('@/lib/env');
    expect(readAuthEnv(valid)).toEqual({ ...valid, APP_URL: 'http://localhost:3000' });
  });

  it('requires every secret and names each missing one', async () => {
    const { readAuthEnv } = await import('@/lib/env');
    expect(() => readAuthEnv({})).toThrow(/ADMIN_SECRET: is required[\s\S]*SESSION_SECRET: is required[\s\S]*IP_HASH_SECRET: is required/);
  });

  it('rejects a short access code, a short session key and placeholders', async () => {
    const { readAuthEnv } = await import('@/lib/env');
    expect(() => readAuthEnv({ ...valid, ADMIN_SECRET: 'fifteen-chars!!' })).toThrow(/ADMIN_SECRET: must be at least 16 characters/);
    expect(() => readAuthEnv({ ...valid, SESSION_SECRET: 'too-short' })).toThrow(/SESSION_SECRET: must be at least 32 characters/);
    expect(() => readAuthEnv({ ...valid, ADMIN_SECRET: 'replace-with-an-access-code-of-16-or-more-characters' })).toThrow(/ADMIN_SECRET: still holds the placeholder/);
  });

  it('rejects any two equal secrets, naming both variables and never the value', async () => {
    const { readAuthEnv } = await import('@/lib/env');
    const same = 'x'.repeat(44);
    const cases = [
      [{ ...valid, ADMIN_SECRET: same, SESSION_SECRET: same }, /SESSION_SECRET: must differ from ADMIN_SECRET/],
      [{ ...valid, ADMIN_SECRET: same, IP_HASH_SECRET: same }, /IP_HASH_SECRET: must differ from ADMIN_SECRET/],
      [{ ...valid, SESSION_SECRET: same, IP_HASH_SECRET: same }, /IP_HASH_SECRET: must differ from SESSION_SECRET/],
    ] as const;
    for (const [source, message] of cases) {
      try {
        readAuthEnv(source);
        expect.unreachable();
      } catch (error) {
        expect(String(error)).toMatch(message);
        expect(String(error)).not.toContain(same);
      }
    }
  });

  it('drops a trailing slash from APP_URL, so report links have one slash', async () => {
    const { readAuthEnv } = await import('@/lib/env');
    expect(readAuthEnv({ ...valid, APP_URL: 'https://snag.example/' }).APP_URL).toBe('https://snag.example');
  });

  it('reads an optional DEMO_ACCESS_CODE: empty means off, short or equal to another secret is refused', async () => {
    const { readAuthEnv } = await import('@/lib/env');
    expect(readAuthEnv({ ...valid, DEMO_ACCESS_CODE: '' }).DEMO_ACCESS_CODE).toBeUndefined();
    expect(readAuthEnv({ ...valid, DEMO_ACCESS_CODE: 'judges-code-for-tests' }).DEMO_ACCESS_CODE).toBe('judges-code-for-tests');
    expect(() => readAuthEnv({ ...valid, DEMO_ACCESS_CODE: 'too-short' })).toThrow(/DEMO_ACCESS_CODE: must be at least 16 characters/);
    expect(() => readAuthEnv({ ...valid, DEMO_ACCESS_CODE: valid.ADMIN_SECRET })).toThrow(/DEMO_ACCESS_CODE: must differ from ADMIN_SECRET/);
  });

  it('rejects an APP_URL that is not a URL', async () => {
    const { readAuthEnv } = await import('@/lib/env');
    expect(() => readAuthEnv({ ...valid, APP_URL: 'localhost' })).toThrow(/APP_URL/);
  });
});
