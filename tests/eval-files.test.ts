import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EvalCases, Verdicts } from '@/eval/files';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('committed eval files', () => {
  it('eval/cases.json matches the case schema', () => {
    expect(EvalCases.safeParse(json('eval/cases.json')).error?.issues).toBeUndefined();
  });

  it('eval/verdicts.json matches the override schema', () => {
    expect(Verdicts.safeParse(json('eval/verdicts.json')).error?.issues).toBeUndefined();
  });
});

describe('draft cases', () => {
  it('accepts a case with an empty sentence and empty reference as a draft, and tells it apart', async () => {
    const { isDraft } = await import('@/eval/files');
    const cases = EvalCases.parse(json('eval/cases.json'));
    const drafts = cases.filter(isDraft);
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((c) => c.sentence === '' && c.reference.expectedResult === null)).toBe(true);
    expect(cases.filter((c) => !isDraft(c)).map((c) => c.id)).toContain('001');
  });

  it('refuses a half-written case: a sentence with an empty reference is not a draft', () => {
    const cases = json('eval/cases.json') as Record<string, unknown>[];
    const half = { ...cases[1], sentence: 'Ten characters here.' };
    expect(EvalCases.safeParse([half]).success).toBe(false);
  });
});

describe('case schema', () => {
  it('rejects a misspelled reference key instead of scoring it silently', () => {
    const bad = [{
      id: '001', image: 'images/001.png', sentence: 'Ne radi ništa kad kliknem.', author: 'receptionist, Bosnian',
      reference: {
        title: { mustMetion: ['save'] }, location: { accept: ['x'] }, actualResult: { mustMention: [], nullable: true },
        priority: 'low', tags: { anyOf: ['form'] }, expectedResult: null, stepsToReproduce: null,
      },
    }];
    expect(EvalCases.safeParse(bad).success).toBe(false);
  });

  it('rejects an override for a field that does not exist', () => {
    expect(Verdicts.safeParse({ '001': { titel: 'match' } }).success).toBe(false);
  });
});

describe('keyword synonyms in cases.json', () => {
  it('accepts a list of alternatives as one mustMention entry', async () => {
    const { ReferenceSchema } = await import('@/eval/files');
    const r = {
      title: { mustMention: [['details', 'Podaci'], 'step'] }, location: { accept: ['x'] },
      actualResult: { mustMention: [], nullable: true }, priority: 'low', tags: { anyOf: ['form'] },
      expectedResult: null, stepsToReproduce: { mustMention: [[['tap', 'click'], 'save']], maxSteps: 2 },
    };
    expect(ReferenceSchema.safeParse(r).error?.issues).toBeUndefined();
  });
});

describe('case authorship', () => {
  const base = {
    id: '001', image: 'images/001.png', sentence: 'Ne radi ništa kad kliknem.',
    reference: {
      title: { mustMention: ['save'] }, location: { accept: ['x'] }, actualResult: { mustMention: [], nullable: true },
      priority: 'low', tags: { anyOf: ['form'] }, expectedResult: null, stepsToReproduce: null,
    },
  };

  it('requires who wrote the sentence and whether they are non-technical', () => {
    expect(EvalCases.safeParse([base]).success).toBe(false);
    expect(EvalCases.safeParse([{ ...base, author: 'friend, Bosnian' }]).success).toBe(false);
    expect(EvalCases.safeParse([{ ...base, author: 'friend, Bosnian', nonTechnicalAuthor: true }]).success).toBe(true);
  });
});
