import { NextRequest, NextResponse } from "next/server";

import { accountApiUrl, createRadarSession, radarCallbackUrl, radarClientId, radarPublicUrl, RADAR_RETURN_COOKIE, RADAR_SESSION_COOKIE, RADAR_STATE_COOKIE, safeReturnTo, type ArvexoAccountUser } from "@/lib/arvexo-auth";

export const dynamic = "force-dynamic";

function authError(request: NextRequest, code: string) {
  return NextResponse.redirect(radarPublicUrl(`/auth/error?reason=${encodeURIComponent(code)}`, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(RADAR_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) return authError(request, "invalid_state");

  const clientSecret = process.env.ARVEXO_RADAR_CLIENT_SECRET;
  if (!clientSecret) return authError(request, "missing_configuration");

  try {
    const exchange = await fetch(`${accountApiUrl()}/sso/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: radarClientId(), client_secret: clientSecret, code, redirect_uri: radarCallbackUrl(request.nextUrl.origin) }),
      cache: "no-store",
    });
    if (!exchange.ok) return authError(request, "exchange_failed");
    const body = await exchange.json() as { account_user?: ArvexoAccountUser };
    if (!body.account_user?.id || !body.account_user.email) return authError(request, "invalid_profile");

    const returnTo = safeReturnTo(request.cookies.get(RADAR_RETURN_COOKIE)?.value ?? null);
    const destination = radarPublicUrl(returnTo, request.nextUrl.origin);
    destination.searchParams.set("metrika_login", "success");
    const response = NextResponse.redirect(destination);
    response.cookies.set(RADAR_SESSION_COOKIE, await createRadarSession(body.account_user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    response.cookies.delete(RADAR_STATE_COOKIE);
    response.cookies.delete(RADAR_RETURN_COOKIE);
    return response;
  } catch {
    return authError(request, "account_unavailable");
  }
}
