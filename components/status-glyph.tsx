import { cn } from "@/lib/utils";

export type TicketStatus = "new" | "in_progress" | "done";

/**
 * Workflow status as a monochrome glyph: empty circle, half circle, check. Status never borrows
 * a state color (prd.md > Look and Feel); the text label always sits next to it.
 */
export function StatusGlyph({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("size-4 shrink-0", className)}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {status === "in_progress" && <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />}
      {status === "done" && (
        <path
          d="m5.2 8.2 1.9 1.9 3.8-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
