import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { extractTicket } from '@/lib/extraction';
import { FakeProvider, reply } from './fakes/fake-provider';

const VALID = JSON.stringify({
  observed: { title: 'Consent text hidden', location: 'unknown', actualResult: null, priority: 'low', tags: [] },
  inferred: { expectedResult: null, stepsToReproduce: null },
  confidence: 0.5,
  language: 'bs',
});

describe('extractTicket', () => {
  it('sends the downscaled image first and the client sentence second, labelled with model and prompt version', async () => {
    const image = await sharp({ create: { width: 1000, height: 2000, channels: 3, background: '#fff' } }).png().toBuffer();
    const provider = new FakeProvider([reply(VALID)]);

    const outcome = await extractTicket(
      { image, mimeType: 'image/png', sentence: 'Ne mogu zakazati, crveno mi piše kad kliknem dalje.' },
      { provider, env: { EXTRACTION_MODEL: 'claude-sonnet-5-5', EXTRACTION_MAX_EDGE: 500 }, sleep: async () => {} },
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.attempts[0].model).toBe('claude-sonnet-5-5@p1');

    const [first, second] = provider.requests[0].content;
    expect(first.type).toBe('image');
    if (first.type === 'image') {
      const meta = await sharp(first.data).metadata();
      expect([meta.width, meta.height]).toEqual([250, 500]);
      expect(first.mimeType).toBe('image/png');
    }
    expect(second).toEqual({ type: 'text', text: 'Client wrote: «Ne mogu zakazati, crveno mi piše kad kliknem dalje.»' });
  });

  it('returns ok: false instead of throwing when the image cannot be read', async () => {
    const provider = new FakeProvider([]);
    const outcome = await extractTicket(
      { image: Buffer.from('not an image'), mimeType: 'image/png', sentence: 'Ništa ne radi na ovoj stranici.' },
      { provider, env: { EXTRACTION_MODEL: 'm', EXTRACTION_MAX_EDGE: 500 } },
    );
    expect(outcome.ok).toBe(false);
    expect(provider.requests).toHaveLength(0);
  });
});
