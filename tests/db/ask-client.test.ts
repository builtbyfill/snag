import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { projects, tickets } from '@/lib/db/schema';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
let projectId: string;

beforeEach(async () => {
  const [p] = await db().insert(projects).values({ name: 'Clinic booking', slug: 'AskSlugAskSlugAskSlug' }).returning();
  projectId = p.id;
});

const flag = async (id: string) =>
  (await db().select({ askClient: tickets.askClient }).from(tickets).where(eq(tickets.id, id)))[0].askClient;

// spec.md > askClient: derived or stored? Postgres computes the flag from the ticket's own columns
// on every INSERT and UPDATE, so it can never disagree with the fields it is computed from.
describe('ask_client (generated column)', () => {
  it('flags low confidence, then follows when confidence and actual result change', async () => {
    const [t] = await db().insert(tickets).values({
      projectId, clientSentence: 'Ne radi dugme Sačuvaj.', reporterIpHash: 'h'.repeat(64),
      extractionState: 'extracted', confidence: 0.5, location: 'Booking form', actualResult: 'Nothing happens on Save',
    }).returning();
    expect(await flag(t.id)).toBe(true);

    await db().update(tickets).set({ confidence: 0.9 }).where(eq(tickets.id, t.id));
    expect(await flag(t.id)).toBe(false);

    await db().update(tickets).set({ actualResult: null }).where(eq(tickets.id, t.id));
    expect(await flag(t.id)).toBe(true);

    // Filip fills in "What's wrong" himself: the badge goes away without any app code.
    await db().update(tickets).set({ actualResult: 'Save button does nothing' }).where(eq(tickets.id, t.id));
    expect(await flag(t.id)).toBe(false);
  });

  it('never flags a ticket that is still pending, even though its fields are empty', async () => {
    const [t] = await db().insert(tickets).values({
      projectId, clientSentence: 'Ne radi dugme Sačuvaj.', reporterIpHash: 'h'.repeat(64),
    }).returning();
    expect(await flag(t.id)).toBe(false);
  });
});
