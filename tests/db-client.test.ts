import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDb, poolConfig } from '@/lib/db/client';
import { migrationUrl, sslConfig } from '@/lib/db/connection';

const URL_ = 'postgresql://postgres.ref:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
// One line with backslash-n escapes, as a PEM pasted into a single-line env var arrives.
const PEM_ESCAPED = '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----';

afterEach(() => vi.restoreAllMocks());

describe('poolConfig', () => {
  it('uses five connections off Vercel and two on Vercel', () => {
    expect(poolConfig(URL_, {}).max).toBe(5);
    expect(poolConfig(URL_, { VERCEL: '1', DATABASE_SSL_CA: PEM_ESCAPED }).max).toBe(2);
  });

  it('refuses to connect without verified TLS on Vercel', () => {
    expect(() => poolConfig(URL_, { VERCEL: '1' })).toThrow(/DATABASE_SSL_CA: is required on Vercel/);
    expect(() => poolConfig(URL_, { VERCEL: '1', DATABASE_SSL_CA: '' })).toThrow(/DATABASE_SSL_CA/);
  });

  it('adds verified TLS only when DATABASE_SSL_CA is set', () => {
    const config = poolConfig(URL_, { DATABASE_SSL_CA: PEM_ESCAPED });
    expect(config.ssl).toEqual({ ca: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----', rejectUnauthorized: true });
    expect(poolConfig(URL_, { DATABASE_SSL_CA: '' }).ssl).toBeUndefined();
    expect(poolConfig(URL_, {}).ssl).toBeUndefined();
  });

  it('drops sslmode from the URL when the CA is set, so pg cannot override the verified TLS', () => {
    const config = poolConfig(`${URL_}?sslmode=require`, { DATABASE_SSL_CA: PEM_ESCAPED });
    expect(config.connectionString).toBe(URL_);
    // Without a CA the URL is passed through untouched (Compose, host dev).
    expect(poolConfig(`${URL_}?sslmode=require`, {}).connectionString).toBe(`${URL_}?sslmode=require`);
  });
});

describe('createDb', () => {
  it('logs an idle connection error instead of crashing the process', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { pool } = createDb(URL_, {});
    // An 'error' event with no listener throws (and in a server, exits the process).
    expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
    expect(String(log.mock.calls[0])).toMatch(/Idle database connection failed: Error: Connection terminated unexpectedly/);
    await pool.end();
  });
});

describe('sslConfig', () => {
  it('keeps a PEM that already has real newlines', () => {
    expect(sslConfig({ DATABASE_SSL_CA: 'a\nb' })).toEqual({ ca: 'a\nb', rejectUnauthorized: true });
  });
});

describe('migrationUrl', () => {
  it('prefers DIRECT_URL and falls back to DATABASE_URL when it is empty or unset', () => {
    expect(migrationUrl({ DIRECT_URL: 'postgres://direct', DATABASE_URL: 'postgres://pooled' })).toBe('postgres://direct');
    expect(migrationUrl({ DIRECT_URL: '', DATABASE_URL: 'postgres://pooled' })).toBe('postgres://pooled');
    expect(migrationUrl({ DATABASE_URL: 'postgres://pooled' })).toBe('postgres://pooled');
    expect(migrationUrl({})).toBe('');
  });
});
