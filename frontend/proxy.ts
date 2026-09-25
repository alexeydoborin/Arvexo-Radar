import { NextRequest, NextResponse } from "next/server";

import { RADAR_SESSION_COOKIE, readRadarSession } from "@/lib/arvexo-auth";

export async function proxy(request: NextRequest) {
  const session = await readRadarSession(request.cookies.get(RADAR_SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  const login = new URL("/auth/login", request.url);
  login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/app/:path*"] };
