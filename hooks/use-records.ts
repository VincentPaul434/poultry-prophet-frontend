"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recordApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { todayIso } from "@/lib/format";
import type { CreateRecordRequest } from "@/lib/types";

export function useRecords(batchId: number | string, limit = 14, enabled = true) {
  return useQuery({
    queryKey: qk.batches.records(batchId, limit),
    queryFn: () => recordApi.recent(batchId, limit),
    enabled: enabled && batchId != null && batchId !== "",
  });
}

export function useCreateRecord(batchId: number | string) {
  const queryClient = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    networkMode: "always",
    mutationFn: async (body: CreateRecordRequest) => {
      for (const value of [body.temperatureC, body.mortalityCount, body.feedIntakeG, body.waterIntakeMl]) {
        if (value != null && !Number.isFinite(value)) throw new Error("Enter valid measurement numbers.");
      }
      if (!Number.isSafeInteger(Number(batchId)) || Number(batchId) <= 0) throw new Error("Choose a valid batch.");
      // Enable only after the matching backend and reviewed receipt migration are deployed.
      // Older backends reject this operation type permanently instead of retrying it.
      if (process.env.NEXT_PUBLIC_OFFLINE_DAILY_RECORDS !== "true") {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new Error("Offline measurements are not enabled yet. Reconnect before saving.");
        }
        return recordApi.create(batchId, body);
      }
      const operationId = crypto.randomUUID();
      return enqueue({
        entityType: "DAILY_RECORD",
        batchId: Number(batchId),
        occurredAt: new Date().toISOString(),
        payload: { ...body, recordDate: body.recordDate ?? todayIso(), operationId },
      });
    },
    onSuccess: () => {
      // Daily records feed indicators and alerts; invalidate the batch list too because
      // mortality compatibility imports can change the population.
      queryClient.invalidateQueries({ queryKey: qk.batches.all });
      queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.alertsFarmRoot });
    },
  });
}
