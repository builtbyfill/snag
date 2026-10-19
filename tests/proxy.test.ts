import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import { proxy } from '@/proxy';

const env = { ADMIN_SECRET: 'access-code-for-tests-only', SESSION_SECRET: 's'.repeat(44), IP_HASH_SECRET: 'i'.repeat(44) };

beforeEach(() => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
});
afterEach(() => vi.unstubAllEnvs());

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });

describe('proxy', () => {
  it('sends a dashboard page without a session to /login', () => {
    const res = proxy(request('/dashboard?project=x'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('answers an image path without a session with 404, not a redirect', () => {
    for (const path of ['/dashboard/images/0b5c3f0e-8a65-4b8e-9d1f-1f2a3b4c5d6e', '/dashboard/images/x?w=320']) {
      const res = proxy(request(path, 'forged.cookie'));
      expect(res.status).toBe(404);
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('lets a request with a valid session through', () => {
    const token = createSessionToken(env);
    for (const path of ['/dashboard', '/dashboard/images/x']) {
      expect(proxy(request(path, token)).headers.get('x-middleware-next')).toBe('1');
    }
  });
});
