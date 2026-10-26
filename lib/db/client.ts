import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import { readDatabaseEnv } from '@/lib/env';
import { describeError } from '@/lib/log';
import { sslConfig } from './connection';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

type Source = Record<string, string | undefined>;

/**
 * Pool settings. Compose and host dev: 5 connections (one Node process, Postgres' default limit
 * of 100 shared with tools). Vercel (VERCEL=1): 2 per instance, since many instances share
 * Supabase's transaction pooler. Queries use pg's unnamed statements, which work through that
 * pooler; named prepared statements (`.prepare(name)`) would not, so none are used.
 */
export function poolConfig(url: string, source: Source = process.env): PoolConfig {
  const ssl = sslConfig(source);
  const max = source.VERCEL === '1' ? 2 : 5;
  // Fail closed: without the CA, pg would connect to Supabase over the internet unencrypted.
  if (!ssl && source.VERCEL === '1') throw new Error('Invalid environment:\n  DATABASE_SSL_CA: is required on Vercel (verified TLS to Supabase)');
  if (!ssl) return { connectionString: url, max };
  // pg lets sslmode in the URL replace the ssl option, which would drop the CA check.
  const parsed = new URL(url);
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) parsed.searchParams.delete(key);
  return { connectionString: parsed.toString(), max, ssl };
}

/** A pool plus a Drizzle instance on it. Scripts and tests own the pool and end it themselves. */
export function createDb(url: string, source: Source = process.env): { db: Db; pool: Pool } {
  const pool = new Pool(poolConfig(url, source));
  // An idle connection the pooler or the network dropped is reported here. Without a listener
  // Node treats it as an uncaught error and the process exits, taking running extractions with
  // it; the pool replaces the connection on the next query.
  pool.on('error', (error) => console.error(`Idle database connection failed: ${describeError(error)}`));
  return { db: drizzle(pool, { schema }), pool };
}

// One pool per server process. Kept on globalThis so dev hot reloads don't open a new pool each time.
const cache = globalThis as unknown as { snagDb?: Db };

export function getDb(): Db {
  cache.snagDb ??= createDb(readDatabaseEnv().DATABASE_URL).db;
  return cache.snagDb;
}
