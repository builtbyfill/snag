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
});
export type ReportEnv = z.infer<typeof ReportEnv>;

/** Variables the public report path needs: IP hashing. */
export function readReportEnv(source: Source = process.env): ReportEnv {
  return parse(ReportEnv, source);
}

const unsetIfEmpty = (v: unknown) => (v === '' ? undefined : v);

const StorageVars = z
  .object({
    UPLOAD_DIR: z.string().min(1).default('./.uploads'),
    // Both set: screenshots go to the private Supabase bucket. Server-only, never NEXT_PUBLIC_.
    SUPABASE_URL: z.preprocess(unsetIfEmpty, z.url({ protocol: /^https$/, error: 'must be an https:// URL' }).optional()),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(unsetIfEmpty, notPlaceholder(z.string()).optional()),
    // Vercel sets VERCEL=1; its filesystem doesn't outlive a request, so local disk is refused there.
    VERCEL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.SUPABASE_URL && !env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({ code: 'custom', path: ['SUPABASE_SERVICE_ROLE_KEY'], message: 'is required when SUPABASE_URL is set' });
    }
    if (env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'is required when SUPABASE_SERVICE_ROLE_KEY is set' });
    }
    if (env.VERCEL === '1' && !env.SUPABASE_URL && !env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'is required on Vercel (no persistent disk)' });
    }
  });

export type StorageEnv = { kind: 'local'; dir: string } | { kind: 'supabase'; url: string; key: string };

/** Where screenshots live: Supabase Storage when both its variables are set, else UPLOAD_DIR on disk. */
export function readStorageEnv(source: Source = process.env): StorageEnv {
  const env = parse(StorageVars, source);
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return { kind: 'supabase', url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
  }
  return { kind: 'local', dir: env.UPLOAD_DIR };
}

const SECRETS = ['ADMIN_SECRET', 'SESSION_SECRET', 'IP_HASH_SECRET'] as const;

const AuthEnv = z
  .object({
    // The dashboard access code, and nothing else.
    ADMIN_SECRET: secret(16),
    // Signs the session cookie only: rotating it logs everyone out and changes nothing else.
    SESSION_SECRET: secret(32),
    IP_HASH_SECRET: secret(32),
    // A second access code for judges, separate from the developer's; empty or unset turns it off.
    // It opens the same dashboard. Removing it stops new sign-ins; rotating SESSION_SECRET also
    // ends the sessions it already opened.
    DEMO_ACCESS_CODE: z.preprocess((v) => (v === '' ? undefined : v), secret(16).optional()),
    // https:// turns on the Secure cookie flag.
    APP_URL: z.url().default('http://localhost:3000').transform((url) => url.replace(/\/+$/, '')),
  })
  .superRefine((env, ctx) => {
    // One key, one purpose (spec.md > lib/auth): no two of the three secrets may be equal.
    SECRETS.forEach((later, j) => {
      for (const earlier of SECRETS.slice(0, j)) {
        if (env[later] === env[earlier]) ctx.addIssue({ code: 'custom', path: [later], message: `must differ from ${earlier}` });
      }
    });
    for (const name of SECRETS) {
      if (env.DEMO_ACCESS_CODE === env[name]) ctx.addIssue({ code: 'custom', path: ['DEMO_ACCESS_CODE'], message: `must differ from ${name}` });
    }
  });
export type AuthEnv = z.infer<typeof AuthEnv>;

/**
 * Variables the dashboard login needs. All three secrets are checked together, so key separation
 * holds wherever auth runs; instrumentation.ts also calls this once at startup.
 */
export function readAuthEnv(source: Source = process.env): AuthEnv {
  return parse(AuthEnv, source);
}
