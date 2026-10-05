"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { selectionSessionApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { CreateSelectionSessionRequest, SelectionSession } from "@/lib/types";

export function useSelectionSessions(batchId: number | string, enabled = true) {
  return useQuery<SelectionSession[]>({
    queryKey: qk.batches.selectionSessions(batchId),
    queryFn: () => selectionSessionApi.list(batchId),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 30_000,
  });
}

export function useCreateSelectionSession(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSelectionSessionRequest) => selectionSessionApi.create(batchId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionSessions(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(batchId) });
    },
  });
}

export function useUpdateSelectionSession(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, body }: { sessionId: number; body: CreateSelectionSessionRequest }) =>
      selectionSessionApi.update(batchId, sessionId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionSessions(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(batchId) });
    },
  });
}

export function useFinalizeSelectionSession(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => selectionSessionApi.finalize(batchId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionSessions(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(batchId) });
    },
  });
}
