// Client-facing surface: phone-first, bigger body text (data-surface="client" bumps the type scale).
export default function ClientLayout({ children }: LayoutProps<"/r">) {
  return (
    <div data-surface="client" className="min-h-dvh bg-canvas text-body text-ink">
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-8">{children}</main>
    </div>
  );
}

// Lets the pinned Send button respect the phone's safe area (home indicator).
export const viewport = { viewportFit: "cover" };
