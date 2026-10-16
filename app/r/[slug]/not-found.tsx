import { clientCopy, DEFAULT_CLIENT_LOCALE } from "@/lib/i18n/client-copy";

// A broken report link is seen by clients, so it speaks their language.
export default function ReportLinkNotFound() {
  const copy = clientCopy[DEFAULT_CLIENT_LOCALE].notFound;
  return (
    <div lang={DEFAULT_CLIENT_LOCALE} className="flex flex-1 flex-col justify-center pb-24">
      <h1 className="text-title text-ink">{copy.heading}</h1>
      <p className="mt-2 text-body text-ink-muted">{copy.body}</p>
    </div>
  );
}
