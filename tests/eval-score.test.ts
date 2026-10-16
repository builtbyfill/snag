import { describe, expect, it } from 'vitest';
import type { ExtractionOutput } from '@/lib/extraction';
import { agreement, confidenceCheck, scoreCase, summarize, usedZodRetry, type CaseRow, type CaseScore, type Reference } from '@/eval/score';
import type { ExtractionAttempt } from '@/lib/extraction';

function output(over: {
  observed?: Partial<ExtractionOutput['observed']>;
  inferred?: Partial<ExtractionOutput['inferred']>;
  confidence?: number;
} = {}): ExtractionOutput {
  return {
    observed: {
      title: 'Save button does nothing on appointment form',
      location: 'Appointments › New appointment',
      actualResult: 'Tapping Save does nothing; no message appears.',
      priority: 'high',
      tags: ['booking', 'form'],
      ...over.observed,
    },
    inferred: {
      expectedResult: { value: 'The appointment is saved and listed.', evidence: 'Save button on a filled form.' },
      stepsToReproduce: null,
      ...over.inferred,
    },
    confidence: over.confidence ?? 0.7,
    language: 'bs',
  };
}

const reference: Reference = {
  title: { mustMention: ['save', 'appointment'] },
  location: { accept: ['Appointments', '/appointments/new', 'New appointment'] },
  actualResult: { mustMention: ['save', 'nothing'], nullable: false },
  priority: 'high',
  tags: { anyOf: ['booking', 'form', 'appointment'] },
  expectedResult: { mustMention: ['saved'], orNull: false },
  stepsToReproduce: null,
};

const ref = (over: Partial<Reference>): Reference => ({ ...reference, ...over });
const verdict = (out: ExtractionOutput, r: Reference = reference) => scoreCase(out, r).fields!;

describe('field matching', () => {
  it('title: every keyword must appear, case-insensitive', () => {
    expect(verdict(output()).title.verdict).toBe('match');
    expect(verdict(output({ observed: { title: 'SAVE does nothing' } })).title.verdict).toBe('edit');
  });

  it('location: matches when it contains an accepted value, ignoring case and spacing', () => {
    expect(verdict(output({ observed: { location: 'new   APPOINTMENT dialog' } })).location.verdict).toBe('match');
    expect(verdict(output({ observed: { location: 'Settings page' } })).location.verdict).toBe('edit');
  });

  it('location: "unknown" matches only when the reference accepts unknown', () => {
    const unknown = output({ observed: { location: 'unknown' } });
    expect(verdict(unknown).location.verdict).toBe('edit');
    expect(verdict(unknown, ref({ location: { accept: ['unknown'] } })).location.verdict).toBe('match');
  });

  it('actualResult: keywords, or null when the reference allows null', () => {
    expect(verdict(output()).actualResult.verdict).toBe('match');
    const none = output({ observed: { actualResult: null } });
    expect(verdict(none).actualResult.verdict).toBe('edit');
    expect(verdict(none, ref({ actualResult: { mustMention: ['save'], nullable: true } })).actualResult).toEqual({ verdict: 'match', null: true });
  });

  it('priority: must be equal', () => {
    expect(verdict(output()).priority.verdict).toBe('match');
    expect(verdict(output({ observed: { priority: 'medium' } })).priority.verdict).toBe('edit');
  });

  it('tags: at least one accepted tag', () => {
    expect(verdict(output({ observed: { tags: ['layout', 'Booking'] } })).tags.verdict).toBe('match');
    expect(verdict(output({ observed: { tags: [] } })).tags.verdict).toBe('edit');
  });

  describe('expectedResult', () => {
    it('matches its keywords when the reference has a value', () => {
      expect(verdict(output()).expectedResult.verdict).toBe('match');
    });

    it('null is an edit unless the reference says orNull', () => {
      const none = output({ inferred: { expectedResult: null } });
      expect(verdict(none).expectedResult.verdict).toBe('edit');
      expect(verdict(none, ref({ expectedResult: { mustMention: ['saved'], orNull: true } })).expectedResult).toEqual({ verdict: 'match', null: true });
    });

    it('is INVENTED when the reference is null and the model filled it', () => {
      expect(verdict(output(), ref({ expectedResult: null })).expectedResult.verdict).toBe('invented');
    });

    it('both null is a match', () => {
      const none = output({ inferred: { expectedResult: null } });
      expect(verdict(none, ref({ expectedResult: null })).expectedResult).toEqual({ verdict: 'match', null: true });
    });
  });

  describe('stepsToReproduce', () => {
    const steps = (value: string[]) =>
      output({ inferred: { stepsToReproduce: { value, evidence: 'The stepper shows the path.' } } });
    const withSteps = ref({ stepsToReproduce: { mustMention: [['open', 'appointment'], ['tap', 'save']], maxSteps: 3 } });

    it('both null is a match', () => {
      expect(verdict(output()).stepsToReproduce).toEqual({ verdict: 'match', null: true });
    });

    it('is INVENTED when the reference is null and the model wrote steps', () => {
      expect(verdict(steps(['Open the app'])).stepsToReproduce.verdict).toBe('invented');
    });

    it('matches when every keyword group is satisfied by some single step', () => {
      expect(verdict(steps(['Open a new appointment', 'Fill the form', 'Tap Save']), withSteps).stepsToReproduce.verdict).toBe('match');
      // "tap" and "save" appear, but in different steps
      expect(verdict(steps(['Open a new appointment', 'Tap the form', 'Press Save']), withSteps).stepsToReproduce.verdict).toBe('edit');
    });

    it('is an edit when there are more steps than the reference allows', () => {
      expect(verdict(steps(['Open app', 'Open a new appointment', 'Fill form', 'Tap Save']), withSteps).stepsToReproduce.verdict).toBe('edit');
    });

    it('null is an edit when the reference has steps', () => {
      expect(verdict(output(), withSteps).stepsToReproduce.verdict).toBe('edit');
    });
  });
});

