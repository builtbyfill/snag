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

const secret = (min: number) =>
  notPlaceholder(z.string({ error: 'is required' }).min(min, `must be at least ${min} characters`));

const ReportEnv = z.object({
  // HMAC key for reporter IP hashes only (one key, one purpose).
  IP_HASH_SECRET: secret(32),
  UPLOAD_DIR: z.string().min(1).default('./.uploads'),
});
export type ReportEnv = z.infer<typeof ReportEnv>;

/** Variables the public report path needs: IP hashing and the uploads folder. */
export function readReportEnv(source: Source = process.env): ReportEnv {
  return parse(ReportEnv, source);
}

const SECRETS = ['ADMIN_SECRET', 'SESSION_SECRET', 'IP_HASH_SECRET'] as const;

const AuthEnv = z
  .object({
    // The dashboard access code, and nothing else.
    ADMIN_SECRET: secret(16),
    // Signs the session cookie only: rotating it logs everyone out and changes nothing else.
    SESSION_SECRET: secret(32),
    IP_HASH_SECRET: secret(32),
    // https:// turns on the Secure cookie flag.
    APP_URL: z.url().default('http://localhost:3000'),
  })
  .superRefine((env, ctx) => {
    // One key, one purpose (spec.md > lib/auth): no two of the three secrets may be equal.
    SECRETS.forEach((later, j) => {
      for (const earlier of SECRETS.slice(0, j)) {
        if (env[later] === env[earlier]) ctx.addIssue({ code: 'custom', path: [later], message: `must differ from ${earlier}` });
      }
    });
  });
export type AuthEnv = z.infer<typeof AuthEnv>;

/**
 * Variables the dashboard login needs. All three secrets are checked together, so key separation
 * holds wherever auth runs; instrumentation.ts also calls this once at startup.
 */
export function readAuthEnv(source: Source = process.env): AuthEnv {
  return parse(AuthEnv, source);
}
