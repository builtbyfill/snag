// Eval runner. Calls the same extractTicket the app calls; never touches the database.
//
//   npm run eval                    all cases, scored
//   npm run eval -- --only 001      one case
//   npm run eval -- --review        print model output beside the reference for every non-matching field
//   npm run eval -- --runs 3        repeat each case and report per-field agreement (costs N× credits)
//
// Writes eval/results/<timestamp>.json (git-ignored) with every attempt, for offline comparison.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readExtractionEnv } from '@/lib/env';
import { extractTicket, type ExtractionOutcome, type ExtractionOutput } from '@/lib/extraction';
import type { ImageMime } from '@/lib/extraction/image';
import { PROMPT_VERSION } from '@/lib/extraction/prompt';
import { EvalCases, Verdicts, type EvalCase } from './files';
import {
  FIELDS, agreement, confidenceCheck, scoreCase, summarize, usedZodRetry,
  type CaseRow, type CaseScore, type FieldName, type FieldVerdict, type Reference,
} from './score';

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = readExtractionEnv(); // fails fast, naming the variable, never printing its value

  const only = argValue('--only');
  const runs = Number(argValue('--runs') ?? 1);
  const review = process.argv.includes('--review');
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) throw new Error('--runs must be a whole number from 1 to 5');

  const cases = EvalCases.parse(await readJson('cases.json'));
  const verdicts = existsSync(path.join(here, 'verdicts.json')) ? Verdicts.parse(await readJson('verdicts.json')) : {};
  const selected = only ? cases.filter((c) => c.id === only) : cases;
  if (selected.length === 0) throw new Error(only ? `No case with id ${only}` : 'eval/cases.json has no cases');

  const startedAt = new Date();
  console.log(
    `Model ${env.EXTRACTION_MODEL}@${PROMPT_VERSION} · max edge ${env.EXTRACTION_MAX_EDGE}px · ` +
      `${selected.length} case(s) × ${runs} run(s) = ${selected.length * runs} extraction(s)\n`,
  );

  const results: { evalCase: EvalCase; outcomes: ExtractionOutcome[]; scores: CaseScore[] }[] = [];
  for (const c of selected) {
    const image = await readFile(path.join(here, c.image));
    const mimeType = await sniff(image);
    const outcomes: ExtractionOutcome[] = [];
    for (let r = 0; r < runs; r++) {
      progress(`  extracting ${c.id}${runs > 1 ? ` (run ${r + 1}/${runs})` : ''}…`);
      outcomes.push(await extractTicket({ image, mimeType, sentence: c.sentence }, { env }));
    }
    const scores = outcomes.map((o) => scoreCase(o.ok ? o.output : null, c.reference, verdicts[c.id]));
    results.push({ evalCase: c, outcomes, scores });
  }
  progress('');

  // The table and the summary use the first run of each case.
  const rows: CaseRow[] = results.map(({ evalCase, outcomes, scores }) => ({
    id: evalCase.id,
    confidence: outcomes[0].ok ? outcomes[0].output.confidence : null,
    zodRetry: usedZodRetry(outcomes[0].attempts),
    nonTechnicalAuthor: evalCase.nonTechnicalAuthor,
    score: scores[0],
  }));

  printTable(results);
  const summary = summarize(rows);
  console.log(
    `\nAccepted ${summary.accepted}/${summary.cases} (${summary.acceptedPct}%)   Invented fields: ${summary.inventedFields}   ` +
      `Zod retries used: ${summary.zodRetries}/${summary.cases}   ` +
      `Mean confidence accepted ${fmt(summary.meanConfidenceAccepted)} / not accepted ${fmt(summary.meanConfidenceNotAccepted)}` +
      (summary.overrides ? `   Manual overrides: ${summary.overrides}` : ''),
  );
  console.log(`Sentences by a real non-technical author: ${summary.nonTechnicalAuthors}/${summary.cases}`);

  const check = confidenceCheck(rows);
  if ('skipped' in check) {
    console.log(`Confidence check: skipped. ${check.skipped}`);
  } else {
    console.log(
      `Confidence check: 5 lowest-confidence = {${check.lowest.join(', ')}}; 5 most-edited = {${check.mostEdited.join(', ')}}; ` +
        `overlap ${check.overlap} → ${check.decision === 'drop' ? 'drop confidence from the badge rule, keep the field rules' : 'keep confidence in the badge rule, tune the threshold'}`,
    );
    console.log('  badge when confidence < t:   t     badged  precision  recall');
    for (const t of check.thresholds) {
      console.log(`                              ${t.threshold.toFixed(1)}   ${String(t.badged).padStart(6)}  ${t.precision.toFixed(2).padStart(9)}  ${t.recall.toFixed(2).padStart(6)}`);
    }
  }

  let agreementByField: Record<FieldName, number> | null = null;
  if (runs > 1) {
    agreementByField = agreement(results.map((r) => r.scores));
    console.log(`Agreement across ${runs} runs (cases where every run gave the same verdict): ` +
      FIELDS.map((f) => `${f} ${agreementByField![f]}%`).join(' · '));
  }

  if (review) printReview(results);

  const file = await writeResults(startedAt, { env, runs, results, summary, check, agreementByField });
  console.log(`\nFull results: ${path.relative(process.cwd(), file)}`);
}

// ── output ──────────────────────────────────────────────────────────────

