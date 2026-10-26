import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp, { type Metadata } from 'sharp';
import { z } from 'zod';
import { globalLimitHit, hashIp, reportLimitHit } from '@/lib/auth/rate-limit';
import type { Db } from '@/lib/db/client';
import { describeError } from '@/lib/log';
import { attachments, projects, tickets } from '@/lib/db/schema';
import type { Storage } from '@/lib/storage';
import { MAX_BYTES, MAX_EDGE_PX, SENTENCE_MAX, SENTENCE_MIN, type ReportErrorCode } from './validate';

const FORMATS = {
  png: { mimeType: 'image/png', ext: 'png' },
  jpeg: { mimeType: 'image/jpeg', ext: 'jpg' },
  webp: { mimeType: 'image/webp', ext: 'webp' },
} as const;

const Sentence = z.string().trim().min(SENTENCE_MIN).max(SENTENCE_MAX);

export type SubmitDeps = { db: Db; storage: Storage; ipHashSecret: string; now?: () => Date };
export type SubmitInput = { slug: string; sentence: unknown; file: unknown; ip: string };
export type SubmitResult =
  | { ok: true; ticketId: string }
  | {
      ok: false;
      /** A code, not words: the page shows it in the client's language. */
      error: Exclude<ReportErrorCode, 'oneFile'>;
      field: 'form' | 'sentence' | 'screenshot';
    };

const fail = (error: Extract<SubmitResult, { ok: false }>['error'], field: 'form' | 'sentence' | 'screenshot'): SubmitResult =>
  ({ ok: false, error, field });

/**
 * Save first, extract later: validates the report, then writes the screenshot and the
 * ticket + attachment rows. No AI call happens here; the client's confirmation never waits on it.
 */
export async function submitReport(deps: SubmitDeps, input: SubmitInput): Promise<SubmitResult> {
  const [project] = await deps.db.select({ id: projects.id }).from(projects).where(eq(projects.slug, input.slug));
  if (!project) return fail('notFound', 'form');

  const sentence = Sentence.safeParse(input.sentence);
  if (!sentence.success) {
    const tooLong = sentence.error.issues.some((i) => i.code === 'too_big');
    return fail(tooLong ? 'sentenceLong' : 'sentenceShort', 'sentence');
  }

  if (!(input.file instanceof Blob) || input.file.size === 0) return fail('missingImage', 'screenshot');
  if (input.file.size > MAX_BYTES) return fail('tooLarge', 'screenshot');

  // The browser's declared type and the file name are ignored: the bytes decide.
  const bytes = Buffer.from(await input.file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(bytes).metadata(); // reads the header only; nothing is decoded
  } catch {
    return fail('invalidType', 'screenshot');
  }
  const format = meta.format && meta.format in FORMATS ? FORMATS[meta.format as keyof typeof FORMATS] : null;
  if (!format || !meta.width || !meta.height) return fail('invalidType', 'screenshot');
  if (meta.width > MAX_EDGE_PX || meta.height > MAX_EDGE_PX) return fail('tooManyPixels', 'screenshot');

  const ipHash = hashIp(input.ip, deps.ipHashSecret);
  if (await reportLimitHit(deps.db, ipHash, deps.now?.())) return fail('rateLimited', 'form');
  if (await globalLimitHit(deps.db, deps.now?.())) return fail('rateLimited', 'form');

  const ticketId = randomUUID();
  const storageKey = `${project.id}/${ticketId}.${format.ext}`;
  let stored = false;
  try {
    // File first: if the disk is full, nothing reaches the database.
    await deps.storage.put(storageKey, bytes, format.mimeType);
    stored = true;
    await deps.db.transaction(async (tx) => {
      await tx.insert(tickets).values({ id: ticketId, projectId: project.id, clientSentence: sentence.data, reporterIpHash: ipHash });
      await tx.insert(attachments).values({
        ticketId, storageKey, mimeType: format.mimeType, width: meta.width!, height: meta.height!, bytes: bytes.length,
      });
    });
  } catch (error) {
    console.error(`submitReport: saving failed: ${describeError(error)}`);
    // The file has no ticket to belong to; remove it (best effort) so storage doesn't collect orphans.
    if (stored) await deps.storage.delete(storageKey).catch(() => {});
    return fail('server', 'form');
  }
  return { ok: true, ticketId };
}
