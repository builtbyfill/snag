// Vitest global setup: rebuilds the snag_test database from drizzle/ before every test run.
// The developer's own `snag` database is never touched. If Postgres isn't reachable, DB tests
// fail with a hint and every other test still runs.
import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string | null;
    testDatabaseError: string | null;
  }
}

const TEST_DB = 'snag_test';

export default async function setup(project: TestProject) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL;

  try {
    if (!url || url.includes('replace-with-')) throw new Error('DATABASE_URL is not set in .env');
    const testUrl = new URL(url);
    testUrl.pathname = `/${TEST_DB}`;

    // CREATE/DROP DATABASE can't run inside the database being dropped, so connect to the main one.
    const admin = new Client({ connectionString: url });
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${TEST_DB}`);
    } finally {
      await admin.end();
    }

    const pool = new Pool({ connectionString: testUrl.toString(), max: 1 });
    try {
      await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
    } finally {
      await pool.end();
    }

    project.provide('testDatabaseUrl', testUrl.toString());
    project.provide('testDatabaseError', null);
  } catch (error) {
    project.provide('testDatabaseUrl', null);
    project.provide('testDatabaseError', `${(error as Error).message}. Start Postgres with: docker compose up -d db`);
  }
}
