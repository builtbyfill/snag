import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashIp } from '@/lib/auth/rate-limit';
import { followUps, projects, tickets } from '@/lib/db/schema';
import { addFollowUp, FOLLOW_UPS_PER_HOUR } from '@/lib/reports/follow-up';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const SECRET = 's'.repeat(44);
const SLUG = 'FollowSlugFollowSlug1';

let ticketId: string;
let otherProjectTicketId: string;

beforeEach(async () => {
  const [p] = await db().insert(projects).values({ name: 'Clinic booking', slug: SLUG }).returning();
  const [other] = await db().insert(projects).values({ name: 'Barber shop', slug: 'OtherSlugOtherSlugOth' }).returning();
  [{ id: ticketId }] = await db().insert(tickets)
    .values({ projectId: p.id, clientSentence: 'Ne radi dugme Sačuvaj.', reporterIpHash: 'h'.repeat(64) })
    .returning({ id: tickets.id });
  [{ id: otherProjectTicketId }] = await db().insert(tickets)
    .values({ projectId: other.id, clientSentence: 'Ne radi kalendar.', reporterIpHash: 'h'.repeat(64) })
    .returning({ id: tickets.id });
});

const add = (over: { slug?: string; ticketId?: unknown; body?: unknown; ip?: string; now?: Date } = {}) =>
  addFollowUp(
    { db: db(), ipHashSecret: SECRET, now: over.now },
    { slug: over.slug ?? SLUG, ticketId: 'ticketId' in over ? over.ticketId : ticketId, body: 'body' in over ? over.body : '  It happens on Mondays too.  ', ip: over.ip ?? '10.0.0.7' },
  );

describe('addFollowUp: a client adds text to their own report', () => {
  it('saves the trimmed text on the report, with the hashed address and the time', async () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const result = await add({ now });

    expect(result).toEqual({ ok: true, id: expect.any(String), createdAt: now.toISOString() });
    const rows = await db().select().from(followUps).where(eq(followUps.ticketId, ticketId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ body: 'It happens on Mondays too.', reporterIpHash: hashIp('10.0.0.7', SECRET) });
  });

  it('leaves the ticket itself alone (status, fields, extraction)', async () => {
    const [before] = await db().select().from(tickets).where(eq(tickets.id, ticketId));
    await add();
    const [after] = await db().select().from(tickets).where(eq(tickets.id, ticketId));
    expect(after).toEqual(before);
  });
});

describe('addFollowUp: refusals', () => {
  it('treats an unknown link, a report from another project and a malformed id the same way', async () => {
    expect(await add({ slug: 'NoSuchSlugNoSuchSlugN' })).toEqual({ ok: false, error: 'notFound' });
    expect(await add({ ticketId: otherProjectTicketId })).toEqual({ ok: false, error: 'notFound' });
    expect(await add({ ticketId: 'not-a-uuid' })).toEqual({ ok: false, error: 'notFound' });
    expect(await db().select().from(followUps)).toHaveLength(0);
  });

  it('refuses empty or one-character text, and text over 1000 characters', async () => {
    expect(await add({ body: '   ' })).toEqual({ ok: false, error: 'followUpEmpty' });
    expect(await add({ body: 'a' })).toEqual({ ok: false, error: 'followUpEmpty' });
    expect(await add({ body: 42 })).toEqual({ ok: false, error: 'followUpEmpty' });
    expect(await add({ body: 'x'.repeat(1001) })).toEqual({ ok: false, error: 'sentenceLong' });
  });

  it(`allows ${FOLLOW_UPS_PER_HOUR} follow-ups per address per hour, then refuses`, async () => {
    const now = new Date('2026-10-18T12:00:00Z');
    for (let i = 0; i < FOLLOW_UPS_PER_HOUR; i++) expect((await add({ now })).ok).toBe(true);
    expect(await add({ now })).toEqual({ ok: false, error: 'rateLimited' });
    expect((await add({ now, ip: '10.0.0.8' })).ok).toBe(true); // another address is not affected
  });
});
