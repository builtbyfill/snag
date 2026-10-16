/** One user turn: content blocks in order (image first, then text). */
export type ProviderContent =
  | { type: 'image'; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; data: Buffer }
  | { type: 'text'; text: string };

export type ProviderRequest = {
  system: string;
  content: ProviderContent[];
  format: { type: 'json_schema'; schema: Record<string, unknown> };
  maxTokens: number;
  timeoutMs: number;
};

export type ProviderResponse = {
  text: string | null;
  stopReason: 'end_turn' | 'max_tokens' | 'refusal' | 'other';
  inputTokens: number;
  outputTokens: number;
};

/** The one seam inside `lib/extraction`: ClaudeProvider in production, FakeProvider in tests. */
export interface VisionProvider {
  complete(req: ProviderRequest): Promise<ProviderResponse>;
}

/**
 * Thrown by a provider for API and network failures. `retryable` is true for timeouts,
 * rate limits, 5xx and connection errors; false for everything else (e.g. a 400).
 */
export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'ProviderError';
  }
}
