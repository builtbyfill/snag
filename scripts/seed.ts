// npm run seed — idempotent; safe to run again at any time.
import { existsSync } from 'node:fs';
import { createDb } from '@/lib/db/client';
import { migrationUrl } from '@/lib/db/connection';
import { readDatabaseEnv } from '@/lib/env';
import { getStorage } from '@/lib/storage';
import { SEED_PROJECTS, seedProjects, seedTickets } from './seed-data';

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  // DIRECT_URL (Supabase's session pooler) when set, like migrations; else DATABASE_URL.
  const { db, pool } = createDb(readDatabaseEnv({ DATABASE_URL: migrationUrl() }).DATABASE_URL);
  try {
    await seedProjects(db);
    // Same storage the app reads: ./.uploads on the host, /data/uploads in Compose, or the
    // Supabase bucket when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
    await seedTickets(db, getStorage());
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
