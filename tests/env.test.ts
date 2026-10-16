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
