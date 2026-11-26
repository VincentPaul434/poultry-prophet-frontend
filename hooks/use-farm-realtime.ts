"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { LIVE_REFRESH_INTERVAL, refreshActiveFarmQueries } from "@/lib/live-refresh";

/** One foreground refresh schedule for the authenticated app. */
export function useFarmRealtime() {
  const { user, authRequired } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.farmId || authRequired) return;
    let lastRefresh = 0;
    const refresh = () => {
      if (!navigator.onLine || document.visibilityState !== "visible" || Date.now() - lastRefresh < 1_000) return;
      lastRefresh = Date.now();
      void refreshActiveFarmQueries(queryClient).catch(() => { /* The mounted query keeps its error/retry state. */ });
    };
    const interval = window.setInterval(refresh, LIVE_REFRESH_INTERVAL);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [authRequired, queryClient, user?.farmId, user?.userId]);
}
