// Copies the eval captures the demo uses into seed/demo/images/ at 1x (the captures are 2x), as
// JPEG, so the demo seed ships with the repo at a sane size. Run after eval/capture/capture.mjs.
//   npx tsx scripts/demo-images.ts
import { mkdirSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { DEMO_TICKETS } from './seed-demo-data';

async function main() {
  const OUT = 'seed/demo/images';
  mkdirSync(OUT, { recursive: true });
  for (const t of DEMO_TICKETS) {
    const from = `eval/images/${t.caseId}.png`;
    if (!existsSync(from)) { console.log(`skip ${t.caseId}: ${from} missing`); continue; }
    const meta = await sharp(from).metadata();
    await sharp(from).resize({ width: Math.round(meta.width / 2) }).jpeg({ quality: 86 }).toFile(`${OUT}/${t.caseId}.jpg`);
    console.log(`wrote ${OUT}/${t.caseId}.jpg`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
