// Content-Security-Policy is set per request in proxy.ts: it carries a fresh
// script nonce, which a static header here cannot.

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Keep CI and Windows developer builds deterministic on constrained hosts.
  experimental: { cpus: 1 },
  images: {
    formats: ["image/avif", "image/webp"],
    // Artwork is shown at most ~1000 CSS px wide; skip the 2048/3840 variants.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    // Marketing artwork changes infrequently; cache transformed responsive variants for 30 days.
    minimumCacheTTL: 2_592_000,
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
