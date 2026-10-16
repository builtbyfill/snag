import { z } from 'zod';

// Values in .env.example that must be replaced start with this marker.
const PLACEHOLDER = 'replace-with-';

const notPlaceholder = (s: z.ZodString) =>
  s.refine((v) => !v.includes(PLACEHOLDER), 'still holds the placeholder from .env.example');

const ExtractionEnv = z.object({
  ANTHROPIC_API_KEY: notPlaceholder(z.string({ error: 'is required' }).min(1, 'is required')),
  EXTRACTION_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
  EXTRACTION_MAX_EDGE: z.coerce.number().int().min(200).max(8000).default(1568),
});
export type ExtractionEnv = z.infer<typeof ExtractionEnv>;

type Source = Record<string, string | undefined>;

function parse<T extends z.ZodType>(schema: T, source: Source): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  // Name the variable and the rule, never the value.
  const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment:\n${lines.join('\n')}`);
}

/** Variables the extraction module needs (also used by the eval runner, which has no database). */
export function readExtractionEnv(source: Source = process.env): ExtractionEnv {
  return parse(ExtractionEnv, source);
}

const DatabaseEnv = z.object({
  DATABASE_URL: notPlaceholder(z.string({ error: 'is required' }).min(1, 'is required')),
});
export type DatabaseEnv = z.infer<typeof DatabaseEnv>;

export function readDatabaseEnv(source: Source = process.env): DatabaseEnv {
  return parse(DatabaseEnv, source);
}

const ReportEnv = z.object({
  // HMAC key for reporter IP hashes only (one key, one purpose).
  IP_HASH_SECRET: notPlaceholder(z.string({ error: 'is required' }).min(32, 'must be at least 32 characters')),
  UPLOAD_DIR: z.string().min(1).default('./.uploads'),
});
export type ReportEnv = z.infer<typeof ReportEnv>;

/** Variables the public report path needs: IP hashing and the uploads folder. */
export function readReportEnv(source: Source = process.env): ReportEnv {
  return parse(ReportEnv, source);
}
