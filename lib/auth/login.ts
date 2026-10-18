import type { AuthEnv } from '@/lib/env';
import type { LoginLimiter } from '@/lib/auth/rate-limit';
import { accessCodeMatches, createSessionToken } from '@/lib/auth/session';

export type LoginError = 'mismatch' | 'locked';
export type LoginResult = { ok: true; token: string } | { ok: false; error: LoginError };

/**
 * One login attempt. A locked address isn't checked at all, so the sixth try fails even with the
 * right code and the answer reveals nothing. Success clears this address only.
 */
export function attemptLogin(
  input: unknown,
  ctx: { env: Pick<AuthEnv, 'ADMIN_SECRET' | 'SESSION_SECRET'>; ip: string; limiter: LoginLimiter; now?: number },
): LoginResult {
  const now = ctx.now ?? Date.now();
  if (ctx.limiter.isLocked(ctx.ip, now)) return { ok: false, error: 'locked' };

  if (typeof input !== 'string' || !accessCodeMatches(input, ctx.env.ADMIN_SECRET)) {
    // The log says that it happened, not who: no address, no attempted code.
    if (ctx.limiter.recordFailure(ctx.ip, now)) console.warn('Login locked for one address after 5 failed attempts in 15 minutes.');
    return { ok: false, error: 'mismatch' };
  }

  ctx.limiter.clear(ctx.ip);
  return { ok: true, token: createSessionToken(ctx.env, now) };
}
