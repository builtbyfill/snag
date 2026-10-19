import { describe, expect, it } from 'vitest';
import { projects } from '@/lib/db/schema';
import { createProject } from '@/lib/projects/create';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();

describe('createProject', () => {
  it('saves the trimmed name with a random 21-character slug and returns the id', async () => {
    const result = await createProject(db(), '  Dental clinic  ');
    expect(result).toEqual({ ok: true, id: expect.any(String) });
    const [row] = await db().select().from(projects);
    expect(row.name).toBe('Dental clinic');
    expect(row.slug).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });

  it('gives every project its own slug', async () => {
    await createProject(db(), 'One');
    await createProject(db(), 'Two');
    const slugs = (await db().select().from(projects)).map((p) => p.slug);
    expect(new Set(slugs).size).toBe(2);
  });

  it('refuses a name under 2 or over 60 characters, and anything that is not text', async () => {
    expect(await createProject(db(), ' A ')).toEqual({ ok: false, error: 'nameShort' });
    expect(await createProject(db(), 'x'.repeat(61))).toEqual({ ok: false, error: 'nameLong' });
    expect(await createProject(db(), null)).toEqual({ ok: false, error: 'nameShort' });
    expect(await createProject(db(), 'x'.repeat(60))).toEqual({ ok: true, id: expect.any(String) });
    expect(await db().select().from(projects)).toHaveLength(1);
  });
});
