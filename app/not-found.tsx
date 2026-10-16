export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-4">
      <h1 className="text-title text-ink">This link doesn&apos;t open a page</h1>
      <p className="mt-2 text-body text-ink-muted">Check the link, or ask the person who sent it for a new one.</p>
    </main>
  );
}
