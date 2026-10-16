// Eval scoring: pure functions, no I/O. Implements spec.md > Eval Runner > Matching rules.
import type { ExtractionAttempt, ExtractionOutput } from '@/lib/extraction';
import { VALIDATION_ERROR_PREFIX } from '@/lib/extraction/policy';

export const FIELDS = ['title', 'location', 'actualResult', 'priority', 'tags', 'expectedResult', 'stepsToReproduce'] as const;
export type FieldName = (typeof FIELDS)[number];

/** A keyword, or a list of synonyms of which any one is enough. */
export type Keyword = string | string[];

/** The reference ticket for one eval case. A null inferred field means "nothing supports it; null is correct". */
export type Reference = {
  title: { mustMention: Keyword[] };
  location: { accept: string[] };
  actualResult: { mustMention: Keyword[]; nullable: boolean };
  priority: 'low' | 'medium' | 'high';
  tags: { anyOf: string[] };
  expectedResult: { mustMention: Keyword[]; orNull: boolean } | null;
  /** Each group is a list of keywords that must all appear in one single step. */
  stepsToReproduce: { mustMention: Keyword[][]; maxSteps: number } | null;
};

export type FieldVerdict = { verdict: 'match' | 'edit' | 'invented'; null?: true; overridden?: true };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const mentions = (text: string, k: Keyword) => (Array.isArray(k) ? k : [k]).some((alt) => norm(text).includes(norm(alt)));
const mentionsAll = (text: string, keywords: Keyword[]) => keywords.every((k) => mentions(text, k));

const match = (isNull = false): FieldVerdict => (isNull ? { verdict: 'match', null: true } : { verdict: 'match' });
const edit: FieldVerdict = { verdict: 'edit' };
const invented: FieldVerdict = { verdict: 'invented' };

export function scoreFields(out: ExtractionOutput, ref: Reference): Record<FieldName, FieldVerdict> {
  const { observed, inferred } = out;
  return {
    title: mentionsAll(observed.title, ref.title.mustMention) ? match() : edit,

    // "Is in accept" read as "contains an accepted value": locations are free text.
    location: ref.location.accept.some((a) => norm(observed.location).includes(norm(a))) ? match() : edit,

    actualResult:
      observed.actualResult === null
        ? ref.actualResult.nullable ? match(true) : edit
        : mentionsAll(observed.actualResult, ref.actualResult.mustMention) ? match() : edit,

    priority: observed.priority === ref.priority ? match() : edit,

    tags: observed.tags.some((t) => ref.tags.anyOf.some((a) => norm(a) === norm(t))) ? match() : edit,

    expectedResult: inferredVerdict(inferred.expectedResult, ref.expectedResult, (value, r) =>
      mentionsAll(value, r.mustMention), (r) => r.orNull),

    stepsToReproduce: inferredVerdict(inferred.stepsToReproduce, ref.stepsToReproduce, (steps, r) =>
      steps.length <= r.maxSteps && r.mustMention.every((group) => steps.some((step) => mentionsAll(step, group))),
      () => false),
  };
}

function inferredVerdict<V, R>(
  model: { value: V } | null,
  ref: R | null,
  matches: (value: V, ref: R) => boolean,
  nullAllowed: (ref: R) => boolean,
): FieldVerdict {
  if (ref === null) return model === null ? match(true) : invented;
  if (model === null) return nullAllowed(ref) ? match(true) : edit;
  return matches(model.value, ref) ? match() : edit;
}

export type Overrides = Partial<Record<FieldName, 'match' | 'edit'>>;

export type CaseScore = {
  /** null when extraction failed. */
  fields: Record<FieldName, FieldVerdict> | null;
  edits: number;
  invented: FieldName[];
  /** Manual overrides that changed an automatic verdict. */
  overrides: number;
  verdict: 'accepted' | 'not-accepted' | 'invented' | 'failed';
};

