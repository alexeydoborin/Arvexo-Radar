import { NextRequest, NextResponse } from "next/server";

import { radarPublicUrl, RADAR_SESSION_COOKIE } from "@/lib/arvexo-auth";

/**
 * Sign-out is POST-only and same-origin: a GET (or a form on another site)
 * could otherwise log users out from any page that links or embeds the URL.
 */
export function POST(request: NextRequest) {
  const publicOrigin = radarPublicUrl("/", request.nextUrl.origin).origin;
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== publicOrigin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const response = NextResponse.redirect(radarPublicUrl("/", request.nextUrl.origin), 303);
  response.cookies.delete(RADAR_SESSION_COOKIE);
  return response;
}
