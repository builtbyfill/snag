"use client";

import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryExtractionAction } from "@/app/actions/tickets";
import { Spinner } from "@/components/ui/spinner";
import { adminCopy } from "@/lib/copy/admin";
import { cn } from "@/lib/utils";

/**
 * Puts a failed ticket back to reading. On the card the thread's 3-second refresh follows it;
 * on the detail page the page refreshes itself the same way while the ticket is pending.
 */
export function RetryButton({ ticketId, className }: { ticketId: string; className?: string }) {
  const c = adminCopy.card;
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const [problem, setProblem] = useState(false);

  return (
    <span className={cn("relative z-10 flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        disabled={retrying}
        onClick={() => {
          setProblem(false);
          startRetry(async () => {
            try {
              await retryExtractionAction(ticketId);
              router.refresh();
            } catch {
              setProblem(true);
            }
          });
        }}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-canvas px-3 text-meta font-medium text-ink transition-colors hover:bg-sunken disabled:opacity-60 pointer-coarse:h-11"
      >
        {retrying ? <Spinner className="size-3.5" aria-hidden /> : <RotateCcwIcon className="size-3.5" aria-hidden />}
        {retrying ? c.retrying : c.retry}
      </button>
      {problem && (
        <span role="alert" className="text-meta text-ink">
          {c.retryFailed}
        </span>
      )}
    </span>
  );
}
