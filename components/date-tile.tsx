import { dateTile } from "@/lib/reports/groups";
import { cn } from "@/lib/utils";

/** Day over a short month, the way lists in this product show when something arrived. */
export function DateTile({ iso, className }: { iso: string; className?: string }) {
  const { day, month } = dateTile(iso);
  return (
    <span
      aria-hidden
      className={cn("flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-sunken text-ink", className)}
    >
      <span className="text-body leading-none font-semibold">{day}</span>
      <span className="mt-0.5 text-label text-ink-muted uppercase">{month}</span>
    </span>
  );
}
