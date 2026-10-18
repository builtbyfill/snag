import type { ClientCopy } from "@/lib/copy/client";
import { Contact, hasContact } from "./contact";

/** Pinned under the list: how to take a screenshot on a phone, and who to contact. */
export function HelpBlock({
  copy,
  ...who
}: {
  copy: ClientCopy;
  projectName: string;
  developerName: string | null;
  developerEmail: string | null;
}) {
  return (
    <div className="flex flex-col gap-5 text-meta text-ink-secondary">
      <section aria-labelledby="help-title">
        <h2 id="help-title" className="text-label text-ink-muted uppercase">
          {copy.help.title}
        </h2>
        <ol className="mt-2.5 flex flex-col gap-2">
          {copy.help.steps.map((lines, i) => (
            <li key={lines[0]} className="grid grid-cols-[1.25rem_1fr] gap-x-1">
              <span aria-hidden className="font-semibold text-ink tabular-nums">
                {i + 1}.
              </span>
              <span className="flex flex-col gap-0.5">
                {lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      </section>
      {hasContact(who) && (
        <section aria-labelledby="help-contact-title">
          <h2 id="help-contact-title" className="text-label text-ink-muted uppercase">
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
