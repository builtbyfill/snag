// Connection settings shared by the app's pool, drizzle.config.ts and the scripts. No path
// aliases and no other imports here: drizzle-kit loads this file from drizzle.config.ts.

type Source = Record<string, string | undefined>;

/**
 * Verified TLS when DATABASE_SSL_CA holds a CA certificate (PEM): Supabase signs its pooler
 * certificates with its own CA, which isn't in Node's trust store. Literal "\n" sequences
 * become newlines, so the PEM also survives a one-line env var. Unset or empty: no TLS options
 * (Compose and host dev talk to a local Postgres).
 */
export function sslConfig(source: Source = process.env): { ca: string; rejectUnauthorized: true } | undefined {
  const ca = source.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim();
  return ca ? { ca, rejectUnauthorized: true } : undefined;
}

/**
 * Where migrations and the seed connect: DIRECT_URL (Supabase's session pooler, port 5432) when
 * set, else DATABASE_URL. Compose's migrate service sets only DATABASE_URL, so it is unchanged.
 */
export function migrationUrl(source: Source = process.env): string {
  return source.DIRECT_URL || source.DATABASE_URL || '';
}
