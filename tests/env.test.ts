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
