import { CircleCheckIcon, ImagePlusIcon, MailIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { fill, type ClientCopy } from "@/lib/copy/client";

/**
 * First visit from this device: how it works, what happens next, who is behind it. Plain notes
 * divided by rules, not cards. Contact appears only when there is a name or an address to show.
 */
export function WelcomeNotes({
  copy,
  projectName,
  developerName,
  developerEmail,
}: {
  copy: ClientCopy;
  projectName: string;
  developerName: string | null;
  developerEmail: string | null;
}) {
  const c = copy.welcome;
  return (
    <dl className="divide-y divide-line">
      <Note icon={<ImagePlusIcon className="size-5" aria-hidden />} title={c.how.title}>
        {c.how.body}
      </Note>
      <Note icon={<CircleCheckIcon className="size-5" aria-hidden />} title={c.next.title}>
        {c.next.body}
      </Note>
      {(developerName || developerEmail) && (
        <Note icon={<UserRoundIcon className="size-5" aria-hidden />} title={c.contact.title}>
          {fill(c.contact.body, { name: developerName ?? c.contact.fallbackName, project: projectName })}
          {developerEmail && (
            <a
              href={`mailto:${developerEmail}`}
              className="mt-1 flex min-h-11 items-center gap-2 font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              <MailIcon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{developerEmail}</span>
            </a>
          )}
        </Note>
      )}
    </dl>
  );
}

function Note({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr] gap-x-3 py-4 first:pt-0 last:pb-0">
      <span className="pt-0.5 text-ink-secondary">{icon}</span>
      <dt className="text-body font-semibold text-ink">{title}</dt>
      <dd className="col-start-2 mt-1 text-meta text-ink-secondary">{children}</dd>
    </div>
  );
}
