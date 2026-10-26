import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashIp } from '@/lib/auth/rate-limit';
import { attachments, projects, tickets } from '@/lib/db/schema';
import { submitReport } from '@/lib/reports/submit';
import { MapStorage, type Storage } from '@/lib/storage';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const SECRET = 's'.repeat(44);
const SLUG = 'TestSlugTestSlugTest1';
const SENTENCE = 'Kliknula sam Sačuvaj na terminu i ništa se nije desilo.';

let storage: MapStorage;
let projectId: string;

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  storage = new MapStorage();
  const [p] = await db().insert(projects).values({ name: 'Clinic booking', slug: SLUG }).returning();
  projectId = p.id;
});

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#ffffff' } });
const file = (bytes: Buffer, name = 'screenshot.png', type = 'image/png') => new File([new Uint8Array(bytes)], name, { type });

const submit = (over: { slug?: string; sentence?: unknown; file?: unknown; ip?: string; storage?: Storage } = {}) =>
  submitReport(
    { db: db(), storage: over.storage ?? storage, ipHashSecret: SECRET },
    {
      slug: over.slug ?? SLUG,
      sentence: 'sentence' in over ? over.sentence : SENTENCE,
      file: 'file' in over ? over.file : undefined,
      ip: over.ip ?? '192.168.1.20',
    },
  );

async function countRows() {
  return { tickets: (await db().select().from(tickets)).length, files: storage.files.size };
}

