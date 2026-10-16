import { describe, expect, it } from 'vitest';
import { runAttempts } from '@/lib/extraction/policy';
import { ProviderError, type ProviderContent } from '@/lib/extraction/provider';
import { FakeProvider, reply } from './fakes/fake-provider';

const VALID = JSON.stringify({
  observed: {
    title: 'Consent label hidden behind sticky buttons',
    location: 'Booking dialog, step "Podaci"',
    actualResult: 'Consent text is cut off behind the bottom buttons.',
    priority: 'medium',
    tags: ['form', 'layout'],
  },
  inferred: { expectedResult: null, stepsToReproduce: null },
  confidence: 0.7,
  language: 'bs',
});
const INVALID = VALID.replace('"confidence":0.7', '"confidence":1.7');

const firstTurn: ProviderContent[] = [
  { type: 'image', mimeType: 'image/png', data: Buffer.from('png') },
  { type: 'text', text: 'Client wrote: «Ne mogu zakazati.»' },
];

function run(provider: FakeProvider) {
  const sleeps: number[] = [];
  let clock = 0;
  const promise = runAttempts({
    provider,
    modelLabel: 'claude-sonnet-5-5@p1',
    system: 'system prompt',
    firstTurn,
    now: () => (clock += 250),
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { promise, sleeps };
}

const lastText = (content: ProviderContent[]) => {
  const block = content[content.length - 1];
  return block.type === 'text' ? block.text : '';
};

describe('runAttempts', () => {
  it('succeeds on the first valid answer and records one attempt with usage', async () => {
    const provider = new FakeProvider([reply(VALID)]);
    const outcome = await run(provider).promise;

    expect(outcome.ok).toBe(true);
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0]).toMatchObject({
      attempt: 1, result: 'succeeded', model: 'claude-sonnet-5-5@p1',
      rawResponse: VALID, error: null, inputTokens: 1500, outputTokens: 900, durationMs: 250,
    });
    expect(outcome.attempts[0].parsed?.confidence).toBe(0.7);
  });

  it('retries once on a validation failure, feeding the issues and the previous answer back', async () => {
    const provider = new FakeProvider([reply(INVALID), reply(VALID)]);
    const outcome = await run(provider).promise;

    expect(outcome.ok).toBe(true);
    expect(outcome.attempts.map((a) => a.result)).toEqual(['failed', 'succeeded']);
    expect(outcome.attempts[0].error).toMatch(/confidence: /);

    const second = provider.requests[1].content;
    expect(second.slice(0, firstTurn.length)).toEqual(firstTurn); // image + original text, then feedback
    expect(lastText(second)).toContain('confidence: ');
    expect(lastText(second)).toContain(INVALID);
  });

  it('treats text that is not JSON like a validation failure', async () => {
    const provider = new FakeProvider([reply('{"observed":'), reply(VALID)]);
    const outcome = await run(provider).promise;
    expect(outcome.ok).toBe(true);
    expect(provider.requests).toHaveLength(2);
  });

  it('fails after a second validation failure', async () => {
    const provider = new FakeProvider([reply(INVALID), reply(INVALID)]);
    const outcome = await run(provider).promise;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/did not pass validation/);
    expect(outcome.attempts).toHaveLength(2);
  });

  it('waits 4 seconds after a retryable error and repeats the same request', async () => {
    const provider = new FakeProvider([new ProviderError('Request timed out', true), reply(VALID)]);
    const { promise, sleeps } = run(provider);
    const outcome = await promise;

    expect(outcome.ok).toBe(true);
    expect(sleeps).toEqual([4000]);
    expect(provider.requests[1]).toEqual(provider.requests[0]);
    expect(outcome.attempts[0]).toMatchObject({ result: 'failed', error: 'Request timed out', rawResponse: null, inputTokens: null });
  });

  it('stops after one retry even when the retry fails differently', async () => {
    const provider = new FakeProvider([new ProviderError('Rate limited', true), reply(INVALID)]);
    const outcome = await run(provider).promise;
    expect(outcome.ok).toBe(false);
    expect(provider.requests).toHaveLength(2);
  });

  it('does not retry a refusal', async () => {
    const provider = new FakeProvider([reply(null, 'refusal')]);
    const { promise, sleeps } = run(provider);
    const outcome = await promise;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('Model declined to describe this image');
    expect(provider.requests).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('does not retry when the answer was cut off at max_tokens', async () => {
    const provider = new FakeProvider([reply('{"observed": {', 'max_tokens')]);
    const outcome = await run(provider).promise;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/max_tokens/);
    expect(provider.requests).toHaveLength(1);
    expect(outcome.attempts[0].rawResponse).toBe('{"observed": {');
  });

  it('does not retry a non-retryable API error such as a 400', async () => {
    const provider = new FakeProvider([new ProviderError('400 invalid_request_error', false)]);
    const outcome = await run(provider).promise;
    expect(outcome.ok).toBe(false);
    expect(provider.requests).toHaveLength(1);
  });

  it('never throws: an unexpected error becomes a failed, non-retried attempt', async () => {
    const provider = new FakeProvider([new TypeError('boom')]);
    const outcome = await run(provider).promise;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/boom/);
    expect(provider.requests).toHaveLength(1);
  });
});
