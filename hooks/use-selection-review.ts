"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { selectionReviewApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type {
  FinalizeSelectionReviewRequest,
  SelectionReviewPayload,
  SelectionReviewResponse,
} from "@/lib/types";

export function useSelectionReviewPreview(
  batchId: number | string,
  params?: { periodStart?: string; periodEnd?: string; asOfDate?: string },
  enabled = true,
) {
  return useQuery<SelectionReviewPayload>({
    queryKey: qk.batches.selectionReviewPreview(batchId, params?.periodStart, params?.periodEnd),
    queryFn: () => selectionReviewApi.preview(batchId, params),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 30_000,
  });
}

export function useSelectionReviews(batchId: number | string, enabled = true) {
  return useQuery<SelectionReviewResponse[]>({
    queryKey: qk.batches.selectionReviews(batchId),
    queryFn: () => selectionReviewApi.list(batchId),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 30_000,
  });
}

export function useCreateSelectionReview(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { periodStart?: string; periodEnd?: string; asOfDate?: string; purpose?: string; snapshotNote?: string; idempotencyKey?: string }) =>
      selectionReviewApi.create(batchId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviews(batchId) });
    },
  });
}

export function useFinalizeSelectionReview(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, body }: { reviewId: number; body: FinalizeSelectionReviewRequest }) =>
      selectionReviewApi.finalize(batchId, reviewId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviews(batchId) });
    },
  });
}
