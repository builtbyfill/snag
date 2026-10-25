// The demo for judges (npm run seed:demo): four fictional projects with reports taken from the
// synthetic eval captures (seed/demo/images, scrubbed of real data), with client sentences written
// by hand for the demo (they are not the eval's sentences). Extraction ran once for real; its
// output is stored in seed/demo/results.json, so seeding again never spends API credits.
// Separate from eval/ and from scripts/seed-data.ts (the Clinic booking seed).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { attachments, extractions, followUps, projects, tickets } from '@/lib/db/schema';
import { ExtractionOutput } from '@/lib/extraction/schema';
import { ALWAYS_OPEN } from '@/lib/office-hours';
import { newSlug } from '@/lib/projects/create';
import type { Storage } from '@/lib/storage';

// The report links are made at seed time with `nanoid()` and printed once, never written down
// here: a slug in a public repo would let anyone submit reports (and spend API credits).
export const DEMO_PROJECTS = [
  { key: 'clinic', name: 'Northwind Clinic' },
  { key: 'safety', name: 'Safeguard Services' },
  { key: 'guesthouse', name: 'Pinewood Guesthouse' },
  { key: 'dental', name: 'Brightsmile Dental' },
] as const;

type Status = 'new' | 'in_progress' | 'done';

export type DemoTicket = {
  caseId: string;
  project: (typeof DEMO_PROJECTS)[number]['key'];
  sentence: string;
  status: Status;
  hoursAgo: number;
  followUp?: { body: string; minutesLater: number };
  /** Seeded as a failed extraction instead of running the model. */
  failed?: string;
};

// Fixed ids make the seed idempotent: a rerun finds the ticket and changes nothing.
export const demoTicketId = (caseId: string) => `de300000-0000-4000-8000-00000000${caseId.padStart(4, '0')}`;

export const DEMO_TICKETS: DemoTicket[] = [
  { caseId: '002', project: 'clinic', sentence: "The blue button covers the text in the list, I can't read what it says.", status: 'in_progress', hoursAgo: 52 },
  { caseId: '008', project: 'clinic', sentence: 'It offers me Sunday but you are closed on Sunday?', status: 'new', hoursAgo: 27 },
  { caseId: '017', project: 'clinic', sentence: "It won't take my phone number.", status: 'new', hoursAgo: 5, followUp: { body: 'I typed it the same way as always.', minutesLater: 25 } },
  { caseId: '021', project: 'clinic', sentence: "Again it doesn't work.", status: 'new', hoursAgo: 2 },

  { caseId: '003', project: 'safety', sentence: 'The big title on the first page runs over the text under it.', status: 'done', hoursAgo: 120 },
  { caseId: '013', project: 'safety', sentence: 'I filled the form and it says it cannot send.', status: 'in_progress', hoursAgo: 30 },
  { caseId: '015', project: 'safety', sentence: 'Sending the inquiry just spins and nothing happens.', status: 'new', hoursAgo: 9 },
  { caseId: '016', project: 'safety', sentence: "Form doesn't go through.", status: 'done', hoursAgo: 200 },

  { caseId: '004', project: 'guesthouse', sentence: "On my phone the rooms are all squeezed, I can't read the prices.", status: 'in_progress', hoursAgo: 49 },
  { caseId: '007', project: 'guesthouse', sentence: "Ana's reservation is two nights but shows 55 BAM.", status: 'new', hoursAgo: 26 },
  { caseId: '010', project: 'guesthouse', sentence: 'There are two of the same reservation in the list.', status: 'new', hoursAgo: 8 },
  { caseId: '012', project: 'guesthouse', sentence: 'The rooms page shows an error.', status: 'new', hoursAgo: 1, failed: 'The model returned no valid ticket after 2 attempts.' },
  { caseId: '018', project: 'guesthouse', sentence: "Can't check availability, it says to pick dates.", status: 'done', hoursAgo: 150 },

  { caseId: '006', project: 'dental', sentence: "Everything in the schedule is grey and I can't read the names.", status: 'new', hoursAgo: 20 },
  { caseId: '009', project: 'dental', sentence: "Ana's list says no appointments but she has six.", status: 'in_progress', hoursAgo: 75 },
  { caseId: '011', project: 'dental', sentence: "The free slots filter doesn't filter anything.", status: 'new', hoursAgo: 3 },
];

/** What the one real extraction run produced, per case (seed/demo/results.json). */
export type DemoResults = {
  generatedAt: string;
  model: string;
  tickets: Record<string, { parsed: unknown; rawResponse: string | null; inputTokens: number | null; outputTokens: number | null; durationMs: number | null }>;
};

export function readDemoResults(dir = 'seed/demo'): DemoResults | null {
  try {
    return JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8')) as DemoResults;
  } catch {
    return null;
  }
}

const HOUR = 60 * 60 * 1000;
const NO_ADDRESS = 'd'.repeat(64); // not a hash of any address

/** JPEG size from the SOF marker, so the attachment row is right without decoding the file. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error('not a JPEG');
}

/**
 * Finds each demo project by name, or creates it with a fresh random slug. Either way it ends up
 * flagged `demo` (its client page shows every report) with office hours every day, all day.
 */
