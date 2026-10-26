import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, inject } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';

/**
 * Use in a DB-backed test file: gives a Drizzle instance on snag_test and empties every table
 * before each test (TRUNCATE … CASCADE follows the foreign keys from projects down; login_failures
 * stands alone).
 */
export function setupTestDb(): () => Db {
  const url = inject('testDatabaseUrl');
  let connection: ReturnType<typeof createDb> | null = null;

  beforeEach(async () => {
    if (!url) throw new Error(`Test database unavailable: ${inject('testDatabaseError')}`);
    connection ??= createDb(url);
    await connection.db.execute(sql`TRUNCATE projects, login_failures CASCADE`);
  });

  afterAll(async () => {
    await connection?.pool.end();
  });

  return () => {
    if (!connection) throw new Error('setupTestDb: database is only available inside a test');
    return connection.db;
  };
}
