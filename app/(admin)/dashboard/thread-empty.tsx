import type { ReactNode } from "react";

/** An empty thread: what's missing, what to do about it, and the one action that helps. */
export function ThreadEmpty({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h2 className="text-title text-ink">{title}</h2>
      {body && <p className="mt-1.5 max-w-[46ch] text-body text-ink-secondary">{body}</p>}
      {children && <div className="mt-5 flex flex-col items-center gap-3">{children}</div>}
    </div>
  );
}
