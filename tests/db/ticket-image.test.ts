import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { attachments, projects, tickets } from '@/lib/db/schema';
import { MapStorage } from '@/lib/storage';
import { ticketImageResponse } from '@/lib/tickets/image';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
let storage: MapStorage;
let ticketId: string;
let original: Buffer;

beforeEach(async () => {
  storage = new MapStorage();
  const [p] = await db().insert(projects).values({ name: 'Clinic booking', slug: 'ImageSlugImageSlugIm1' }).returning();
  [{ id: ticketId }] = await db().insert(tickets)
    .values({ projectId: p.id, clientSentence: 'The page is blank.', reporterIpHash: 'h'.repeat(64) })
    .returning({ id: tickets.id });
  original = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#808080' } }).png().toBuffer();
  const key = `${p.id}/${ticketId}.png`;
  await storage.put(key, original, 'image/png');
  await db().insert(attachments).values({ ticketId, storageKey: key, mimeType: 'image/png', width: 1200, height: 800, bytes: original.length });
});

const serve = (over: { signedIn?: boolean; ticketId?: string; w?: string | null } = {}) =>
  ticketImageResponse(
    { db: db(), storage, signedIn: over.signedIn ?? true },
    { ticketId: over.ticketId ?? ticketId, w: 'w' in over ? (over.w ?? null) : null },
  );

describe('ticketImageResponse', () => {
  it('serves the original with its stored type and private, no-store headers', async () => {
    const res = await serve();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-disposition')).toBe('inline; filename="screenshot.png"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(await res.arrayBuffer()).equals(original)).toBe(true);
  });

  it('serves a JPEG thumbnail that fits inside 320 or 640 pixels', async () => {
    for (const w of ['320', '640']) {
      const res = await serve({ w });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
      expect(res.headers.get('content-disposition')).toBe('inline; filename="screenshot.jpg"');
      expect(res.headers.get('cache-control')).toBe('private, max-age=300');
      const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.width).toBe(Number(w));
    }
  });

  it('answers 404 without a session, before touching the database', async () => {
    const res = await ticketImageResponse({ db: null as never, storage, signedIn: false }, { ticketId, w: null });
    expect(res.status).toBe(404);
  });

  it('answers 404 for a malformed id, an unknown ticket, or a ticket without a screenshot', async () => {
    expect((await serve({ ticketId: '../../etc/passwd' })).status).toBe(404);
    expect((await serve({ ticketId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
    await db().delete(attachments);
    expect((await serve()).status).toBe(404);
  });

  it('answers 404 for any width other than 320 or 640', async () => {
    for (const w of ['', '100', '320px', '1280', '0320']) expect((await serve({ w })).status).toBe(404);
  });

  it('answers 404 when the file is missing from storage', async () => {
    storage.files.clear();
    expect((await serve()).status).toBe(404);
  });
});
