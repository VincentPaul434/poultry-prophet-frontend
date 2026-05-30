"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { birdApi, rangingApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type {
  CreateBirdRequest,
  CreateRangingRecordRequest,
} from "@/lib/types";

export function useBirds(batchId: number | string, enabled = true) {
  return useQuery({
    queryKey: qk.batches.birds(batchId),
    queryFn: () => birdApi.list(batchId),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 60_000,
  });
}

export function useBandBird(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBirdRequest) => birdApi.band(batchId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.birds(batchId) });
    },
  });
}

export function useRangingRecords(
  batchId: number | string,
  birdId: number | string,
  enabled = true
) {
  return useQuery({
    queryKey: qk.batches.ranging(batchId, birdId),
    queryFn: () => rangingApi.list(batchId, birdId),
    enabled: enabled && !!birdId,
  });
}

export function useCreateRangingRecord(
  batchId: number | string,
  birdId: number | string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRangingRecordRequest) =>
      rangingApi.create(batchId, birdId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.ranging(batchId, birdId) });
      // Ranging milestones feed the selection scores.
      queryClient.invalidateQueries({ queryKey: qk.batches.selection(batchId) });
    },
  });
}
