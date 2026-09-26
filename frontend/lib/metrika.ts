const METRIKA_COUNTER_ID = 112824798;

export const metrikaGoals = {
  openRadarCta: "radar_open_cta_click",
  loginSuccess: "login_success",
  casesView: "cases_view",
} as const;

type MetrikaGoal = (typeof metrikaGoals)[keyof typeof metrikaGoals];

/** Sends a goal only when the Yandex Metrika client is available in the browser. */
export function trackMetrikaGoal(goal: MetrikaGoal) {
  if (typeof window === "undefined") return;

  const ym = (window as Window & { ym?: unknown }).ym;
  if (typeof ym !== "function") return;

  try {
    (ym as (counterId: number, method: "reachGoal", target: MetrikaGoal) => void)(
      METRIKA_COUNTER_ID,
      "reachGoal",
      goal,
    );
  } catch {
    // Analytics must never affect the product flow.
  }
}
