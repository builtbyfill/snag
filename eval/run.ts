// Eval runner. Calls the same extractTicket the app calls; never touches the database.
// Slice 1: runs the selected cases and prints each ExtractionOutcome. Scoring comes in slice 2.
//
//   npm run eval                 all cases
//   npm run eval -- --only 001   one case
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readExtractionEnv } from '@/lib/env';
import { extractTicket } from '@/lib/extraction';
import type { ImageMime } from '@/lib/extraction/image';

type EvalCase = { id: string; image: string; sentence: string };

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = readExtractionEnv(); // fails fast, naming the variable, never printing its value

  const only = argValue('--only');
  const cases: EvalCase[] = JSON.parse(await readFile(path.join(here, 'cases.json'), 'utf8'));
  const selected = only ? cases.filter((c) => c.id === only) : cases;
  if (selected.length === 0) throw new Error(only ? `No case with id ${only}` : 'eval/cases.json has no cases');

  console.log(`Model ${env.EXTRACTION_MODEL} · max edge ${env.EXTRACTION_MAX_EDGE}px · ${selected.length} case(s)\n`);

  for (const c of selected) {
    const image = await readFile(path.join(here, c.image));
    const mimeType = await sniff(image);
    const outcome = await extractTicket({ image, mimeType, sentence: c.sentence }, { env });

    console.log(`── case ${c.id} ── ${outcome.ok ? 'ok' : 'FAILED'}`);
    for (const a of outcome.attempts) {
      console.log(
        `   attempt ${a.attempt}: ${a.result} · ${a.model} · in ${a.inputTokens ?? '-'} / out ${a.outputTokens ?? '-'} tokens · ${a.durationMs} ms` +
          (a.error ? `\n     error: ${a.error.replaceAll('\n', '\n            ')}` : ''),
      );
    }
    console.log(JSON.stringify(outcome.ok ? outcome.output : { error: outcome.error }, null, 2));
    console.log();
  }
}

async function sniff(image: Buffer): Promise<ImageMime> {
  const { format } = await sharp(image).metadata();
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  throw new Error(`Unsupported image format: ${format}`);
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
