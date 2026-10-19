import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { attachments, extractions, followUps, projects, tickets } from '@/lib/db/schema';
import type { Storage } from '@/lib/storage';

// Fixed so the report link stays the same across reseeds and in the demo video.
// The repo is public, so on a deployed server this link is known: anyone can submit to it,
// within the report rate limit. A deployment gets its own project from New project instead.
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

const HOUR = 60 * 60 * 1000;
const NO_ADDRESS = '0'.repeat(64); // not a hash of any address, so no real client's limit counts it

/**
 * Three tickets that show every card state without spending credits: extracted with evidence and a
 * follow-up, extracted with Ask client, and failed. The screenshots are synthetic (a fictional
 * clinic rendered from seed/demo-page by scripts/capture-seed.mjs). Fields are written by hand,
 * so the demo never depends on a live model call.
 */
const SEED_TICKETS = [
  {
    id: '5eed0001-0000-4000-8000-000000000001',
    image: 'synthetic-booking-details.png',
    hoursAgo: 50,
    ticket: {
      clientSentence: 'Upisala sam ime i prezime i kliknula Dalje, a ispod crveno piše da ga upišem.',
      language: 'bs',
      status: 'in_progress',
      extractionState: 'extracted',
      confidence: 0.86,
      title: 'Booking step 3 rejects a name that is filled in',
      location: 'Booking, step 3 of 4 "Vaši podaci" (Your details)',
      actualResult: 'The "Ime i prezime" (Name) field holds "Selma Begović", yet it shows the error "Upišite ime i prezime." (Enter your name) and the booking stays on step 3.',
      priority: 'high',
      tags: ['booking', 'validation'],
      expectedResult: 'Tapping "Dalje" (Next) accepts the name and opens step 4.',
      expectedResultEvidence: 'The progress bar shows step 3 of 4, and the client says she tapped "Dalje".',
      stepsToReproduce: ['Start a booking and reach step 3 "Vaši podaci"', 'Enter a first and last name and a phone number', 'Tap "Dalje"'],
      stepsToReproduceEvidence: 'Step 3 of 4 with the name and phone filled in, and the client\'s "kliknula Dalje".',
    },
    followUp: { body: 'Probala sam i bez kvačica na ć, isto je.', minutesLater: 40 },
    attempts: ['succeeded'],
  },
  {
    id: '5eed0002-0000-4000-8000-000000000002',
    image: 'synthetic-booking-calendar.png',
    hoursAgo: 26,
    ticket: {
      clientSentence: "Again it doesn't work.",
      language: 'en',
      status: 'new',
      extractionState: 'extracted',
      confidence: 0.41, // under 0.6: Ask client
      title: 'No free times shown for the week of 26–30 October',
      location: 'Booking, "Odaberite termin" (Choose a time), week of 26–30 October',
      actualResult: 'Every day from Monday 26 to Friday 30 October reads "Nema slobodnih termina" (No free times).',
      priority: 'medium',
      tags: ['calendar'],
    },
    attempts: ['succeeded'],
  },
  {
    id: '5eed0003-0000-4000-8000-000000000003',
    image: 'synthetic-booking-payment.png',
    hoursAgo: 3,
    ticket: {
      clientSentence: "The price at the end looks wrong and I can't pay.",
      status: 'new',
      extractionState: 'extraction_failed',
      failedReason: 'extraction_error',
      extractionError: 'The model returned no valid ticket after 2 attempts.',
    },
    attempts: ['failed', 'failed'],
  },
] as const;

/**
 * Inserts the seed tickets once (fixed ids, so a rerun changes nothing) and writes their
 * screenshots to storage every run, so a fresh uploads volume gets the files back. Reports that
 * really arrived in the project are never touched.
 */
export async function seedTickets(db: Db, storage: Storage, now: Date = new Date(), imageDir = 'seed/images'): Promise<void> {
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, SEED_PROJECTS[0].slug));
  if (!project) throw new Error('Seed the projects first.');

  for (const seed of SEED_TICKETS) {
    const createdAt = new Date(now.getTime() - seed.hoursAgo * HOUR);
    const bytes = readFileSync(join(imageDir, seed.image));
    const storageKey = `${project.id}/${seed.id}.png`;
    await storage.put(storageKey, bytes, 'image/png');

    const inserted = await db
      .insert(tickets)
      .values({ id: seed.id, projectId: project.id, reporterIpHash: NO_ADDRESS, createdAt, updatedAt: createdAt, ...seed.ticket, tags: 'tags' in seed.ticket ? [...seed.ticket.tags] : [], stepsToReproduce: 'stepsToReproduce' in seed.ticket ? [...seed.ticket.stepsToReproduce] : null })
      .onConflictDoNothing({ target: tickets.id })
      .returning({ id: tickets.id });
    if (inserted.length === 0) continue; // already seeded

    // PNG header: width and height are the big-endian integers at bytes 16 and 20.
    await db.insert(attachments).values({ ticketId: seed.id, storageKey, mimeType: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length, createdAt });
    await db.insert(extractions).values(
      seed.attempts.map((result, i) => ({
        ticketId: seed.id,
        attempt: i + 1,
        result,
        model: 'seed (written by hand)',
        error: result === 'failed' ? 'Seeded failure: no valid ticket in the response.' : null,
        createdAt,
      })),
    );
    if ('followUp' in seed) {
      await db.insert(followUps).values({ ticketId: seed.id, body: seed.followUp.body, reporterIpHash: NO_ADDRESS, createdAt: new Date(createdAt.getTime() + seed.followUp.minutesLater * 60_000) });
    }
  }
}
