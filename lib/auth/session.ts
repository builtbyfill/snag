import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { readAuthEnv, type AuthEnv } from '@/lib/env';

export const SESSION_COOKIE = 'snag_session';
/** 30 days, in seconds (the cookie's maxAge and the token's exp). */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

type Keys = Pick<AuthEnv, 'ADMIN_SECRET' | 'SESSION_SECRET'>;

const Payload = z.object({ iat: z.number().int(), exp: z.number().int() }).strict();

const mac = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

/**
 * `base64url({ iat, exp }).base64url(hmac)`, HMAC-SHA256 keyed with SESSION_SECRET only, so a new
 * access code logs nobody out. Nothing is stored on the server.
 */
export function createSessionToken(env: Keys, now: number = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ iat, exp: iat + SESSION_MAX_AGE })).toString('base64url');
  return `${payload}.${mac(payload, env.SESSION_SECRET)}`;
}

/** Signature first, then expiry. Anything malformed is simply not a session. */
export function verifySessionToken(token: string | undefined, env: Keys, now: number = Date.now()): boolean {
  const [payload, signature, extra] = token?.split('.') ?? [];
  if (!payload || !signature || extra !== undefined) return false;
  // Compared as text: decoding first would accept a changed last character (base64url padding bits).
  const given = Buffer.from(signature);
  const expected = Buffer.from(mac(payload, env.SESSION_SECRET));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  try {
    const parsed = Payload.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    return parsed.success && parsed.data.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison with the access code. Both sides are hashed first so the buffers have
 * equal length and the code's length isn't revealed by an early return.
 */
export function accessCodeMatches(input: string, accessCode: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(input), digest(accessCode));
}

export function sessionCookieOptions(appUrl: string) {
  return {
    httpOnly: true,
    secure: appUrl.startsWith('https'),
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

/** True when this request carries a valid session cookie. */
export async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, readAuthEnv());
}

/**
 * The gate. Every dashboard page and server action calls this itself; proxy.ts only saves a round
 * trip, it is not what keeps anyone out.
 */
export async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) redirect('/login');
}