describe('submitReport: saving', () => {
  it('saves a pending ticket and its attachment, and stores the file under projectId/ticketId', async () => {
    const png = await image(1170, 2532).png().toBuffer();
    const result = await submit({ file: file(png) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [ticket] = await db().select().from(tickets).where(eq(tickets.id, result.ticketId));
    expect(ticket).toMatchObject({
      projectId, clientSentence: SENTENCE, status: 'new', extractionState: 'pending', askClient: false,
      reporterIpHash: hashIp('192.168.1.20', SECRET),
    });

    const [attachment] = await db().select().from(attachments).where(eq(attachments.ticketId, result.ticketId));
    expect(attachment).toMatchObject({
      storageKey: `${projectId}/${result.ticketId}.png`, mimeType: 'image/png', width: 1170, height: 2532, bytes: png.length,
    });
    expect((await storage.get(attachment.storageKey)).equals(png)).toBe(true);
  });

  it('never stores the raw IP address', async () => {
    const result = await submit({ file: file(await image(10, 10).png().toBuffer()) });
    if (!result.ok) throw new Error('expected ok');
    const [ticket] = await db().select().from(tickets).where(eq(tickets.id, result.ticketId));
    expect(JSON.stringify(ticket)).not.toContain('192.168.1.20');
  });

  it('trims surrounding whitespace from the sentence and keeps its words exactly', async () => {
    const result = await submit({ sentence: `  ${SENTENCE}\n`, file: file(await image(10, 10).png().toBuffer()) });
    if (!result.ok) throw new Error('expected ok');
    const [ticket] = await db().select().from(tickets).where(eq(tickets.id, result.ticketId));
    expect(ticket.clientSentence).toBe(SENTENCE);
  });

  it.each([
    ['jpeg', 'jpg', 'image/jpeg'],
    ['webp', 'webp', 'image/webp'],
  ] as const)('stores a %s screenshot with the sniffed type and extension', async (format, ext, mime) => {
    const bytes = await image(20, 20).toFormat(format).toBuffer();
    // The browser-declared type is ignored: claim png, get the real format.
    const result = await submit({ file: file(bytes, 'photo.png', 'image/png') });
    if (!result.ok) throw new Error('expected ok');
    const [attachment] = await db().select().from(attachments).where(eq(attachments.ticketId, result.ticketId));
    expect(attachment).toMatchObject({ mimeType: mime, storageKey: `${projectId}/${result.ticketId}.${ext}` });
  });
});

describe('submitReport: rejections write nothing', () => {
  it('unknown slug', async () => {
    const result = await submit({ slug: 'NoSuchSlugNoSuchSlug1', file: file(await image(10, 10).png().toBuffer()) });
    expect(result).toEqual({ ok: false, error: 'notFound', field: 'form' });
    expect(await countRows()).toEqual({ tickets: 0, files: 0 });
  });

  it.each([
    ['too short', 'Ne radi.'],
    ['only spaces', '               '],
    ['not a string', 42],
  ])('sentence %s', async (_name, sentence) => {
    const result = await submit({ sentence, file: file(await image(10, 10).png().toBuffer()) });
    expect(result).toEqual({ ok: false, error: 'sentenceShort', field: 'sentence' });
    expect(await countRows()).toEqual({ tickets: 0, files: 0 });
  });

  it('sentence over 1000 characters', async () => {
    const result = await submit({ sentence: 'a'.repeat(1001), file: file(await image(10, 10).png().toBuffer()) });
    expect(result).toEqual({ ok: false, error: 'sentenceLong', field: 'sentence' });
  });

  it('missing screenshot', async () => {
    expect(await submit({ file: undefined })).toEqual({ ok: false, error: 'missingImage', field: 'screenshot' });
    expect(await submit({ file: file(Buffer.alloc(0)) })).toMatchObject({ error: 'missingImage' });
  });

  it('an SVG renamed to .png is rejected by its real format', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    expect(await submit({ file: file(svg, 'evil.png', 'image/png') })).toEqual({ ok: false, error: 'invalidType', field: 'screenshot' });
    expect(await countRows()).toEqual({ tickets: 0, files: 0 });
  });

  it('a GIF is rejected', async () => {
    const gif = await image(10, 10).gif().toBuffer();
    expect(await submit({ file: file(gif, 'a.gif', 'image/gif') })).toMatchObject({ error: 'invalidType' });
  });

  it('bytes that are not an image at all are rejected as a wrong type', async () => {
    expect(await submit({ file: file(Buffer.from('not an image')) })).toMatchObject({ error: 'invalidType' });
  });

  it('a file over 4 MB (under the 4.5 MB Vercel body limit, so this message always shows)', async () => {
    const big = Buffer.alloc(4 * 1024 * 1024 + 1, 1);
    expect(await submit({ file: file(big) })).toEqual({ ok: false, error: 'tooLarge', field: 'screenshot' });
  });

  it('a file of exactly 4 MB passes the size check', async () => {
    const png = await image(10, 10).png().toBuffer();
    // A valid PNG padded to the limit: sharp reads the header and ignores trailing bytes.
    const padded = Buffer.concat([png, Buffer.alloc(4 * 1024 * 1024 - png.length)]);
    expect(padded.length).toBe(4 * 1024 * 1024);
    expect(await submit({ file: file(padded) })).toMatchObject({ ok: true });
  });

  it('an image wider or taller than 8000 px', async () => {
    const wide = await image(8001, 10).png().toBuffer();
    expect(await submit({ file: file(wide) })).toEqual({ ok: false, error: 'tooManyPixels', field: 'screenshot' });
  });

  it('the eleventh report from one address within an hour', async () => {
    const png = await image(10, 10).png().toBuffer();
    for (let i = 0; i < 10; i++) expect((await submit({ file: file(png) })).ok).toBe(true);
    expect(await submit({ file: file(png) })).toEqual({ ok: false, error: 'rateLimited', field: 'form' });
    expect(await countRows()).toEqual({ tickets: 10, files: 10 });
    // A different address is not affected.
    expect((await submit({ file: file(png), ip: '192.168.1.99' })).ok).toBe(true);
  });

  it('removes the uploaded screenshot when the database write fails', async () => {
    const png = await image(10, 10).png().toBuffer();
    vi.spyOn(db(), 'transaction').mockRejectedValueOnce(new Error('db down'));
    const result = await submit({ file: file(png) });
    expect(result).toEqual({ ok: false, error: 'server', field: 'form' });
    expect(storage.files.size).toBe(0);
  });

  it('a storage failure saves no ticket', async () => {
    const broken: Storage = {
      put: async () => { throw new Error('ENOSPC: no space left on device'); },
      get: async () => Buffer.alloc(0),
      delete: async () => {},
      signedUrl: async () => null,
    };
    const result = await submit({ file: file(await image(10, 10).png().toBuffer()), storage: broken });
    expect(result).toEqual({ ok: false, error: 'server', field: 'form' });
    expect((await db().select().from(tickets)).length).toBe(0);
  });
});
