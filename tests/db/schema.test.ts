import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { projects } from '@/lib/db/schema';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();

describe('test database', () => {
  it('is built from the migrations and accepts a project', async () => {
    await db().insert(projects).values({ name: 'Clinic booking', slug: 'a'.repeat(21) });
    const [row] = await db().select().from(projects).where(eq(projects.slug, 'a'.repeat(21)));
    expect(row.name).toBe('Clinic booking');
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('enforces the unique slug', async () => {
    await db().insert(projects).values({ name: 'One', slug: 'b'.repeat(21) });
    await expect(db().insert(projects).values({ name: 'Two', slug: 'b'.repeat(21) })).rejects.toThrow();
  });
});

describe('row level security (Supabase Data API)', () => {
  it('is on for every table in public, so PostgREST with the anon key reaches nothing', async () => {
    const { rows } = await db().execute(sql`
      select relname from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity
      order by relname`);
    expect(rows).toEqual([]);
  });
});
