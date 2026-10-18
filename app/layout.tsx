import type { Metadata } from "next";
import { fontClasses } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snag",
  description: "Screenshot in, ticket out.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontClasses} h-full antialiased`}>
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
