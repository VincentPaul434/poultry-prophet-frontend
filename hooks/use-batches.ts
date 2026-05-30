"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Batch, CreateBatchRequest } from "@/lib/types";

export function useBatches() {
  return useQuery({
    queryKey: qk.batches.lists(),
    queryFn: batchApi.list,
  });
}

export function useBatch(batchId: number | string, enabled = true) {
  return useQuery({
    queryKey: qk.batches.detail(batchId),
    queryFn: () => batchApi.get(batchId),
    enabled: enabled && batchId != null && batchId !== "",
  });
}

// Composite dashboard payload (batch + latest indicator + recent records +
// active alerts). Kept short-lived since it backs the live dashboard.
export function useBatchOverview(batchId: number | string, enabled = true) {
  return useQuery({
    queryKey: qk.batches.overview(batchId),
    queryFn: () => batchApi.overview(batchId),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 15_000,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBatchRequest) => batchApi.create(body),
    onSuccess: (created: Batch) => {
      queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
      // Seed the detail cache so navigating to the new batch is instant.
      queryClient.setQueryData(qk.batches.detail(created.id), created);
    },
  });
}

export function useChangeStage(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: number) => batchApi.changeStage(batchId, stageId),
    onSuccess: (updated: Batch) => {
      queryClient.setQueryData(qk.batches.detail(batchId), updated);
      queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
      queryClient.invalidateQueries({ queryKey: qk.batches.overview(batchId) });
    },
  });
}
