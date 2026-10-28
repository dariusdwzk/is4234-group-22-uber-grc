import type { NextConfig } from "next";

// Spec §9. unsafe-inline stays for Next's inline bootstrap scripts and Tailwind; recorded as a limitation.
// unsafe-eval only in `next dev`: React's dev-mode debugging needs eval(); production never does.
const DEV_EVAL = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; script-src 'self' 'unsafe-inline'${DEV_EVAL}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'`,
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  /* config options here */
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
};

export default nextConfig;
