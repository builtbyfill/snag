import { MailIcon } from "lucide-react";
import { fill, type ClientCopy } from "@/lib/copy/client";

type Who = { projectName: string; developerName: string | null; developerEmail: string | null };

export const hasContact = (who: Pick<Who, "developerName" | "developerEmail">) => Boolean(who.developerName || who.developerEmail);

/** "<name> looks after <project>." plus a mail link when an address is set. */
export function Contact({ copy, projectName, developerName, developerEmail }: { copy: ClientCopy } & Who) {
  const c = copy.welcome.contact;
  return (
    <>
      {fill(c.body, { name: developerName ?? c.fallbackName, project: projectName })}
      {developerEmail && (
        <a
          href={`mailto:${developerEmail}`}
          className="mt-1 flex min-h-9 items-center gap-2 font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink pointer-coarse:min-h-11"
        >
          <MailIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{developerEmail}</span>
        </a>
      )}
    </>
  );
}
