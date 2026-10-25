import { cn } from "@/lib/utils";

/**
 * The Snag mark: a rounded tile holding a fish hook. To snag is to catch. The tile takes
 * currentColor (lime), the hook takes --snag-mark-cut (the ink frame). The hook is centred on the
 * tile and drawn heavy enough to read as a hook from 20px up: eye, shank, bend, point with a barb.
 */
export function SnagMark({ className, title }: { className?: string; title?: string }) {
  const hook = "var(--snag-mark-cut, var(--chrome, #121214))";
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      {/* Eye */}
      <circle cx="19.5" cy="8.6" r="2.3" fill="none" stroke={hook} strokeWidth="2.2" />
      {/* Shank, bend and point */}
      <path
        d="M19.5 10.9V19.6a5.1 5.1 0 0 1-10.2 0V15.4"
        fill="none"
        stroke={hook}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Barb */}
      <path d="M9.3 15.4l3.1 3.1" fill="none" stroke={hook} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
