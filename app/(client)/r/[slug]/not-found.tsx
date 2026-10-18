import { clientCopy } from "@/lib/copy/client";

// A broken report link, inside the client frame.
export default function ReportLinkNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-4 pb-24">
      <h1 className="text-display text-ink">{clientCopy.notFound.heading}</h1>
      <p className="mt-2 text-body text-ink-muted">{clientCopy.notFound.body}</p>
    </main>
  );
}
