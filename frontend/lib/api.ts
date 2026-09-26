/**
 * fetch for the Radar API. The API accepts only requests carrying the signed
 * Arvexo Radar session cookie, so credentials are always included (needed when
 * the API is on another origin in local development). An expired or missing
 * session sends the user back through Arvexo Account sign-in.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (response.status === 401 && typeof window !== "undefined") {
    // Full navigation is intentional: this starts the external account SSO flow.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/app")}`);
  }
  return response;
}

const FAILURE_MESSAGES: Record<number, string> = {
  403: "Недостаточно прав: общие демо-данные меняет только администратор Radar.",
  413: "Файл слишком большой или закончилась квота хранилища.",
  429: "Превышен лимит запросов. Попробуйте позже.",
  507: "Хранилище Radar заполнено. Попробуйте позже.",
};

/** User-facing text for access-control and quota responses, if any. */
export function describeApiFailure(status: number): string | undefined {
  return FAILURE_MESSAGES[status];
}
