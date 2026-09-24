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
    mutationFn: (body: CreateBatchEventRequest) =>
      batchEventApi.create(batchId, {
        ...body,
        operationId: body.operationId ?? crypto.randomUUID(),
      }),
    onSuccess: () => {
      // Mortality changes the batch list and all batch-scoped derived data, plus the
      // manager's farm-wide notification feed.
      queryClient.invalidateQueries({ queryKey: qk.batches.all });
      queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
      queryClient.invalidateQueries({ queryKey: ["alerts", "farm"] });
    },
  });
}
