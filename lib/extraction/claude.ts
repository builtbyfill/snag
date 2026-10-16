import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { ProviderError, type ProviderRequest, type ProviderResponse, type VisionProvider } from './provider';

/** The only production adapter. The Anthropic client is constructed nowhere else. */
export class ClaudeProvider implements VisionProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string) {
    // maxRetries: 0 — policy.ts owns the retry policy; the SDK default of 2 would silently exceed scope.md.
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
  }

  async complete(req: ProviderRequest): Promise<ProviderResponse> {
    try {
      // No temperature/top_p/top_k: non-default values are a 400 on claude-sonnet-5-5.
      // Adaptive thinking is on by default on this model and counts against max_tokens.
      const message = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [
            {
              role: 'user',
              content: req.content.map((block) =>
                block.type === 'image'
                  ? { type: 'image' as const, source: { type: 'base64' as const, media_type: block.mimeType, data: block.data.toString('base64') } }
                  : { type: 'text' as const, text: block.text },
              ),
            },
          ],
          output_config: { format: req.format },
        },
        { timeout: req.timeoutMs },
      );
      return toProviderResponse(message);
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

export function toProviderResponse(message: Anthropic.Message): ProviderResponse {
  // Thinking blocks come first on this model; only text blocks carry the JSON answer.
  const texts = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : []));
  const stop = message.stop_reason;
  return {
    text: texts.length > 0 ? texts.join('') : null,
    stopReason: stop === 'end_turn' || stop === 'max_tokens' || stop === 'refusal' ? stop : 'other',
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

export function toProviderError(error: unknown): ProviderError {
  // Most specific first: timeouts are a subclass of connection errors.
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('Request timed out', true);
  if (error instanceof Anthropic.APIConnectionError) return new ProviderError(`Connection error: ${error.message}`, true);
  if (error instanceof Anthropic.RateLimitError) return new ProviderError(`Rate limited (429): ${error.message}`, true);
  if (error instanceof Anthropic.InternalServerError) return new ProviderError(`Server error (${error.status}): ${error.message}`, true);
  if (error instanceof Anthropic.APIError) return new ProviderError(`API error (${error.status}): ${error.message}`, false);
  return new ProviderError(error instanceof Error ? error.message : String(error), false);
}
