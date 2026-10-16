import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { readDatabaseEnv } from '@/lib/env';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

/** A pool plus a Drizzle instance on it. Scripts and tests own the pool and end it themselves. */
export function createDb(url: string): { db: Db; pool: Pool } {
  // max 5: one Node process, a small server, and Postgres' default limit of 100 shared with tools.
  const pool = new Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}

// One pool per server process. Kept on globalThis so dev hot reloads don't open a new pool each time.
const cache = globalThis as unknown as { snagDb?: Db };

export function getDb(): Db {
  cache.snagDb ??= createDb(readDatabaseEnv().DATABASE_URL).db;
  return cache.snagDb;
}