export async function seedDemoProjects(db: Db): Promise<Record<string, { id: string; slug: string }>> {
  const out: Record<string, { id: string; slug: string }> = {};
  for (const p of DEMO_PROJECTS) {
    const [existing] = await db.select({ id: projects.id, slug: projects.slug }).from(projects).where(eq(projects.name, p.name));
    if (existing) {
      // An earlier version wrote fixed, guessable slugs; give those a random one once.
      const slug = existing.slug.startsWith('Demo') ? newSlug() : existing.slug;
      const [row] = await db
        .update(projects)
        .set({ slug, demo: true, officeHours: ALWAYS_OPEN })
        .where(eq(projects.id, existing.id))
        .returning({ id: projects.id, slug: projects.slug });
      out[p.key] = row;
      continue;
    }
    const [row] = await db
      .insert(projects)
      .values({ name: p.name, slug: newSlug(), demo: true, officeHours: ALWAYS_OPEN })
      .returning({ id: projects.id, slug: projects.slug });
    out[p.key] = row;
  }
  return out;
}

/**
 * Inserts the demo tickets that aren't there yet and writes their screenshots to storage. With
 * `results`, extracted tickets get the stored model output (fields, confidence, language and the
 * extraction log row); without it they are inserted `pending`, for `--extract` to run.
 */
export async function seedDemoTickets(
  db: Db,
  storage: Storage,
  opts: { results: DemoResults | null; now?: Date; imageDir?: string },
): Promise<{ inserted: string[]; pending: string[]; projects: Record<string, { id: string; slug: string }> }> {
  const now = opts.now ?? new Date();
  const imageDir = opts.imageDir ?? 'seed/demo/images';
  const projectIds = await seedDemoProjects(db);
  const inserted: string[] = [];
  const pending: string[] = [];

  for (const t of DEMO_TICKETS) {
    const id = demoTicketId(t.caseId);
    const createdAt = new Date(now.getTime() - t.hoursAgo * HOUR);
    const bytes = readFileSync(join(imageDir, `${t.caseId}.jpg`));
    const storageKey = `${projectIds[t.project].id}/${id}.jpg`;
    await storage.put(storageKey, bytes, 'image/jpeg');

    const [existing] = await db.select({ state: tickets.extractionState }).from(tickets).where(eq(tickets.id, id));
    if (existing) {
      if (existing.state === 'pending') pending.push(t.caseId);
      continue;
    }

    const result = t.failed ? null : (opts.results?.tickets[t.caseId] ?? null);
    const parsed = result ? ExtractionOutput.safeParse(result.parsed) : null;
    const out = parsed?.success ? parsed.data : null;
    await db.insert(tickets).values({
      id,
      projectId: projectIds[t.project].id,
      clientSentence: t.sentence,
      reporterIpHash: NO_ADDRESS,
      status: t.status,
      createdAt,
      updatedAt: createdAt,
      ...(t.failed
        ? { extractionState: 'extraction_failed', failedReason: 'extraction_error', extractionError: t.failed }
        : out
          ? {
              extractionState: 'extracted',
              confidence: out.confidence,
              language: out.language,
              title: out.observed.title,
              location: out.observed.location,
              actualResult: out.observed.actualResult,
              priority: out.observed.priority,
              tags: out.observed.tags,
              expectedResult: out.inferred.expectedResult?.value ?? null,
              expectedResultEvidence: out.inferred.expectedResult?.evidence ?? null,
              stepsToReproduce: out.inferred.stepsToReproduce?.value ?? null,
              stepsToReproduceEvidence: out.inferred.stepsToReproduce?.evidence ?? null,
            }
          : {}),
    });
    const { width, height } = jpegSize(bytes);
    await db.insert(attachments).values({ ticketId: id, storageKey, mimeType: 'image/jpeg', width, height, bytes: bytes.length, createdAt });

    if (t.failed) {
      await db.insert(extractions).values([1, 2].map((attempt) => ({ ticketId: id, attempt, result: 'failed' as const, model: opts.results?.model ?? 'demo', error: t.failed, createdAt })));
    } else if (out && result) {
      await db.insert(extractions).values({
        ticketId: id,
        attempt: 1,
        result: 'succeeded',
        model: opts.results?.model ?? 'demo',
        rawResponse: result.rawResponse,
        parsed: result.parsed,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: result.durationMs,
        createdAt,
      });
    } else {
      pending.push(t.caseId);
    }
    if (t.followUp) {
      await db.insert(followUps).values({ ticketId: id, body: t.followUp.body, reporterIpHash: NO_ADDRESS, createdAt: new Date(createdAt.getTime() + t.followUp.minutesLater * 60_000) });
    }
    inserted.push(t.caseId);
  }
  return { inserted, pending, projects: projectIds };
}

/** Reads what the extraction wrote for the demo tickets, for seed/demo/results.json. */
export async function collectDemoResults(db: Db, model: string): Promise<DemoResults> {
  const out: DemoResults = { generatedAt: new Date().toISOString(), model, tickets: {} };
  for (const t of DEMO_TICKETS) {
    if (t.failed) continue;
    const rows = await db
      .select({ parsed: extractions.parsed, rawResponse: extractions.rawResponse, inputTokens: extractions.inputTokens, outputTokens: extractions.outputTokens, durationMs: extractions.durationMs })
      .from(extractions)
      .where(eq(extractions.ticketId, demoTicketId(t.caseId)))
      .orderBy(extractions.attempt);
    const succeeded = rows.find((r) => r.parsed);
    if (succeeded) out.tickets[t.caseId] = succeeded;
  }
  return out;
}
