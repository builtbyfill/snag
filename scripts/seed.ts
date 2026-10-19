// npm run seed — idempotent; safe to run again at any time.
import { existsSync } from 'node:fs';
import { createDb } from '@/lib/db/client';
import { readDatabaseEnv } from '@/lib/env';
import { createLocalStorage } from '@/lib/storage';
import { SEED_PROJECTS, seedProjects, seedTickets } from './seed-data';

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const { db, pool } = createDb(readDatabaseEnv().DATABASE_URL);
  try {
    await seedProjects(db);
    // Same uploads folder the app reads: ./.uploads on the host, /data/uploads in Compose.
    await seedTickets(db, createLocalStorage(process.env.UPLOAD_DIR ?? './.uploads'));
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    for (const p of SEED_PROJECTS) console.log(`Seeded "${p.name}" → report link ${appUrl}/r/${p.slug}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
