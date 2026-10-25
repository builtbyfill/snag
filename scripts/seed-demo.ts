// npm run seed:demo             — the four demo projects and their reports, from stored results
// npm run seed:demo -- --extract — run the real extraction once and write seed/demo/results.json
// Idempotent; never touches eval/ or the Clinic booking seed.
import { existsSync, writeFileSync } from 'node:fs';
import { createDb } from '@/lib/db/client';
import { readDatabaseEnv, readExtractionEnv } from '@/lib/env';
import { runExtraction } from '@/lib/extraction/run';
import { createLocalStorage } from '@/lib/storage';
import { collectDemoResults, DEMO_PROJECTS, demoTicketId, readDemoResults, seedDemoTickets } from './seed-demo-data';

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const extract = process.argv.includes('--extract');
  // The screenshots are local only (git-ignored, like eval/images); they are made from the eval captures.
  if (!existsSync('seed/demo/images')) {
    throw new Error('seed/demo/images is missing. Build it from the eval captures with `npx tsx scripts/demo-images.ts` first.');
  }
  const { db, pool } = createDb(readDatabaseEnv().DATABASE_URL);
  const storage = createLocalStorage(process.env.UPLOAD_DIR ?? './.uploads');
  try {
    const results = readDemoResults();
    if (!results && !extract) throw new Error('seed/demo/results.json is missing. Run with --extract once (uses the API key).');
    const { inserted, pending, projects: seeded } = await seedDemoTickets(db, storage, { results });
    console.log(`Demo: ${inserted.length} report(s) added, ${pending.length} pending.`);
    if (extract && pending.length > 0) {
      const env = readExtractionEnv();
      for (const caseId of pending) {
        const result = await runExtraction(demoTicketId(caseId), { db, storage });
        console.log(`  ${caseId}: ${result.state}${'attempts' in result ? ` after ${result.attempts} attempt(s)` : ''}`);
      }
      const collected = await collectDemoResults(db, env.EXTRACTION_MODEL);
      writeFileSync('seed/demo/results.json', JSON.stringify(collected, null, 2) + '\n');
      console.log(`Wrote seed/demo/results.json (${Object.keys(collected.tickets).length} tickets).`);
    } else if (pending.length > 0) {
      console.log('Some tickets have no stored result; run with --extract to fill them.');
    }
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    for (const p of DEMO_PROJECTS) console.log(`${p.name} → ${appUrl}/r/${seeded[p.key].slug}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
