import type { Metadata, Viewport } from "next";

// What clients see: report links are private, so keep them out of search engines.
export const metadata: Metadata = { robots: { index: false } };

// viewport-fit=cover lets the page respect the phone's safe area (home indicator).
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#111214" };

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  // data-surface="client" bumps data and meta text for phones (16px inputs avoid iOS zoom).
  return <div data-surface="client">{children}</div>;
}
