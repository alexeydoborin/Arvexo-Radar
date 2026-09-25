export const RADAR_SESSION_COOKIE = "arvexo_radar_session";
export const RADAR_STATE_COOKIE = "arvexo_radar_sso_state";
export const RADAR_RETURN_COOKIE = "arvexo_radar_return_to";

export interface ArvexoAccountUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export interface RadarSession extends ArvexoAccountUser {
  exp: number;
}

function sessionSecret(): string {
  const configured = process.env.ARVEXO_RADAR_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "arvexo-radar-local-development-secret";
  throw new Error("ARVEXO_RADAR_SESSION_SECRET is required in production");
}

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value: string): string {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function signature(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  let binary = "";
  for (const byte of signed) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function equal(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createRadarSession(user: ArvexoAccountUser): Promise<string> {
  const payload = encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 } satisfies RadarSession));
  return `${payload}.${await signature(payload)}`;
}

export async function readRadarSession(value?: string): Promise<RadarSession | null> {
  if (!value) return null;
  const [payload, suppliedSignature, extra] = value.split(".");
  if (!payload || !suppliedSignature || extra || !equal(suppliedSignature, await signature(payload))) return null;
  try {
    const session = JSON.parse(decode(payload)) as RadarSession;
    if (!session.id || !session.email || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function safeReturnTo(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/app";
  const destination = new URL(value, "https://radar.invalid");
  return destination.origin === "https://radar.invalid"
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/app";
}

export function accountApiUrl(): string {
  return (process.env.ARVEXO_ACCOUNT_API_URL ?? "http://localhost:8032").replace(/\/$/, "");
}

export function radarClientId(): string {
  return process.env.ARVEXO_RADAR_CLIENT_ID ?? "arvexo-radar";
}

export function radarCallbackUrl(origin: string): string {
  const configured = process.env.ARVEXO_RADAR_CALLBACK_URL;
  if (configured) {
    const callback = new URL(configured);
    if (callback.protocol !== "https:" || callback.pathname !== "/auth/callback" || callback.search || callback.hash) {
      throw new Error("ARVEXO_RADAR_CALLBACK_URL must be an HTTPS /auth/callback URL");
    }
    return callback.toString();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ARVEXO_RADAR_CALLBACK_URL is required in production");
  }
  return `${origin}/auth/callback`;
}

/**
 * Build browser-facing Radar URLs from the configured callback origin.
 * Behind a reverse proxy, NextRequest.url can contain the container's
 * internal localhost origin, which must never leak into redirects.
 */
export function radarPublicUrl(path: string, fallbackOrigin: string): URL {
  const publicOrigin = new URL(radarCallbackUrl(fallbackOrigin)).origin;
  return new URL(path, publicOrigin);
}
