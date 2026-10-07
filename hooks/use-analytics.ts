"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertApi, indicatorApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export function useLatestIndicator(batchId: number | string, enabled = true) {
  return useQuery({
    queryKey: qk.batches.indicatorsLatest(batchId),
    queryFn: () => indicatorApi.latest(batchId),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 15_000,
  });
}

export function useIndicators(batchId: number | string, limit = 14, enabled = true) {
  return useQuery({
    queryKey: qk.batches.indicators(batchId, limit),
    queryFn: () => indicatorApi.recent(batchId, limit),
    enabled: enabled && batchId != null && batchId !== "",
  });
}

export function useAlerts(
  batchId: number | string,
  opts: { activeOnly?: boolean; limit?: number; enabled?: boolean } = {}
) {
  const { activeOnly = false, limit = 50, enabled = true } = opts;
  return useQuery({
    queryKey: qk.batches.alerts(batchId, activeOnly, limit),
    queryFn: () => alertApi.list(batchId, activeOnly, limit),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 15_000,
  });
}

export function useAcknowledgeAlert(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      alertApi.acknowledge(id, note),
    onSuccess: () => {
      // Acknowledgement changes alert lists and the overview's active-alert set.
      queryClient.invalidateQueries({ queryKey: qk.batches.overview(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.alertsRoot(batchId) });
      // Also refresh the farm-wide notifications feed.
      queryClient.invalidateQueries({ queryKey: qk.alertsFarmRoot });
    },
  });
}

// ─── Farm-wide notifications centre ──────────────────────────────────────────

export function useFarmAlerts(activeOnly = true, enabled = true) {
  return useQuery({
    queryKey: qk.alertsFarm(activeOnly),
    queryFn: () => alertApi.listFarm(activeOnly, 100),
    enabled,
    staleTime: 15_000,
    // WebSocket invalidation is the fast path. Keep a slower visible-tab
    // fallback for reconnects or events emitted by older backend versions.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useAcknowledgeFarmAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      alertApi.acknowledge(id, note),
    onSuccess: () => {
      // Acknowledging from the centre affects the farm feed, every per-batch
      // alert list, and batch overviews' active-alert sets.
      queryClient.invalidateQueries({ queryKey: qk.alertsFarmRoot });
      queryClient.invalidateQueries({ queryKey: qk.batches.all });
    },
  });
}
