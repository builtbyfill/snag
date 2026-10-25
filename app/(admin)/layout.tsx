import type { Metadata, Viewport } from "next";

// The developer's side: never indexed.
export const metadata: Metadata = { robots: { index: false } };

export const viewport: Viewport = { viewportFit: "cover", themeColor: "#121214" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Light, like the client page (Filip, 2026-10-25). The text color is set here because
  // <body> sits outside this wrapper.
  return (
    <div data-surface="admin" className="min-h-dvh bg-canvas text-ink">
      {children}
    </div>
  );
}
