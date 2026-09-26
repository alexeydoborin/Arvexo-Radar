import { NextRequest, NextResponse } from "next/server";

import { RADAR_SESSION_COOKIE, readRadarSession } from "@/lib/arvexo-auth";
import { contentSecurityPolicy, createNonce } from "@/lib/csp";

function isDashboard(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

export async function proxy(request: NextRequest) {
  if (isDashboard(request.nextUrl.pathname)) {
    const session = await readRadarSession(request.cookies.get(RADAR_SESSION_COOKIE)?.value);
    if (!session) {
      const login = new URL("/auth/login", request.url);
      login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
  }

  // Next.js reads the nonce from the request's CSP header and stamps it on
  // its own scripts; the layout reads x-nonce for the Metrika snippet.
  const nonce = createNonce();
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Documents only: static assets and image optimisation need no nonce.
      source: "/((?!_next/static|_next/image|assets/|brand/|images/|favicon.ico|robots.txt|sitemap.xml|llms.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
