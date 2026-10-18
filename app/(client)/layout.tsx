import type { Metadata, Viewport } from "next";

// What clients see: report links are private, so keep them out of search engines.
export const metadata: Metadata = { robots: { index: false } };

// viewport-fit=cover lets the page respect the phone's safe area (home indicator).
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#171717" };

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  // The client page is dark (Filip, 2026-10-18): "dark" switches the token set in globals.css.
  // The base text color is set here too: <body> sits outside this wrapper, so anything that
  // inherits its color (typed text in a field) would otherwise get the light theme's ink.
  return (
    <div data-surface="client" className="dark bg-canvas text-ink">
      {children}
    </div>
  );
}
