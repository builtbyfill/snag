// The screenshot behind a ticket, for the dashboard only. Every refusal is the same 404, so the
// route never says whether a ticket exists, has a screenshot, or needs a login.
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { attachments } from '@/lib/db/schema';
import type { Storage } from '@/lib/storage';

/** Thumbnail widths: 320 for the 280px frame, 640 for the same frame on 2x screens. */
/** How long a full-size signed URL (Supabase) stays valid. */
export const SIGNED_URL_SECONDS = 600;

const WIDTHS = new Set(['320', '640']);
const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** The one refusal, for every reason: no session, bad id or width, no such file. */
export const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

const image = (bytes: Buffer, type: string, ext: string, cache: string) =>
  new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="screenshot.${ext}"`,
      'Cache-Control': cache,
    },
  });

export async function ticketImageResponse(
  deps: { db: Db; storage: Storage; signedIn: boolean },
  request: { ticketId: string; w: string | null },
): Promise<Response> {
  if (!deps.signedIn) return notFound();
  if (!z.uuid().safeParse(request.ticketId).success) return notFound();
  if (request.w !== null && !WIDTHS.has(request.w)) return notFound();

  const [row] = await deps.db
    .select({ storageKey: attachments.storageKey, mimeType: attachments.mimeType })
    .from(attachments)
    .where(eq(attachments.ticketId, request.ticketId));
  if (!row) return notFound();

  try {
    if (request.w === null) {
      // Supabase: the browser fetches the full size from the private bucket itself, so the bytes
      // don't pass through a function. The URL is short-lived and the redirect is never cached.
      const url = await deps.storage.signedUrl(row.storageKey, SIGNED_URL_SECONDS);
      if (url) return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store' } });
    }
    const bytes = await deps.storage.get(row.storageKey);
    if (request.w === null) return image(bytes, row.mimeType, EXTENSION[row.mimeType] ?? 'png', 'private, no-store');
    // Width only, so a tall phone screenshot stays readable; rotate() applies the photo's EXIF turn.
    const thumb = await sharp(bytes)
      .rotate()
      .resize({ width: Number(request.w), withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80 })
      .toBuffer();
    return image(thumb, 'image/jpeg', 'jpg', 'private, max-age=300');
  } catch {
    return notFound(); // missing or unreadable file, or no signed URL
  }
}
