import { afterEach, describe, expect, it, vi } from 'vitest';
import { attemptLogin } from '@/lib/auth/login';
import { verifySessionToken } from '@/lib/auth/session';
import { createMemoryLoginLimiter } from './fakes/memory-login-limiter';

const env = { ADMIN_SECRET: 'access-code-for-tests-only', SESSION_SECRET: 's'.repeat(44) };
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);

afterEach(() => vi.restoreAllMocks());

describe('demo access code', () => {
  const withDemo = { ...env, DEMO_ACCESS_CODE: 'judges-code-for-tests-only' };

  it('signs in with the demo code when it is set, and the developer code still works', async () => {
    expect((await attemptLogin(withDemo.DEMO_ACCESS_CODE, { env: withDemo, ip: '203.0.113.9', limiter: createMemoryLoginLimiter(), now: NOW })).ok).toBe(true);
    expect((await attemptLogin(withDemo.ADMIN_SECRET, { env: withDemo, ip: '203.0.113.9', limiter: createMemoryLoginLimiter(), now: NOW })).ok).toBe(true);
  });

  it('refuses the demo code when it is not set, and any other code', async () => {
    expect(await attemptLogin('judges-code-for-tests-only', { env, ip: '203.0.113.9', limiter: createMemoryLoginLimiter(), now: NOW })).toEqual({ ok: false, error: 'mismatch' });
    expect(await attemptLogin('not-the-code-at-all', { env: withDemo, ip: '203.0.113.9', limiter: createMemoryLoginLimiter(), now: NOW })).toEqual({ ok: false, error: 'mismatch' });
  });
});

describe('attemptLogin', () => {
  const ip = '203.0.113.7';

  it('returns a valid session token for the right code', async () => {
    const result = await attemptLogin(env.ADMIN_SECRET, { env, ip, limiter: createMemoryLoginLimiter(), now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) expect(verifySessionToken(result.token, env, NOW)).toBe(true);
  });

  it('says mismatch for a wrong code, a missing field or a file, and counts each', async () => {
    const limiter = createMemoryLoginLimiter();
    for (const input of ['wrong-code-of-some-length', null, new File(['x'], 'code.txt')]) {
      expect(await attemptLogin(input, { env, ip, limiter, now: NOW })).toEqual({ ok: false, error: 'mismatch' });
    }
    await limiter.recordFailure(ip, NOW);
    expect(await limiter.isLocked(ip, NOW)).toBe(false);
    await limiter.recordFailure(ip, NOW);
    expect(await limiter.isLocked(ip, NOW)).toBe(true);
  });

  it('refuses the sixth attempt even with the right code, and logs the lock once', async () => {
    const limiter = createMemoryLoginLimiter();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      expect(await attemptLogin('wrong-code-of-some-length', { env, ip, limiter, now: NOW })).toEqual({ ok: false, error: 'mismatch' });
    }
    expect(await attemptLogin(env.ADMIN_SECRET, { env, ip, limiter, now: NOW })).toEqual({ ok: false, error: 'locked' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).not.toContain(ip); // the log names no address
  });

  it('clears the address after a successful login, and leaves other addresses alone', async () => {
    const limiter = createMemoryLoginLimiter();
    for (let i = 0; i < 4; i++) {
      await attemptLogin('wrong-code-of-some-length', { env, ip, limiter, now: NOW });
      await attemptLogin('wrong-code-of-some-length', { env, ip: '198.51.100.2', limiter, now: NOW });
    }
    expect((await attemptLogin(env.ADMIN_SECRET, { env, ip, limiter, now: NOW })).ok).toBe(true);
    await attemptLogin('wrong-code-of-some-length', { env, ip, limiter, now: NOW });
    expect(await limiter.isLocked(ip, NOW)).toBe(false);
    await attemptLogin('wrong-code-of-some-length', { env, ip: '198.51.100.2', limiter, now: NOW });
    expect(await limiter.isLocked('198.51.100.2', NOW)).toBe(true);
  });
});
