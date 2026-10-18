import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// One family for everything. latin-ext carries č ć đ š ž. Self-hosted by Next at build time.
export const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
});

// Mono only for the copyable report URL.
export const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: "400",
});

export const fontClasses = `${plexSans.variable} ${plexMono.variable}`;
