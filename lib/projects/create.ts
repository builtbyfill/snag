// New project from the dashboard (Filip, 2026-10-18). The slug is the whole secret of a report
// link, so it comes from crypto (nanoid: 21 URL-safe characters), never from the name or input.
import { nanoid } from 'nanoid';
import type { Db } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';

export const PROJECT_NAME_MIN = 2;
export const PROJECT_NAME_MAX = 60;

export type CreateProjectError = 'nameShort' | 'nameLong' | 'server';
export type CreateProjectResult = { ok: true; id: string } | { ok: false; error: CreateProjectError };

export const newSlug = (): string => nanoid();

export async function createProject(db: Db, name: unknown): Promise<CreateProjectResult> {
  const clean = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  if (clean.length < PROJECT_NAME_MIN) return { ok: false, error: 'nameShort' };
  if (clean.length > PROJECT_NAME_MAX) return { ok: false, error: 'nameLong' };
  const [row] = await db.insert(projects).values({ name: clean, slug: newSlug() }).returning({ id: projects.id });
  return { ok: true, id: row.id };
}
