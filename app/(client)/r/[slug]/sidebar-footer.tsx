"use client";

import { Popover } from "@base-ui/react/popover";
import { SettingsIcon } from "lucide-react";
import type { ClientCopy } from "@/lib/copy/client";
import { initials } from "@/lib/utils";
import { HelpBlock } from "./help-block";

/**
 * The bottom of the desktop sidebar, like the dashboard's nav footer: the account row (this
 * client's project) and Settings, which opens the help and contact (there is no account to sign
 * out of and nothing to configure yet, so the popover holds what the client may need).
 */
export function SidebarFooter({
  copy,
  ...who
}: {
  copy: ClientCopy;
  projectName: string;
  developerName: string | null;
  developerEmail: string | null;
}) {
  return (
    <div className="shrink-0 border-t border-line p-2">
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-meta font-semibold text-ink">
          {initials(who.projectName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-ink">{who.projectName}</span>
          <span className="block truncate text-meta text-ink-muted">{copy.list.account}</span>
        </span>
      </div>
      <Popover.Root>
        <Popover.Trigger className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-body text-ink-secondary transition-colors hover:bg-hover hover:text-ink data-[popup-open]:bg-hover data-[popup-open]:text-ink pointer-coarse:h-11">
          <SettingsIcon className="size-4 shrink-0" aria-hidden />
          {copy.list.settings}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top" align="start" sideOffset={8} className="z-50 outline-none">
            <Popover.Popup className="w-[min(92vw,320px)] origin-[var(--transform-origin)] rounded-xl border border-line-medium bg-surface p-4 text-ink transition-[opacity,scale] duration-(--motion-fast) data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
              <Popover.Title className="sr-only">{copy.list.settings}</Popover.Title>
              <HelpBlock copy={copy} {...who} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
