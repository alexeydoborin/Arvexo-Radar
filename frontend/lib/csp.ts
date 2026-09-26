/**
 * Content-Security-Policy with a per-request nonce instead of 'unsafe-inline'
 * for scripts: an HTML injection can no longer execute inline JavaScript.
 * 'strict-dynamic' lets the nonce'd Next.js and Yandex Metrika loaders pull in
 * the scripts they create themselves.
 */
export function contentSecurityPolicy(nonce: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  // `next dev` needs eval for React refresh, and the local API lives on
  // another origin (localhost:8000); production keeps the API same-origin.
  const scriptSrc = `'self' 'nonce-${nonce}' 'strict-dynamic' https://mc.yandex.ru${isProduction ? "" : " 'unsafe-eval'"}`;
  const connectSrc = isProduction ? "'self' https://mc.yandex.ru" : "'self' http://localhost:8000 https://mc.yandex.ru";
  return [
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
}

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}
