"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Batch, CreateBatchRequest } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { getBatchSnapshot, getBatchSnapshots, saveBatchSnapshots } from "@/lib/offline-db";

type BatchListOptions = {
  enabled?: boolean;
};

export function useBatches({ enabled = true }: BatchListOptions = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.batches.lists(),
    queryFn: async () => {
      try {
        const batches = await batchApi.list();
        if (user?.farmId) await saveBatchSnapshots(user.userId, user.farmId, batches);
        return batches;
      } catch (error) {
        if (user?.farmId) {
          const cached = await getBatchSnapshots(user.userId, user.farmId);
          if (cached.length > 0) return cached;
        }
        throw error;
      }
    },
    enabled,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useBatch(batchId: number | string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.batches.detail(batchId),
    queryFn: async () => {
      try {
        const batch = await batchApi.get(batchId);
        if (user?.farmId) await saveBatchSnapshots(user.userId, user.farmId, [batch]);
        return batch;
      } catch (error) {
        if (user?.farmId) {
          const cached = await getBatchSnapshot(user.userId, user.farmId, Number(batchId));
          if (cached) return cached;
        }
        throw error;
      }
    },
    enabled: enabled && batchId != null && batchId !== "",
  });
}

// Composite dashboard payload (batch + latest indicator + recent records +
// active alerts). Kept short-lived since it backs the live dashboard.
export function useBatchOverview(batchId: number | string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.batches.overview(batchId),
    queryFn: async () => {
      try {
        return await batchApi.overview(batchId);
      } catch (error) {
        if (user?.farmId) {
          const batch = await getBatchSnapshot(user.userId, user.farmId, Number(batchId));
          if (batch) return { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] };
        }
        throw error;
      }
    },
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
      queryClient.invalidateQueries({ queryKey: qk.batches.dashboard() });
      // Seed the detail cache so navigating to the new batch is instant.
      queryClient.setQueryData(qk.batches.detail(created.id), created);
    },
  });
}

export function useDashboardBatches() {
  return useQuery({
    queryKey: qk.batches.dashboard(),
    queryFn: batchApi.dashboard,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}
