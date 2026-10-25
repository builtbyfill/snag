import { dateTile } from "@/lib/reports/groups";
import { cn } from "@/lib/utils";

/** Day over a short month, the way lists in this product show when something arrived. `small` matches the dashboard's 32px row avatars. */
export function DateTile({ iso, small, className }: { iso: string; small?: boolean; className?: string }) {
  const { day, month } = dateTile(iso);
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 flex-col items-center justify-center rounded-md bg-sunken text-ink", small ? "size-8" : "size-10", className)}
    >
      <span className={cn("leading-none font-semibold", small ? "text-meta" : "text-body")}>{day}</span>
      <span className={cn("text-ink-muted uppercase", small ? "mt-px text-[9px] leading-none tracking-wider" : "mt-0.5 text-label")}>{month}</span>
    </span>
  );
}
