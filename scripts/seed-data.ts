import type { Db } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';

// Fixed so the report link stays the same across reseeds and in the demo video.
// The repo is public, so on a deployed server this link is known: anyone can submit to it,
// within the report rate limit. Seed tickets arrive in slice 7.
export const SEED_PROJECTS = [
  { name: 'Clinic booking', slug: 'NIx7Cq5JQqcSN6IrvmbFQ' },
] as const;

/** Upsert by slug: re-running updates the name and never creates a duplicate. */
export async function seedProjects(db: Db): Promise<void> {
  for (const project of SEED_PROJECTS) {
    await db
      .insert(projects)
      .values(project)
      .onConflictDoUpdate({ target: projects.slug, set: { name: project.name } });
  }
}
