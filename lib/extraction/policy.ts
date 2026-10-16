import { retryFeedback } from './prompt';
import { ProviderError, type ProviderContent, type ProviderRequest, type VisionProvider } from './provider';
import { extractionFormat, parseExtractionText, type ExtractionOutput } from './schema';

export type ExtractionAttempt = {
  attempt: number;
  result: 'succeeded' | 'failed';
  model: string;
  rawResponse: string | null;
  parsed: ExtractionOutput | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
};

export type ExtractionOutcome =
  | { ok: true; output: ExtractionOutput; attempts: ExtractionAttempt[] }
  | { ok: false; error: string; attempts: ExtractionAttempt[] };

export type PolicyInput = {
  provider: VisionProvider;
  /** Model ID plus prompt version, e.g. "claude-sonnet-5-5@p1"; stored on every attempt. */
  modelLabel: string;
  system: string;
  /** Image first, then the client's sentence. */
  firstTurn: ProviderContent[];
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export const MAX_TOKENS = 8192; // adaptive thinking counts against this; the JSON itself is ~500 tokens
export const TIMEOUT_MS = 60_000;
export const RETRY_DELAY_MS = 4_000;

// What one call ended in, and whether the policy allows a second attempt after it.
type Step =
  | { kind: 'ok'; attempt: ExtractionAttempt; output: ExtractionOutput }
  | { kind: 'invalid'; attempt: ExtractionAttempt; text: string; issues: string[] }
  | { kind: 'retryable' | 'final'; attempt: ExtractionAttempt };

/**
 * scope.md retry policy: one retry with the issues fed back after a validation failure,
 * one retry after a 4 s wait on timeout / 429 / 5xx / connection errors, then stop.
 * Refusals, max_tokens and other errors are not retried. Never throws.
 */
export async function runAttempts(input: PolicyInput): Promise<ExtractionOutcome> {
  const request = (content: ProviderContent[]): ProviderRequest => ({
    system: input.system,
    content,
    format: extractionFormat,
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
  });

  const first = await call(input, 1, request(input.firstTurn));
  if (first.kind === 'ok') return { ok: true, output: first.output, attempts: [first.attempt] };
  if (first.kind === 'final') return failed([first.attempt]);

  let retry: ProviderRequest;
  if (first.kind === 'invalid') {
    retry = request([...input.firstTurn, { type: 'text', text: retryFeedback(first.text, first.issues) }]);
  } else {
    await input.sleep(RETRY_DELAY_MS);
    retry = request(input.firstTurn);
  }

  const second = await call(input, 2, retry);
  const attempts = [first.attempt, second.attempt];
  return second.kind === 'ok' ? { ok: true, output: second.output, attempts } : failed(attempts);
}

function failed(attempts: ExtractionAttempt[]): ExtractionOutcome {
  return { ok: false, error: attempts[attempts.length - 1].error ?? 'Extraction failed', attempts };
}

async function call(input: PolicyInput, n: number, req: ProviderRequest): Promise<Step> {
  const started = input.now();
  const base = { attempt: n, model: input.modelLabel, parsed: null };

  let response;
  try {
    response = await input.provider.complete(req);
  } catch (error) {
    const attempt: ExtractionAttempt = {
      ...base, result: 'failed', rawResponse: null, inputTokens: null, outputTokens: null,
      error: error instanceof Error ? error.message : String(error),
      durationMs: input.now() - started,
    };
    const retryable = error instanceof ProviderError && error.retryable;
    return { kind: retryable ? 'retryable' : 'final', attempt };
  }

  const durationMs = input.now() - started;
  const record = (fields: Pick<ExtractionAttempt, 'result' | 'parsed' | 'error'>): ExtractionAttempt => ({
    ...base, ...fields, rawResponse: response.text,
    inputTokens: response.inputTokens, outputTokens: response.outputTokens, durationMs,
  });

  if (response.stopReason === 'refusal') {
    return { kind: 'final', attempt: record({ result: 'failed', parsed: null, error: 'Model declined to describe this image' }) };
  }
  if (response.stopReason === 'max_tokens') {
    return { kind: 'final', attempt: record({ result: 'failed', parsed: null, error: 'Answer was cut off at max_tokens' }) };
  }
  if (response.stopReason !== 'end_turn') {
    return { kind: 'final', attempt: record({ result: 'failed', parsed: null, error: `Unexpected stop reason: ${response.stopReason}` }) };
  }

  const text = response.text ?? '';
  const parsed = parseExtractionText(text);
  if (parsed.ok) {
    return { kind: 'ok', output: parsed.output, attempt: record({ result: 'succeeded', parsed: parsed.output, error: null }) };
  }
  const error = `Answer did not pass validation:\n${parsed.issues.join('\n')}`;
  return { kind: 'invalid', text, issues: parsed.issues, attempt: record({ result: 'failed', parsed: null, error }) };
}
