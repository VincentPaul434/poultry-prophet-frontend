"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertApi, indicatorApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Alert } from "@/lib/types";

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
    onSuccess: (_ack: Alert) => {
      // Acknowledgement changes alert lists and the overview's active-alert set.
      queryClient.invalidateQueries({ queryKey: qk.batches.overview(batchId) });
      queryClient.invalidateQueries({
        queryKey: [...qk.batches.detail(batchId), "alerts"],
      });
    },
  });
}
