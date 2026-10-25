import type { ClientCopy } from "@/lib/copy/client";
import { Contact, hasContact } from "./contact";

/** The right pane while no report is selected: how it works in three steps, then contact. */
export function HowItWorks({
  copy,
  ...who
}: {
  copy: ClientCopy;
  projectName: string;
  developerName: string | null;
  developerEmail: string | null;
}) {
  const c = copy.intro;
  return (
    <div className="flex flex-col gap-5 text-meta text-ink-secondary">
      <section aria-labelledby="how-title">
        <h2 id="how-title" className="text-label text-ink-muted uppercase">
          {c.stepsLabel}
        </h2>
        <ol className="mt-2.5 flex flex-col gap-2">
          {c.steps.map((step, i) => (
            <li key={step} className="grid grid-cols-[1.25rem_1fr] gap-x-1">
              <span aria-hidden className="font-semibold text-ink tabular-nums">
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
      {hasContact(who) && (
        <section aria-labelledby="how-contact-title">
          <h2 id="how-contact-title" className="text-label text-ink-muted uppercase">
            {copy.welcome.contact.title}
          </h2>
          <p className="mt-2">
            <Contact copy={copy} {...who} />
          </p>
        </section>
      )}
    </div>
  );
}
