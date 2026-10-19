import { describe, expect, it } from 'vitest';
import { attachments, extractions, followUps, projects, tickets } from '@/lib/db/schema';
import { MapStorage } from '@/lib/storage';
import { SEED_PROJECTS, seedProjects, seedTickets } from '@/scripts/seed-data';
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

describe('seedTickets', () => {
  const NOW = new Date('2026-10-18T12:00:00Z');

  it('adds three Clinic booking tickets: extracted with a follow-up, Ask client, and failed', async () => {
    const storage = new MapStorage();
    await seedProjects(db());
    await seedTickets(db(), storage, NOW);

    const rows = await db().select().from(tickets).orderBy(tickets.createdAt);
    expect(rows.map((t) => [t.status, t.extractionState, t.askClient])).toEqual([
      ['in_progress', 'extracted', false],
      ['new', 'extracted', true],
      ['new', 'extraction_failed', false],
    ]);
    expect(rows[0].expectedResultEvidence).toBeTruthy();
    expect(rows[0].stepsToReproduceEvidence).toBeTruthy();
    expect(rows[2]).toMatchObject({ failedReason: 'extraction_error', title: null });
    expect(await db().select().from(followUps)).toHaveLength(1);
  });

  it('stores each synthetic screenshot under the ticket and records the attempts', async () => {
    const storage = new MapStorage();
    await seedProjects(db());
    await seedTickets(db(), storage, NOW);

    const files = await db().select().from(attachments);
    expect(files).toHaveLength(3);
    for (const file of files) {
      expect(file.mimeType).toBe('image/png');
      expect(storage.files.get(file.storageKey)?.bytes.length).toBe(file.bytes);
    }
    const attempts = await db().select().from(extractions);
    expect(attempts.map((a) => a.result).sort()).toEqual(['failed', 'failed', 'succeeded', 'succeeded']);
  });

  it('is idempotent and leaves real reports in the project alone', async () => {
    await seedProjects(db());
    const [project] = await db().select().from(projects);
    await db().insert(tickets).values({ projectId: project.id, clientSentence: 'A real report from my phone.', reporterIpHash: 'r'.repeat(64) });
    await seedTickets(db(), new MapStorage(), NOW);
    const first = (await db().select({ id: tickets.id }).from(tickets)).map((t) => t.id).sort();
    await seedTickets(db(), new MapStorage(), NOW);
    const second = (await db().select({ id: tickets.id }).from(tickets)).map((t) => t.id).sort();
    expect(second).toEqual(first);
    expect(second).toHaveLength(4);
    expect(await db().select().from(followUps)).toHaveLength(1);
    expect(await db().select().from(extractions)).toHaveLength(4);
  });
});
