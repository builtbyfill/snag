import type { ProviderRequest, ProviderResponse, VisionProvider } from '@/lib/extraction/provider';

type Step = ProviderResponse | Error;

/** A VisionProvider scripted with one response (or thrown error) per call, recording every request. */
export class FakeProvider implements VisionProvider {
  readonly requests: ProviderRequest[] = [];
  constructor(private readonly steps: Step[]) {}

  async complete(req: ProviderRequest): Promise<ProviderResponse> {
    this.requests.push(req);
    const step = this.steps[this.requests.length - 1];
    if (step === undefined) throw new Error(`FakeProvider: no scripted step for call ${this.requests.length}`);
    if (step instanceof Error) throw step;
    return step;
  }
}

export const reply = (text: string | null, stopReason: ProviderResponse['stopReason'] = 'end_turn'): ProviderResponse => ({
  text,
  stopReason,
  inputTokens: 1500,
  outputTokens: 900,
});
