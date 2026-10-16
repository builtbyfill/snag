// Schemas for eval/cases.json and eval/verdicts.json. Strict, so a typo in a reference
// fails loudly instead of being scored as an empty rule.
import { z } from 'zod';
import { FIELDS } from './score';

const Keywords = z.array(z.string().min(1));
// A keyword, or a list of synonyms of which any one is enough.
const MentionList = z.array(z.union([z.string().min(1), z.array(z.string().min(1)).min(2)]));

export const ReferenceSchema = z.strictObject({
  title: z.strictObject({ mustMention: MentionList.min(1) }),
  location: z.strictObject({ accept: Keywords.min(1) }),
  actualResult: z.strictObject({ mustMention: MentionList, nullable: z.boolean() }),
  priority: z.enum(['low', 'medium', 'high']),
  tags: z.strictObject({ anyOf: Keywords.min(1) }),
  expectedResult: z.strictObject({ mustMention: MentionList, orNull: z.boolean() }).nullable(),
  stepsToReproduce: z.strictObject({ mustMention: z.array(MentionList.min(1)), maxSteps: z.number().int().min(1) }).nullable(),
});

export const EvalCase = z.strictObject({
  id: z.string().regex(/^\d{3}$/),
  image: z.string().startsWith('images/'),
  sentence: z.string().min(10),
  /** Who wrote the sentence, e.g. "friend, non-technical, Bosnian". The README claim depends on it. */
  author: z.string().min(3),
  /** True when a real non-technical person wrote the sentence; the summary counts these. */
  nonTechnicalAuthor: z.boolean(),
  reference: ReferenceSchema,
  notes: z.string().optional(),
});
export type EvalCase = z.infer<typeof EvalCase>;

export const EvalCases = z.array(EvalCase).refine(
  (cases) => new Set(cases.map((c) => c.id)).size === cases.length,
  'case ids must be unique',
);

const FieldOverride = z.enum(['match', 'edit']);
export const Verdicts = z.record(
  z.string().regex(/^\d{3}$/),
  z.strictObject(Object.fromEntries(FIELDS.map((f) => [f, FieldOverride.optional()])) as Record<(typeof FIELDS)[number], z.ZodOptional<typeof FieldOverride>>),
);
