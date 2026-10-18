import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SESSION_MAX_AGE,
  accessCodeMatches,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from '@/lib/auth/session';

const env = { ADMIN_SECRET: 'access-code-for-tests-only', SESSION_SECRET: 's'.repeat(44) };
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

describe('session tokens', () => {
  it('verifies a token it just made', () => {
    expect(verifySessionToken(createSessionToken(env, NOW), env, NOW)).toBe(true);
  });

  it('is base64url(payload).base64url(hmac) with only iat and exp, 30 days apart', () => {
    const token = createSessionToken(env, NOW);
    const [payload, mac] = token.split('.');
    expect(token.split('.')).toHaveLength(2);
    expect(decode(payload)).toEqual({ iat: NOW / 1000, exp: NOW / 1000 + SESSION_MAX_AGE });
    expect(mac).toBe(sign(payload, env.SESSION_SECRET));
    expect(SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });

  it('rejects a payload changed after signing', () => {
    const [, mac] = createSessionToken(env, NOW).split('.');
    const longer = Buffer.from(JSON.stringify({ iat: NOW / 1000, exp: NOW / 1000 + 10 * SESSION_MAX_AGE })).toString('base64url');
    expect(verifySessionToken(`${longer}.${mac}`, env, NOW)).toBe(false);
  });

  it('rejects a changed or truncated signature', () => {
    const token = createSessionToken(env, NOW);
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifySessionToken(flipped, env, NOW)).toBe(false);
    expect(verifySessionToken(token.slice(0, -4), env, NOW)).toBe(false);
  });

  it('rejects anything that is not a token, without throwing', () => {
    const signedJunk = (payload: string) => `${payload}.${sign(payload, env.SESSION_SECRET)}`;
    for (const value of [undefined, '', 'abc', 'a.b.c', '.', signedJunk('not-json'), signedJunk(Buffer.from('{"iat":1}').toString('base64url'))]) {
      expect(verifySessionToken(value, env, NOW)).toBe(false);
    }
  });

  it('expires 30 days after it was made', () => {
    const token = createSessionToken(env, NOW);
    expect(verifySessionToken(token, env, NOW + SESSION_MAX_AGE * 1000 - 1000)).toBe(true);
    expect(verifySessionToken(token, env, NOW + SESSION_MAX_AGE * 1000)).toBe(false);
  });

  it('stays valid when ADMIN_SECRET is rotated (one key, one purpose)', () => {
    const token = createSessionToken(env, NOW);
    expect(verifySessionToken(token, { ...env, ADMIN_SECRET: 'a-brand-new-access-code' }, NOW)).toBe(true);
  });

  it('is invalidated by rotating SESSION_SECRET', () => {
    const token = createSessionToken(env, NOW);
    expect(verifySessionToken(token, { ...env, SESSION_SECRET: 't'.repeat(44) }, NOW)).toBe(false);
  });
});

describe('accessCodeMatches', () => {
  it('accepts exactly the access code', () => {
    expect(accessCodeMatches(env.ADMIN_SECRET, env.ADMIN_SECRET)).toBe(true);
  });

  it('rejects a different code of any length, and empty input', () => {
    for (const input of ['access-code-for-tests-onlX', 'access-code-for-tests', `${env.ADMIN_SECRET}!`, '', ' access-code-for-tests-only']) {
      expect(accessCodeMatches(input, env.ADMIN_SECRET)).toBe(false);
    }
  });
});

describe('sessionCookieOptions', () => {
  it('is httpOnly, SameSite=Strict, path /, 30 days', () => {
    expect(sessionCookieOptions('http://localhost:3000')).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
  });

  it('turns on Secure when APP_URL is https', () => {
    expect(sessionCookieOptions('https://snag.example.com').secure).toBe(true);
  });
});
