import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker: `next build` also writes .next/standalone, a server.js with only the files it imports.
  // Vercel (VERCEL=1 during its build) packages the app itself.
  output: process.env.VERCEL ? undefined : "standalone",

  // cacheComponents is off on purpose: every Snag screen is per request (database, session),
  // and notFound() must return a real 404 for unknown report links.

  // Dev only: lets a phone on the same Wi-Fi open the client page via the laptop's private
  // address (e.g. http://10.173.84.129:3000). Has no effect on `next start` or production.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // 4 MB screenshot + multipart overhead, matching Vercel's 4.5 MB body limit. The action
      // itself rejects anything over 4 MB (lib/reports/validate.ts > MAX_BYTES).
      bodySizeLimit: "4.5mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
