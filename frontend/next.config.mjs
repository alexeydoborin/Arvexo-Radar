const isProduction = process.env.NODE_ENV === "production";

// Production keeps the strict policy (the API is same-origin behind nginx).
// `next dev` needs eval for React refresh, and the local API lives on another
// origin (localhost:8000), so relax only those two directives outside production.
const scriptSrc = isProduction
  ? "'self' 'unsafe-inline' https://mc.yandex.ru"
  : "'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru";
const connectSrc = isProduction
  ? "'self' https://mc.yandex.ru"
  : "'self' http://localhost:8000 https://mc.yandex.ru";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src ${connectSrc}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://mc.yandex.ru",
  "object-src 'none'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
