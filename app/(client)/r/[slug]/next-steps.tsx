import type { ClientCopy } from "@/lib/copy/client";

/**
 * Under a report's timeline: what happens next in three lines, then one contact line when an
 * address is set. The client page names no channel other than email (no WhatsApp).
 */
export function NextSteps({ copy, developerEmail }: { copy: ClientCopy; developerEmail: string | null }) {
  const p = copy.report.panel;
  const [before, after = ""] = copy.report.contactLine.split("{email}");
  return (
    <>
      <section aria-labelledby="next-steps-title" className="max-w-prose">
        <h2 id="next-steps-title" className="text-label text-ink-muted uppercase">
          {p.title}
        </h2>
        <ol className="mt-2.5 flex flex-col gap-2 text-meta text-ink-secondary">
          {p.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
      {developerEmail && (
        <p className="text-meta text-ink-secondary">
          {before}
          <a
            href={`mailto:${developerEmail}`}
            className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {developerEmail}
          </a>
          {after}
        </p>
      )}
    </>
  );
}
