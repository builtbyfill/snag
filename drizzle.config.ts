import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// Host dev reads .env; in Compose the migrate service gets DATABASE_URL from its environment.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  verbose: true,
  strict: true,
});
