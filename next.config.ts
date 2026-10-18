import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker: `next build` also writes .next/standalone, a server.js with only the files it imports.
  output: "standalone",

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
      // 5 MB screenshot + multipart overhead. The action itself still rejects anything over 5 MB.
      bodySizeLimit: "6mb",
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
