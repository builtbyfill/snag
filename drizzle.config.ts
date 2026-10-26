import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';
import { migrationUrl, sslConfig } from './lib/db/connection';

// Host dev reads .env; in Compose the migrate service gets DATABASE_URL from its environment.
// Variables already set in the shell win over .env (loadEnvFile never overrides), which is how
// `npm run db:migrate` reaches Supabase: DIRECT_URL and DATABASE_SSL_CA set for that one terminal.
if (existsSync('.env')) process.loadEnvFile('.env');

const url = migrationUrl();
const ssl = sslConfig();

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  // drizzle-kit's { url } form takes no TLS options, so a verified connection is spelled out.
  dbCredentials: ssl ? { ...credentials(url), ssl } : { url },
  verbose: true,
  strict: true,
});

function credentials(raw: string) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'postgres',
  };
}
