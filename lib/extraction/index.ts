import { readExtractionEnv, type ExtractionEnv } from '@/lib/env';
import { ClaudeProvider } from './claude';
import { downscale, type ImageMime } from './image';
import { runAttempts, type ExtractionOutcome } from './policy';
import { PROMPT_VERSION, SYSTEM_PROMPT, userTurnText } from './prompt';
import type { VisionProvider } from './provider';

export type { ExtractionAttempt, ExtractionOutcome } from './policy';
export type { ExtractionOutput } from './schema';

export type ExtractionInput = { image: Buffer; mimeType: ImageMime; sentence: string };

export type ExtractionDeps = {
  provider?: VisionProvider;
  env?: Pick<ExtractionEnv, 'EXTRACTION_MODEL' | 'EXTRACTION_MAX_EDGE'> & Partial<Pick<ExtractionEnv, 'ANTHROPIC_API_KEY'>>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * The one extraction function, called by the server action path and the eval runner.
 * Never throws for model, network or image problems (they come back as ok: false), never
 * touches the database or the file system, and lists every attempt made, in order.
 */
export async function extractTicket(input: ExtractionInput, deps: ExtractionDeps = {}): Promise<ExtractionOutcome> {
  const env = deps.env ?? readExtractionEnv();

  let image;
  try {
    image = await downscale(input.image, input.mimeType, env.EXTRACTION_MAX_EDGE);
  } catch (error) {
    return { ok: false, error: `Couldn't read the screenshot: ${(error as Error).message}`, attempts: [] };
  }

  const provider = deps.provider ?? new ClaudeProvider(env.ANTHROPIC_API_KEY ?? readExtractionEnv().ANTHROPIC_API_KEY, env.EXTRACTION_MODEL);

  return runAttempts({
    provider,
    modelLabel: `${env.EXTRACTION_MODEL}@${PROMPT_VERSION}`,
    system: SYSTEM_PROMPT,
    // Image before text: Claude works best when images come first.
    firstTurn: [
      { type: 'image', mimeType: image.mimeType, data: image.data },
      { type: 'text', text: userTurnText(input.sentence) },
    ],
    now: deps.now ?? Date.now,
    sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
  });
}
