import type { Metadata, Viewport } from "next";

// The developer's side: never indexed.
export const metadata: Metadata = { robots: { index: false } };

export const viewport: Viewport = { viewportFit: "cover", themeColor: "#171717" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Dark like the client page: the same tokens under "dark". The text color is set here because
  // <body> sits outside this wrapper.
  return (
    <div data-surface="admin" className="dark min-h-dvh bg-canvas text-ink">
      {children}
    </div>
  );
}
