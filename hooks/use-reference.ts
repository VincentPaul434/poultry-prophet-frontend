"use client";

// Reference / config data: lifecycle stages, handlers and thresholds.
// These change rarely, so they get long staleTimes.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { handlerApi, lifecycleApi, thresholdApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Threshold, UpdateThresholdRequest } from "@/lib/types";

export function useLifecycleStages() {
  return useQuery({
    queryKey: qk.lifecycleStages,
    queryFn: lifecycleApi.list,
    // Essentially static reference data — never goes stale during a session.
    staleTime: Infinity,
  });
}

export function useHandlers(enabled = true) {
  return useQuery({
    queryKey: qk.handlers,
    queryFn: handlerApi.list,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useThresholds() {
  return useQuery({
    queryKey: qk.thresholds,
    queryFn: thresholdApi.list,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateThresholdRequest }) =>
      thresholdApi.update(id, body),
    onSuccess: (updated: Threshold) => {
      queryClient.setQueryData<Threshold[]>(qk.thresholds, (prev) =>
        prev?.map((t) => (t.id === updated.id ? updated : t))
      );
    },
  });
}