describe('case verdict', () => {
  it('accepts a ticket with no edits', () => {
    expect(scoreCase(output(), reference)).toMatchObject({ edits: 0, verdict: 'accepted', invented: [] });
  });

  it('accepts a ticket with exactly one edit', () => {
    expect(scoreCase(output({ observed: { priority: 'low' } }), reference)).toMatchObject({ edits: 1, verdict: 'accepted' });
  });

  it('does not accept two edits', () => {
    const out = output({ observed: { priority: 'low', tags: [] } });
    expect(scoreCase(out, reference)).toMatchObject({ edits: 2, verdict: 'not-accepted' });
  });

  it('fails a ticket with an invented field even when it is the only edit', () => {
    const out = output({ inferred: { stepsToReproduce: { value: ['Open the app'], evidence: 'Visible home screen.' } } });
    expect(scoreCase(out, reference)).toMatchObject({ edits: 1, verdict: 'invented', invented: ['stepsToReproduce'] });
  });

  it('counts a failed extraction as seven edits', () => {
    expect(scoreCase(null, reference)).toMatchObject({ fields: null, edits: 7, verdict: 'failed', invented: [] });
  });

  it('applies manual overrides, marks them, and counts them', () => {
    const out = output({ observed: { priority: 'low', tags: [] } });
    const score = scoreCase(out, reference, { tags: 'match' });
    expect(score.fields!.tags).toEqual({ verdict: 'match', overridden: true });
    expect(score).toMatchObject({ edits: 1, verdict: 'accepted', overrides: 1 });
  });

  it('ignores an override that agrees with the automatic verdict', () => {
    expect(scoreCase(output(), reference, { title: 'match' }).overrides).toBe(0);
  });
});

const attempt = (error: string | null): ExtractionAttempt => ({
  attempt: 1, result: error ? 'failed' : 'succeeded', model: 'm@p1', rawResponse: '{}', parsed: null,
  error, inputTokens: 1, outputTokens: 1, durationMs: 1,
});

describe('usedZodRetry', () => {
  it('is true only when a second attempt followed a validation failure', () => {
    expect(usedZodRetry([attempt('Answer did not pass validation:\nconfidence: too big'), attempt(null)])).toBe(true);
    expect(usedZodRetry([attempt('Request timed out'), attempt(null)])).toBe(false);
    expect(usedZodRetry([attempt(null)])).toBe(false);
  });
});

describe('summarize', () => {
  const row = (id: string, out: ExtractionOutput | null, zodRetry = false, nonTechnicalAuthor = true): CaseRow => ({
    id, confidence: out?.confidence ?? null, zodRetry, nonTechnicalAuthor, score: scoreCase(out, reference),
  });

  it('reports accepted share, invented fields, Zod retries and mean confidence by verdict', () => {
    const rows = [
      row('001', output({ confidence: 0.9 })),
      row('002', output({ confidence: 0.7, observed: { priority: 'low' } }), true),
      row('003', output({ confidence: 0.4, observed: { priority: 'low', tags: [] } })),
      row('004', output({ confidence: 0.6, inferred: { stepsToReproduce: { value: ['Open app'], evidence: 'Home screen.' } } })),
      row('005', null, false, false),
    ];
    expect(summarize(rows)).toEqual({
      cases: 5,
      nonTechnicalAuthors: 4,
      accepted: 2,
      acceptedPct: 40,
      inventedFields: 1,
      zodRetries: 1,
      overrides: 0,
      meanConfidenceAccepted: 0.8,
      meanConfidenceNotAccepted: 0.5,
    });
  });
});

