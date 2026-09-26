"use client";

import { useEffect } from "react";
import { metrikaGoals, trackMetrikaGoal } from "@/lib/metrika";

export function MetrikaLoginTracker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("metrika_login") !== "success") return;

    trackMetrikaGoal(metrikaGoals.loginSuccess);
    url.searchParams.delete("metrika_login");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return null;
}