/** Accepted = at most one edit. Any invented field fails the case. A failed extraction counts as seven edits. */
export function scoreCase(out: ExtractionOutput | null, ref: Reference, overrides: Overrides = {}): CaseScore {
  if (out === null) return { fields: null, edits: FIELDS.length, invented: [], overrides: 0, verdict: 'failed' };

  const fields = scoreFields(out, ref);
  let applied = 0;
  for (const [name, value] of Object.entries(overrides) as [FieldName, 'match' | 'edit'][]) {
    if (fields[name].verdict === value) continue;
    fields[name] = { verdict: value, overridden: true };
    applied++;
  }

  const edits = FIELDS.filter((f) => fields[f].verdict !== 'match').length;
  const invented = FIELDS.filter((f) => fields[f].verdict === 'invented');
  const verdict = invented.length > 0 ? 'invented' : edits <= 1 ? 'accepted' : 'not-accepted';
  return { fields, edits, invented, overrides: applied, verdict };
}

/** True when the second attempt was the retry after a validation failure. */
export function usedZodRetry(attempts: ExtractionAttempt[]): boolean {
  return attempts.length > 1 && (attempts[0].error ?? '').startsWith(VALIDATION_ERROR_PREFIX);
}

export type CaseRow = { id: string; confidence: number | null; zodRetry: boolean; nonTechnicalAuthor: boolean; score: CaseScore };

export function summarize(rows: CaseRow[]) {
  const accepted = rows.filter((r) => r.score.verdict === 'accepted');
  const others = rows.filter((r) => r.score.verdict !== 'accepted');
  return {
    cases: rows.length,
    nonTechnicalAuthors: rows.filter((r) => r.nonTechnicalAuthor).length,
    accepted: accepted.length,
    acceptedPct: rows.length ? Math.round((accepted.length / rows.length) * 100) : 0,
    inventedFields: rows.reduce((n, r) => n + r.score.invented.length, 0),
    zodRetries: rows.filter((r) => r.zodRetry).length,
    overrides: rows.reduce((n, r) => n + r.score.overrides, 0),
    meanConfidenceAccepted: mean(accepted.map((r) => r.confidence)),
    meanConfidenceNotAccepted: mean(others.map((r) => r.confidence)),
  };
}

function mean(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? Math.round((known.reduce((a, b) => a + b, 0) / known.length) * 100) / 100 : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * scope.md decision rule: if the five lowest-confidence tickets share at most one with the five
 * most-edited tickets, confidence leaves the badge rule; otherwise the 0.6 threshold is tuned.
 * The threshold table shows, for "badge when confidence < t", how many tickets get the badge,
 * what share of them really needed edits (precision) and what share of those got it (recall).
 */
export function confidenceCheck(rows: CaseRow[]) {
  const scored = rows.filter((r): r is CaseRow & { confidence: number } => r.confidence !== null && r.score.fields !== null);
  if (scored.length < 10) return { skipped: `Needs at least 10 extracted cases (have ${scored.length}).` } as const;

  const byId = (a: CaseRow, b: CaseRow) => a.id.localeCompare(b.id);
  const lowest = [...scored].sort((a, b) => a.confidence - b.confidence || byId(a, b)).slice(0, 5).map((r) => r.id);
  const mostEdited = [...scored].sort((a, b) => b.score.edits - a.score.edits || byId(a, b)).slice(0, 5).map((r) => r.id);
  const overlap = lowest.filter((id) => mostEdited.includes(id)).length;

  const needsEdits = scored.filter((r) => r.score.verdict !== 'accepted');
  const thresholds = [0.4, 0.5, 0.6, 0.7, 0.8].map((threshold) => {
    const badged = scored.filter((r) => r.confidence < threshold);
    const hits = badged.filter((r) => r.score.verdict !== 'accepted').length;
    return {
      threshold,
      badged: badged.length,
      precision: badged.length ? round2(hits / badged.length) : 0,
      recall: needsEdits.length ? round2(hits / needsEdits.length) : 0,
    };
  });

  return { lowest, mostEdited, overlap, decision: overlap <= 1 ? 'drop' : 'tune', thresholds } as const;
}

/** For --runs N: per field, the share of cases (in %) where every run gave the same verdict. */
export function agreement(runsPerCase: CaseScore[][]): Record<FieldName, number> {
  const verdictOf = (s: CaseScore, f: FieldName) => s.fields?.[f].verdict ?? 'failed';
  return Object.fromEntries(
    FIELDS.map((f) => {
      const stable = runsPerCase.filter((runs) => runs.every((s) => verdictOf(s, f) === verdictOf(runs[0], f))).length;
      return [f, runsPerCase.length ? Math.round((stable / runsPerCase.length) * 100) : 0];
    }),
  ) as Record<FieldName, number>;
}
