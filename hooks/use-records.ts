"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recordApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
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
  return useMutation({
    mutationFn: (body: CreateRecordRequest) => recordApi.create(batchId, body),
    onSuccess: () => {
      // Daily records feed indicators and alerts; invalidate the batch list too because
      // mortality compatibility imports can change the population.
      queryClient.invalidateQueries({ queryKey: qk.batches.all });
      queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
      queryClient.invalidateQueries({ queryKey: ["alerts", "farm"] });
    },
  });
}
