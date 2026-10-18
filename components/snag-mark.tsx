import { cn } from "@/lib/utils";

/**
 * The Snag mark: a chat bubble holding a hook. To snag is to catch; the bubble is where the
 * client's report arrives. One color (currentColor), readable from 20px up.
 */
export function SnagMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        fill="currentColor"
        d="M7 3h18a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5H14.5l-6.2 5.1A1 1 0 0 1 6.7 28.3V24H7a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z"
      />
      {/* The hook: eye, shank, bend, and a point with its barb. */}
      <circle cx="18.6" cy="7.4" r="1.7" fill="none" stroke="var(--snag-mark-cut, var(--surface, #fff))" strokeWidth="1.8" />
      <path
        fill="none"
        stroke="var(--snag-mark-cut, var(--surface, #fff))"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.6 9.6v5.4a3.9 3.9 0 0 1-7.8 0v-4.2m0 0 2.4 2.4"
      />
    </svg>
  );
}
