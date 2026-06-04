"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchEventApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { CreateBatchEventRequest } from "@/lib/types";

export function useBatchEvents(batchId: number | string, limit = 30, enabled = true) {
  return useQuery({
    queryKey: qk.batches.events(batchId, limit),
    queryFn: () => batchEventApi.recent(batchId, limit),
    enabled: enabled && batchId != null && batchId !== "",
  });
}

export function useCreateEvent(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBatchEventRequest) => batchEventApi.create(batchId, body),
    onSuccess: () => {
      // A mortality event can change currentPopulation and triggers indicator/alert
      // recomputation via DailyRecord propagation. Invalidate the batch detail subtree
      // AND the list so the dashboard head count stays current.
      queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
    },
  });
}
