"use client";

import { Popover } from "@base-ui/react/popover";
import { CircleHelpIcon } from "lucide-react";
import type { ClientCopy } from "@/lib/copy/client";
import { cn } from "@/lib/utils";

/**
 * "How do I take a screenshot?" beside the composer on a desktop: a small popover with the three
 * steps (the same text the phone's list sheet shows under the reports).
 */
export function HelpPopover({ copy, className }: { copy: ClientCopy; className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "items-center gap-1 rounded-md text-meta text-ink-secondary transition-colors duration-(--motion-fast) hover:text-ink data-[popup-open]:text-ink",
          className,
        )}
      >
        <CircleHelpIcon className="size-3.5" aria-hidden />
        {copy.help.link}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-[min(92vw,360px)] origin-[var(--transform-origin)] rounded-xl border border-line-medium bg-surface p-4 text-ink transition-[opacity,scale] duration-(--motion-fast) data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
            <Popover.Title className="text-label text-ink-muted uppercase">{copy.help.title}</Popover.Title>
            <ol className="mt-2.5 flex flex-col gap-2 text-meta text-ink-secondary">
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
