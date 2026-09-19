/**
 * fetch for the Radar API. The API accepts only requests carrying the signed
 * Arvexo Radar session cookie, so credentials are always included (needed when
 * the API is on another origin in local development). An expired or missing
 * session sends the user back through Arvexo Account sign-in.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (response.status === 401 && typeof window !== "undefined") {
    window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/app")}`);
  }
  return response;
}
