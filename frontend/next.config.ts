import type { NextConfig } from "next";

// The browser only talks to one origin, so the session cookie is first-party and no CORS is needed.
// On Vercel, /api/* is routed to the FastAPI service before it reaches Next.js (see ../vercel.json).
// Locally (and in the e2e tests), Next.js proxies /api/* to BACKEND_URL instead.
const BACKEND_URL = process.env.BACKEND_URL ?? (process.env.VERCEL ? null : "http://localhost:8000");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return BACKEND_URL ? [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }] : [];
  },
};

export default nextConfig;
