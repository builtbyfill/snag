import { ArrowRightIcon } from "lucide-react";
import { SnagMark } from "@/components/snag-mark";
import { fill, type ClientCopy } from "@/lib/copy/client";
import type { OfficeStatus } from "@/lib/office-hours";

/** "Usually replies the same day" inside office hours, "Back tomorrow at 9:00" outside. */
export function replyLine(copy: ClientCopy, office: OfficeStatus): string {
  return office.open ? copy.header.responseTime : fill(copy.header.back, { when: office.back, time: office.time });
}

/**
 * At the top of a new chat: who this line reaches, how it works in three steps, and how many of
 * this device's reports are still open. The reply expectation lives in the header only.
 */
export function WelcomeBlock({
  copy,
  developerName,
  inProgress,
}: {
  copy: ClientCopy;
  developerName: string | null;
  /** Reports from this device that are not done yet. */
  inProgress: number;
}) {
  const c = copy.intro;
  const count = inProgress === 0 ? null : inProgress === 1 ? c.inProgressOne : fill(c.inProgressMany, { count: String(inProgress) });

  return (
    <section aria-labelledby="intro-title" className="rounded-xl border border-line-medium bg-surface p-4">
      <div className="flex items-start gap-3">
        <SnagMark className="size-8 shrink-0 text-ink [--snag-mark-cut:var(--surface)]" />
        <h1 id="intro-title" className="pt-0.5 text-title text-ink">
          {fill(c.greeting, { name: developerName ?? c.fallbackName })}
        </h1>
      </div>
      <ol aria-label={c.stepsLabel} className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-meta text-ink-secondary">
        {c.steps.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRightIcon aria-hidden className="mr-0.5 size-3.5 text-ink-muted" />}
            <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-sunken text-label text-ink tabular-nums">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      {count && <p className="mt-3 text-meta text-ink-muted">{count}</p>}
    </section>
  );
}
