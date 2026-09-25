"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/query-keys";

/** Refreshes active batch data periodically without a direct backend connection. */
export function useFarmRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.farmId) return;

    const interval = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: qk.batches.all });
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [queryClient, user?.farmId]);
}
