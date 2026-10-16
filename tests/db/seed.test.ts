import { describe, expect, it } from 'vitest';
import { projects } from '@/lib/db/schema';
import { SEED_PROJECTS, seedProjects } from '@/scripts/seed-data';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();

describe('seedProjects', () => {
  it('creates "Clinic booking" with a fixed 21-character slug', async () => {
    await seedProjects(db());
    const rows = await db().select().from(projects);
    expect(rows.map((r) => r.name)).toEqual(['Clinic booking']);
    expect(rows[0].slug).toBe(SEED_PROJECTS[0].slug);
    expect(rows[0].slug).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });

  it('is idempotent: running it twice leaves one project and keeps its id', async () => {
    await seedProjects(db());
    const [first] = await db().select().from(projects);
    await seedProjects(db());
    const rows = await db().select().from(projects);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first.id);
  });

  it('updates the name of an existing project by slug', async () => {
    await db().insert(projects).values({ name: 'Old name', slug: SEED_PROJECTS[0].slug });
    await seedProjects(db());
    const rows = await db().select().from(projects);
    expect(rows.map((r) => r.name)).toEqual(['Clinic booking']);
  });
});
