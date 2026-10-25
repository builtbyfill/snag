/** A status or priority change under its card: one subdued line with its time (Plain-style). */
export function SystemRow({ text, at }: { text: string; at: string }) {
  return (
    <p className="mt-2 flex items-baseline gap-2 pl-1 text-meta text-ink-muted">
      <span aria-hidden className="relative top-[-2px] inline-block size-1.5 rounded-full bg-line-quiet" />
      <span>{text}</span>
      <span className="tabular-nums">{at}</span>
    </p>
  );
}
