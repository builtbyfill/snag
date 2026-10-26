import { LOGIN_FAILURES_ALLOWED, LOGIN_WINDOW_MS, type LoginLimiter } from '@/lib/auth/rate-limit';

/** The login limiter's rules in memory, for attemptLogin's unit tests (the real one is a table). */
export function createMemoryLoginLimiter(allowed = LOGIN_FAILURES_ALLOWED, windowMs = LOGIN_WINDOW_MS): LoginLimiter {
  const failures = new Map<string, number[]>();
  const recent = (ip: string, now: number) => (failures.get(ip) ?? []).filter((t) => t > now - windowMs);
  return {
    async isLocked(ip, now = Date.now()) {
      return recent(ip, now).length >= allowed;
    },
    async recordFailure(ip, now = Date.now()) {
      const times = [...recent(ip, now), now];
      failures.set(ip, times);
      return times.length === allowed;
    },
    async clear(ip) {
      failures.delete(ip);
    },
  };
}
