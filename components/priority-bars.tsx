import { cn } from "@/lib/utils";

export type Priority = "low" | "medium" | "high";

const FILLED: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

/**
 * Priority as one, two or three rising bars, monochrome (prd.md > Look and Feel). The word always
 * sits next to it; the unfilled bars stay as faint outlines so the scale reads at a glance.
 */
export function PriorityBars({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cn("size-3 shrink-0", className)}>
      {[4, 7, 10].map((height, i) => (
        <rect
          key={height}
          x={1 + i * 4}
          y={11 - height}
          width="2.4"
          height={height}
          rx="0.6"
          fill="currentColor"
          opacity={i < FILLED[priority] ? 1 : 0.28}
        />
      ))}
    </svg>
  );
}
