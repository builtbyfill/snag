import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { toProviderError, toProviderResponse } from '@/lib/extraction/claude';

const headers = new Headers();

describe('toProviderError', () => {
  it.each([
    ['timeout', new Anthropic.APIConnectionTimeoutError({ message: 'Request timed out.' })],
    ['connection', new Anthropic.APIConnectionError({ message: 'Connection error.' })],
    ['429', new Anthropic.RateLimitError(429, {}, 'rate limited', headers)],
    ['500', new Anthropic.InternalServerError(500, {}, 'server error', headers)],
    ['529 overloaded', new Anthropic.InternalServerError(529, {}, 'overloaded', headers)],
  ])('marks %s as retryable', (_name, error) => {
    expect(toProviderError(error).retryable).toBe(true);
  });

  it.each([
    ['400', new Anthropic.BadRequestError(400, {}, 'bad request', headers)],
    ['401', new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', headers)],
    ['unknown', new TypeError('boom')],
  ])('marks %s as final', (_name, error) => {
    expect(toProviderError(error).retryable).toBe(false);
  });
});

const message = (content: unknown[], stop_reason: string): Anthropic.Message =>
  ({
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
    content, stop_reason, stop_sequence: null, stop_details: null,
    usage: { input_tokens: 2200, output_tokens: 1400 },
  }) as unknown as Anthropic.Message;

describe('toProviderResponse', () => {
  it('returns only the text blocks, never the thinking blocks', () => {
    const res = toProviderResponse(
      message([{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text: '{"a":1}' }], 'end_turn'),
    );
    expect(res).toEqual({ text: '{"a":1}', stopReason: 'end_turn', inputTokens: 2200, outputTokens: 1400 });
  });

  it('maps refusal and max_tokens, and anything else to "other"', () => {
    expect(toProviderResponse(message([], 'refusal'))).toMatchObject({ text: null, stopReason: 'refusal' });
    expect(toProviderResponse(message([{ type: 'text', text: '{' }], 'max_tokens')).stopReason).toBe('max_tokens');
    expect(toProviderResponse(message([], 'pause_turn')).stopReason).toBe('other');
  });
});