describe('confidenceCheck', () => {
  // Builds a row with a given confidence and edit count (edits come from wrong priority/tags/title/location).
  const rowWith = (id: string, confidence: number, edits: number): CaseRow => {
    const observed: Partial<ExtractionOutput['observed']> = {};
    if (edits > 0) observed.priority = 'low';
    if (edits > 1) observed.tags = [];
    if (edits > 2) observed.title = 'Unrelated';
    if (edits > 3) observed.location = 'Elsewhere';
    return { id, confidence, zodRetry: false, nonTechnicalAuthor: true, score: scoreCase(output({ confidence, observed }), reference) };
  };

  it('needs at least ten scored cases', () => {
    const rows = Array.from({ length: 9 }, (_, i) => rowWith(String(i), 0.5, 0));
    expect(confidenceCheck(rows)).toEqual({ skipped: 'Needs at least 10 extracted cases (have 9).' });
  });

  it('drops confidence from the badge rule when the two sets share at most one case', () => {
    // Low confidence on cases that are fine; most edits on high-confidence cases.
    const rows = [
      ...['a', 'b', 'c', 'd', 'e'].map((id, i) => rowWith(id, 0.2 + i * 0.05, 0)),
      ...['f', 'g', 'h', 'i', 'j'].map((id) => rowWith(id, 0.9, 3)),
    ];
    const check = confidenceCheck(rows);
    expect(check).toMatchObject({
      lowest: ['a', 'b', 'c', 'd', 'e'],
      mostEdited: ['f', 'g', 'h', 'i', 'j'],
      overlap: 0,
      decision: 'drop',
    });
  });

  it('keeps and tunes the threshold when the sets overlap, with precision per threshold', () => {
    const rows = [
      ...['a', 'b', 'c', 'd'].map((id) => rowWith(id, 0.3, 3)), // low confidence, many edits
      rowWith('e', 0.55, 2),
      ...['f', 'g', 'h', 'i', 'j'].map((id) => rowWith(id, 0.9, 0)),
    ];
    const check = confidenceCheck(rows);
    if ('skipped' in check) throw new Error('unexpected skip');
    expect(check.overlap).toBe(5);
    expect(check.decision).toBe('tune');
    // below 0.4: a–d badged, all four not accepted → precision 1, recall 4/5
    expect(check.thresholds.find((t) => t.threshold === 0.4)).toEqual({ threshold: 0.4, badged: 4, precision: 1, recall: 0.8 });
    // below 0.6: a–e badged, all five not accepted → precision 1, recall 1
    expect(check.thresholds.find((t) => t.threshold === 0.6)).toEqual({ threshold: 0.6, badged: 5, precision: 1, recall: 1 });
    expect(check.thresholds.map((t) => t.threshold)).toEqual([0.4, 0.5, 0.6, 0.7, 0.8]);
  });

  it('leaves failed extractions out of the check', () => {
    const rows = [...Array.from({ length: 9 }, (_, i) => rowWith(String(i), 0.5, 0)), { id: 'x', confidence: null, zodRetry: false, nonTechnicalAuthor: true, score: scoreCase(null, reference) }];
    expect(confidenceCheck(rows)).toHaveProperty('skipped');
  });
});

describe('agreement', () => {
  it('reports per field the share of cases where every run gave the same verdict', () => {
    const good = scoreCase(output(), reference);
    const lowPriority = scoreCase(output({ observed: { priority: 'low' } }), reference);
    const runs: CaseScore[][] = [
      [good, good, good],          // case 1: stable
      [good, lowPriority, good],   // case 2: priority wobbles
    ];
    const result = agreement(runs);
    expect(result.title).toBe(100);
    expect(result.priority).toBe(50);
  });

  it('treats a failed run as disagreeing with a successful one', () => {
    const good = scoreCase(output(), reference);
    expect(agreement([[good, scoreCase(null, reference)]]).title).toBe(0);
  });
});

describe('keyword synonyms', () => {
  const synonyms = ref({ title: { mustMention: [['details', 'Podaci'], ['empty', 'not filled', 'placeholder']] } });

  it('a list inside mustMention matches when any one of its alternatives appears', () => {
    expect(verdict(output({ observed: { title: 'Client stuck on Podaci step, fields not filled' } }), synonyms).title.verdict).toBe('match');
    expect(verdict(output({ observed: { title: 'Details step shows placeholder values only' } }), synonyms).title.verdict).toBe('match');
  });

  it('every entry must still be satisfied', () => {
    expect(verdict(output({ observed: { title: 'Cannot proceed past details step' } }), synonyms).title.verdict).toBe('edit');
  });

  it('works inside step groups too', () => {
    const r = ref({ stepsToReproduce: { mustMention: [[['tap', 'click'], 'nastavi']], maxSteps: 3 } });
    const out = output({ inferred: { stepsToReproduce: { value: ['Click Nastavi'], evidence: 'Nastavi button visible.' } } });
    expect(verdict(out, r).stepsToReproduce.verdict).toBe('match');
  });
});
