// The session gate inside the admin entry points themselves, with proxy.ts out of the picture:
// a server action or route handler must refuse on its own, before it reaches the database.
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken } from '@/lib/auth/session';

const env = { ADMIN_SECRET: 'access-code-for-tests-only', SESSION_SECRET: 's'.repeat(44), IP_HASH_SECRET: 'i'.repeat(44) };
const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'snag_session' && cookie.value ? { name, value: cookie.value } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('@/lib/db/client', () => ({
  getDb: () => {
    throw new Error('database reached');
  },
}));

beforeEach(() => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  cookie.value = undefined;
});
afterEach(() => vi.unstubAllEnvs());

const isRedirectToLogin = (error: unknown) => String((error as { digest?: string }).digest).includes('/login');

describe('createProjectAction', () => {
  const form = () => {
    const data = new FormData();
    data.set('name', 'Injected project');
    return data;
  };

  it('redirects to /login without a session, before touching the database', async () => {
    const { createProjectAction } = await import('@/app/actions/projects');
    for (const value of [undefined, 'eyJpYXQiOjEsImV4cCI6OTk5OTk5OTk5OX0.forged']) {
      cookie.value = value;
      const error = await createProjectAction({ error: null, id: null }, form()).catch((e: unknown) => e);
      expect(isRedirectToLogin(error)).toBe(true);
    }
  });

  it('goes on to the database with a valid session', async () => {
    const { createProjectAction } = await import('@/app/actions/projects');
    cookie.value = createSessionToken(env);
    await expect(createProjectAction({ error: null, id: null }, form())).rejects.toThrow('database reached');
  });
});

describe('the image route', () => {
  const get = async () => {
    const { GET } = await import('@/app/(admin)/dashboard/images/[ticketId]/route');
    return GET(new NextRequest('http://localhost:3000/dashboard/images/5eed0001-0000-4000-8000-000000000001?w=320'), {
      params: Promise.resolve({ ticketId: '5eed0001-0000-4000-8000-000000000001' }),
    });
  };

  it('answers 404 without a session, before touching the database', async () => {
    const res = await get();
    expect(res.status).toBe(404);
    expect(res.headers.get('location')).toBeNull();
  });

  it('goes on to the database with a valid session', async () => {
    cookie.value = createSessionToken(env);
    await expect(get()).rejects.toThrow('database reached');
  });
});

describe('retryExtractionAction', () => {
  it('redirects to /login without a session, before touching the database', async () => {
    const { retryExtractionAction } = await import('@/app/actions/tickets');
    const error = await retryExtractionAction('5eed0003-0000-4000-8000-000000000003').catch((e: unknown) => e);
    expect(isRedirectToLogin(error)).toBe(true);
  });

  it('goes on to the database with a valid session', async () => {
    const { retryExtractionAction } = await import('@/app/actions/tickets');
    cookie.value = createSessionToken(env);
    await expect(retryExtractionAction('5eed0003-0000-4000-8000-000000000003')).rejects.toThrow('database reached');
  });
});
