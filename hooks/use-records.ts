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
      // A new daily record may change currentPopulation (mortality) and triggers
      // backend indicator/alert recomputation. Invalidate the batch detail subtree
      // (overview, records, indicators, alerts) AND the list so the dashboard head
      // count stays current.
      queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
    },
  });
}
