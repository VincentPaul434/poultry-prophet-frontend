"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchEventApi } from "@/lib/api";
import { useOfflineSync } from "@/lib/offline-sync-provider";
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
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async (body: CreateBatchEventRequest) => {
      const operationId = body.operationId ?? crypto.randomUUID();
      await enqueue({
        entityType: "BATCH_EVENT",
        batchId: Number(batchId),
        occurredAt: `${body.eventDate ?? new Date().toISOString().slice(0, 10)}T12:00:00.000Z`,
        payload: { ...body, operationId },
      });
      return { operationId };
    },
    onSuccess: () => {
      // Mortality changes the batch list and all batch-scoped derived data, plus the
      // manager's farm-wide notification feed.
      queryClient.invalidateQueries({ queryKey: qk.batches.all });
      queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
      queryClient.invalidateQueries({ queryKey: ["alerts", "farm"] });
    },
  });
}
