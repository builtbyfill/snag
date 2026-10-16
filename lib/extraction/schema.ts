import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const Priority = z.enum(['low', 'medium', 'high']);

// An inferred field is either null or a value with the evidence that supports it.
// A filled inferred field cannot arrive without evidence: the schema does the honesty work.
const Inferred = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    evidence: z.string().min(8).max(300)
      .describe('What in the screenshot or sentence supports this. Quote visible text or name the UI element. Required.'),
  }).nullable();

export const ExtractionOutput = z.object({
  observed: z.object({
    title: z.string().min(3).max(90)
      .describe('Short imperative English summary of the problem, e.g. "Save button does nothing on appointment form".'),
    location: z.string().min(1).max(120)
      .describe('Screen, page, URL path or component where it happened, as visible. Exactly "unknown" if not visible.'),
    actualResult: z.string().min(3).max(400).nullable()
      .describe('What actually happened, from the screenshot and sentence only. null if neither shows it.'),
    priority: Priority
      .describe('low: cosmetic; medium: a task is harder; high: a task is blocked or data is at risk.'),
    tags: z.array(z.string().min(2).max(24)).max(5)
      .describe('0–5 lowercase tags such as "form", "booking", "validation", "layout", "auth".'),
  }),
  inferred: z.object({
    expectedResult: Inferred(z.string().min(3).max(400))
      .describe('What should have happened instead. null unless the screenshot or sentence makes it clear.'),
    stepsToReproduce: Inferred(z.array(z.string().min(3).max(200)).min(1).max(8))
      .describe('Steps a developer can follow. null unless the screenshot shows the path the client took.'),
  }),
  confidence: z.number().min(0).max(1)
    .describe('How sure you are the observed fields are right, 0 to 1.'),
  language: z.string().regex(/^[a-z]{2}$/)
    .describe('ISO 639-1 code of the client sentence, e.g. "bs", "hr", "sr", "en".'),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutput>;

/**
 * The request format sent to the API. The API constrains the shape; constraints it cannot
 * express (lengths, ranges, the regex, maxItems) move into descriptions and are enforced
 * locally by `parseExtractionText`.
 */
export const extractionFormat = withPriorityEnum(zodOutputFormat(ExtractionOutput));

// The SDK's transform moves `enum` into the description. The API supports string enums,
// so priority gets its real constraint back and casing/typos can't cost a retry.
function withPriorityEnum<T extends { schema: Record<string, unknown> }>(format: T): T {
  const observed = (format.schema.properties as Record<string, { properties: Record<string, Record<string, unknown>> }>)
    .observed;
  observed.properties.priority = { ...observed.properties.priority, enum: [...Priority.options] };
  return format;
}

export type ParseResult =
  | { ok: true; output: ExtractionOutput }
  | { ok: false; kind: 'invalid_json' | 'validation'; issues: string[] };

/** JSON parse → normalize → validate. Issues are "path: message" lines, fed back on retry. */
export function parseExtractionText(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, kind: 'invalid_json', issues: [`(root): ${(error as Error).message}`] };
  }
  const result = ExtractionOutput.safeParse(normalize(raw));
  if (result.success) return { ok: true, output: result.data };
  return {
    ok: false,
    kind: 'validation',
    issues: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

// Enum casing is not guaranteed by the API, and the generated ask_client column
// compares location to the literal 'unknown', so both are normalized before validation.
function normalize(raw: unknown): unknown {
  const value = trimDeep(raw);
  if (!isRecord(value)) return value;
  if (typeof value.language === 'string') value.language = value.language.toLowerCase();
  const observed = value.observed;
  if (isRecord(observed)) {
    if (typeof observed.priority === 'string') observed.priority = observed.priority.toLowerCase();
    if (typeof observed.location === 'string' && observed.location.toLowerCase() === 'unknown') {
      observed.location = 'unknown';
    }
    if (Array.isArray(observed.tags)) observed.tags = observed.tags.filter((t) => t !== '');
  }
  return value;
}

function trimDeep(value: unknown): unknown {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(trimDeep);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trimDeep(v)]));
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
