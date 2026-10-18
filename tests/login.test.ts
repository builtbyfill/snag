import { afterEach, describe, expect, it, vi } from 'vitest';
import { attemptLogin } from '@/lib/auth/login';
import { LOGIN_FAILURES_ALLOWED, LOGIN_WINDOW_MS, createLoginLimiter } from '@/lib/auth/rate-limit';
import { verifySessionToken } from '@/lib/auth/session';

const env = { ADMIN_SECRET: 'access-code-for-tests-only', SESSION_SECRET: 's'.repeat(44) };
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const MINUTE = 60 * 1000;

afterEach(() => vi.restoreAllMocks());

describe('login limiter', () => {
  it('allows five failures from one address in 15 minutes, then locks it', () => {
    const limiter = createLoginLimiter();
    expect(LOGIN_FAILURES_ALLOWED).toBe(5);
    expect(LOGIN_WINDOW_MS).toBe(15 * MINUTE);
    for (let i = 0; i < 4; i++) {
      expect(limiter.recordFailure('203.0.113.7', NOW + i * MINUTE)).toBe(false);
      expect(limiter.isLocked('203.0.113.7', NOW + i * MINUTE)).toBe(false);
    }
    expect(limiter.recordFailure('203.0.113.7', NOW + 4 * MINUTE)).toBe(true); // this failure locks
    expect(limiter.isLocked('203.0.113.7', NOW + 4 * MINUTE)).toBe(true);
  });

  it('frees one attempt when the oldest failure is 15 minutes old', () => {
    const limiter = createLoginLimiter();
    for (let i = 0; i < 5; i++) limiter.recordFailure('203.0.113.7', NOW + i * MINUTE);
    expect(limiter.isLocked('203.0.113.7', NOW + 15 * MINUTE - 1)).toBe(true);
    expect(limiter.isLocked('203.0.113.7', NOW + 15 * MINUTE)).toBe(false);
  });

  it('counts each address on its own, and clearing one leaves the others', () => {
    const limiter = createLoginLimiter();
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure('203.0.113.7', NOW);
      limiter.recordFailure('198.51.100.2', NOW);
    }
    expect(limiter.isLocked('192.0.2.1', NOW)).toBe(false);
    limiter.clear('203.0.113.7');
    expect(limiter.isLocked('203.0.113.7', NOW)).toBe(false);
    expect(limiter.isLocked('198.51.100.2', NOW)).toBe(true);
  });

  it('forgets addresses whose failures are all older than the window', () => {
    const limiter = createLoginLimiter();
    limiter.recordFailure('203.0.113.7', NOW);
    limiter.recordFailure('198.51.100.2', NOW + 20 * MINUTE);
    expect(limiter.size()).toBe(1);
  });
});

describe('attemptLogin', () => {
  const ip = '203.0.113.7';

  it('returns a valid session token for the right code', () => {
    const result = attemptLogin(env.ADMIN_SECRET, { env, ip, limiter: createLoginLimiter(), now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) expect(verifySessionToken(result.token, env, NOW)).toBe(true);
  });

  it('says mismatch for a wrong code, a missing field or a file, and counts each', () => {
    const limiter = createLoginLimiter();
    for (const input of ['wrong-code-of-some-length', null, new File(['x'], 'code.txt')]) {
      expect(attemptLogin(input, { env, ip, limiter, now: NOW })).toEqual({ ok: false, error: 'mismatch' });
    }
    limiter.recordFailure(ip, NOW);
    expect(limiter.isLocked(ip, NOW)).toBe(false);
    limiter.recordFailure(ip, NOW);
    expect(limiter.isLocked(ip, NOW)).toBe(true);
  });

  it('refuses the sixth attempt even with the right code, and logs the lock once', () => {
    const limiter = createLoginLimiter();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      expect(attemptLogin('wrong-code-of-some-length', { env, ip, limiter, now: NOW })).toEqual({ ok: false, error: 'mismatch' });
    }
    expect(attemptLogin(env.ADMIN_SECRET, { env, ip, limiter, now: NOW })).toEqual({ ok: false, error: 'locked' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).not.toContain(ip); // the log names no address
  });

  it('clears the address after a successful login, and leaves other addresses alone', () => {
    const limiter = createLoginLimiter();
    for (let i = 0; i < 4; i++) {
      attemptLogin('wrong-code-of-some-length', { env, ip, limiter, now: NOW });
      attemptLogin('wrong-code-of-some-length', { env, ip: '198.51.100.2', limiter, now: NOW });
    }
    expect(attemptLogin(env.ADMIN_SECRET, { env, ip, limiter, now: NOW }).ok).toBe(true);
    attemptLogin('wrong-code-of-some-length', { env, ip, limiter, now: NOW });
    expect(limiter.isLocked(ip, NOW)).toBe(false);
    attemptLogin('wrong-code-of-some-length', { env, ip: '198.51.100.2', limiter, now: NOW });
    expect(limiter.isLocked('198.51.100.2', NOW)).toBe(true);
  });
});
