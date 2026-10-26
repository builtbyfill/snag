import type { AuthEnv } from '@/lib/env';
import type { LoginLimiter } from '@/lib/auth/rate-limit';
import { accessCodeMatches, createSessionToken } from '@/lib/auth/session';

export type LoginError = 'mismatch' | 'locked';
export type LoginResult = { ok: true; token: string } | { ok: false; error: LoginError };

/**
 * One login attempt. A locked address isn't checked at all, so the sixth try fails even with the
 * right code and the answer reveals nothing. Success clears this address only.
 */
export async function attemptLogin(
  input: unknown,
  ctx: { env: Pick<AuthEnv, 'ADMIN_SECRET' | 'SESSION_SECRET' | 'DEMO_ACCESS_CODE'>; ip: string; limiter: LoginLimiter; now?: number },
): Promise<LoginResult> {
  const now = ctx.now ?? Date.now();
  if (await ctx.limiter.isLocked(ctx.ip, now)) return { ok: false, error: 'locked' };

  // The developer's code or, when set, the judges' demo code. Both are always compared, so the
  // time taken doesn't tell which one matched.
  const codes = [ctx.env.ADMIN_SECRET, ctx.env.DEMO_ACCESS_CODE].filter((code): code is string => Boolean(code));
  const matches = typeof input === 'string' && codes.map((code) => accessCodeMatches(input, code)).includes(true);
  if (!matches) {
    // The log says that it happened, not who: no address, no attempted code.
    if (await ctx.limiter.recordFailure(ctx.ip, now)) console.warn('Login locked for one address after 5 failed attempts in 15 minutes.');
    return { ok: false, error: 'mismatch' };
  }

  await ctx.limiter.clear(ctx.ip);
  return { ok: true, token: createSessionToken(ctx.env, now) };
}
