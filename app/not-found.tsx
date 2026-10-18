import { clientCopy } from "@/lib/copy/client";

// Most visitors here mistyped a report link, so this speaks to them.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-4">
      <h1 className="text-display text-ink">{clientCopy.notFound.heading}</h1>
      <p className="mt-2 text-body text-ink-muted">{clientCopy.notFound.body}</p>
    </main>
  );
}
