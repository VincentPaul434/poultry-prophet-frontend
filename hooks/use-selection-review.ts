"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { selectionReviewApi } from "@/lib/api";
import { shouldUseOfflineSnapshot } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { getSelectionReviewSnapshot, saveSelectionReviewSnapshot } from "@/lib/offline-db";
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
  const { user } = useAuth();
  return useQuery<SelectionReviewPayload>({
    networkMode: "always",
    queryKey: qk.batches.selectionReviewPreview(batchId, params),
    queryFn: async () => {
      try {
        const payload = await selectionReviewApi.preview(batchId, params);
        if (user?.farmId) {
          try { await saveSelectionReviewSnapshot(user.userId, user.farmId, Number(batchId), payload, params, user.role); } catch { /* A full device must not block online reports. */ }
        }
        return payload;
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        try {
          const cached = await getSelectionReviewSnapshot(user.userId, user.farmId, Number(batchId), params, user.role);
          if (cached) return cached;
        } catch { /* Preserve the API error if browser storage is unavailable. */ }
        throw error;
      }
    },
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}

export function useSelectionReviews(batchId: number | string, enabled = true) {
  return useQuery<SelectionReviewResponse[]>({
    queryKey: qk.batches.selectionReviews(batchId),
    queryFn: () => selectionReviewApi.list(batchId),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
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
