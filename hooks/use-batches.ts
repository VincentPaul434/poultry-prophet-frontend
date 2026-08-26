"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Batch, CreateBatchRequest } from "@/lib/types";

export function useBatches() {
  return useQuery({
    queryKey: qk.batches.lists(),
    queryFn: () => batchApi.list(),
  });
}

// Archived (retired) batches — fetched lazily, only when the user opens the section.
export function useArchivedBatches(enabled = true) {
  return useQuery({
    queryKey: qk.batches.archived(),
    queryFn: () => batchApi.list(true),
    enabled,
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

// Clears a manual stage override, returning the batch to age-based auto-progression.
export function useAutoStage(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => batchApi.useAutoStage(batchId),
    onSuccess: (updated: Batch) => {
      queryClient.setQueryData(qk.batches.detail(batchId), updated);
      queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
      queryClient.invalidateQueries({ queryKey: qk.batches.overview(batchId) });
    },
  });
}

// Moves the batch between the working list and the archived list. Both lists are
// invalidated so whichever the user is looking at refreshes.
function useBatchArchiveMutation(
  batchId: number | string,
  action: (id: number | string) => Promise<Batch>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => action(batchId),
    onSuccess: (updated: Batch) => {
      queryClient.setQueryData(qk.batches.detail(batchId), updated);
      queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
      queryClient.invalidateQueries({ queryKey: qk.batches.archived() });
      queryClient.invalidateQueries({ queryKey: qk.batches.overview(batchId) });
    },
  });
}

export function useArchiveBatch(batchId: number | string) {
  return useBatchArchiveMutation(batchId, batchApi.archive);
}

export function useRestoreBatch(batchId: number | string) {
  return useBatchArchiveMutation(batchId, batchApi.restore);
}