const COLUMNS: [FieldName, string][] = [
  ['title', 'title'], ['location', 'where'], ['actualResult', 'what'], ['priority', 'prio'],
  ['tags', 'tags'], ['expectedResult', 'expct'], ['stepsToReproduce', 'steps'],
];

function cell(v: FieldVerdict): string {
  const mark = v.verdict === 'match' ? (v.null ? '✓(null)' : '✓') : v.verdict === 'edit' ? '✗' : 'INVENTED';
  return v.overridden ? `${mark}*` : mark;
}

function printTable(results: { evalCase: EvalCase; outcomes: ExtractionOutcome[]; scores: CaseScore[] }[]) {
  const header = ['id ', 'conf', ...COLUMNS.map(([, label]) => label), 'edits', 'verdict'];
  const lines = results.map(({ evalCase, outcomes, scores }) => {
    const outcome = outcomes[0];
    const score = scores[0];
    const fields = score.fields;
    const conf = outcome.ok ? outcome.output.confidence.toFixed(2) : '  - ';
    const cells = COLUMNS.map(([f]) => (fields ? cell(fields[f]) : '-'));
    const verdict =
      score.verdict === 'failed' ? `FAILED: ${firstLine(outcome.ok ? '' : outcome.error)}`
        : score.verdict === 'invented' ? `FAIL: invented ${score.invented.join(', ')}`
          : score.verdict === 'accepted' ? 'accepted' : 'not accepted';
    const ask = outcome.ok && askClient(outcome.output, evalCase.sentence) ? '   ask-client' : '';
    return [evalCase.id, conf, ...cells, String(score.edits), verdict + ask];
  });
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => (i === header.length - 1 ? 0 : l[i].length))));
  const pad = (row: string[]) => row.map((c, i) => (i === row.length - 1 ? c : c.padEnd(widths[i]))).join('  ');
  console.log(pad(header));
  for (const line of lines) console.log(pad(line));
  if (results.some((r) => r.scores[0].overrides > 0)) console.log('* = manual override from eval/verdicts.json');
}

function printReview(results: { evalCase: EvalCase; outcomes: ExtractionOutcome[]; scores: CaseScore[] }[]) {
  console.log('\n── review: non-matching fields (first run) ──');
  for (const { evalCase, outcomes, scores } of results) {
    const outcome = outcomes[0];
    const fields = scores[0].fields;
    if (!outcome.ok || !fields) {
      console.log(`\n${evalCase.id}: extraction failed\n  ${(outcome.ok ? '' : outcome.error).replaceAll('\n', '\n  ')}`);
      continue;
    }
    const misses = FIELDS.filter((f) => fields[f].verdict !== 'match');
    if (misses.length === 0) continue;
    console.log(`\n${evalCase.id}: «${evalCase.sentence}»`);
    for (const f of misses) {
      console.log(`  ${f} [${cell(fields[f])}]`);
      console.log(`    model:     ${show(modelValue(outcome.output, f))}`);
      console.log(`    reference: ${show(evalCase.reference[f])}`);
    }
  }
  console.log('\nTo overrule a verdict, add it to eval/verdicts.json, e.g. { "001": { "title": "match" } }. Overrides are counted separately.');
}

function modelValue(out: ExtractionOutput, f: FieldName): unknown {
  if (f === 'expectedResult' || f === 'stepsToReproduce') return out.inferred[f];
  return out.observed[f];
}

// The product's Ask client rule (scope.md), shown next to the verdict for comparison.
function askClient(out: ExtractionOutput, sentence: string): boolean {
  return out.confidence < 0.6 || out.observed.actualResult === null || (out.observed.location === 'unknown' && sentence === '');
}

// A one-line progress indicator that overwrites itself; only on an interactive terminal.
function progress(text: string) {
  if (process.stdout.isTTY) process.stdout.write(`\r${text.padEnd(60)}\r`);
}

const show = (v: unknown) => JSON.stringify(v);
const fmt = (n: number | null) => (n === null ? '-' : n.toFixed(2));
const firstLine = (s: string) => s.split('\n')[0];

// ── files ───────────────────────────────────────────────────────────────

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(here, name), 'utf8'));
}

async function writeResults(
  startedAt: Date,
  data: {
    env: { EXTRACTION_MODEL: string; EXTRACTION_MAX_EDGE: number };
    runs: number;
    results: { evalCase: EvalCase; outcomes: ExtractionOutcome[]; scores: CaseScore[] }[];
    summary: ReturnType<typeof summarize>;
    check: ReturnType<typeof confidenceCheck>;
    agreementByField: Record<FieldName, number> | null;
  },
): Promise<string> {
  const dir = path.join(here, 'results');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${startedAt.toISOString().replace(/[:.]/g, '-')}.json`);
  const body = {
    settings: {
      startedAt: startedAt.toISOString(),
      model: data.env.EXTRACTION_MODEL,
      promptVersion: PROMPT_VERSION,
      maxEdge: data.env.EXTRACTION_MAX_EDGE,
      runs: data.runs,
    },
    summary: data.summary,
    confidenceCheck: data.check,
    agreement: data.agreementByField,
    cases: data.results.map(({ evalCase, outcomes, scores }) => ({
      id: evalCase.id,
      reference: evalCase.reference satisfies Reference,
      runs: outcomes.map((outcome, i) => ({ score: scores[i], outcome })),
    })),
  };
  await writeFile(file, JSON.stringify(body, null, 2));
  return file;
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
