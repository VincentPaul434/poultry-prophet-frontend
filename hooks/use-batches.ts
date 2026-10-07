"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "@/lib/api";
import { shouldUseOfflineSnapshot } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Batch, CreateBatchRequest } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import type { StoredUser } from "@/lib/auth-storage";
import {
  getBatchOverviewSnapshot,
  getBatchSnapshot,
  getBatchSnapshots,
  getDashboardSnapshot,
  getQueuedPopulationDelta,
  saveBatchOverviewSnapshot,
  saveBatchSnapshots,
  saveDashboardSnapshot,
} from "@/lib/offline-db";

type BatchListOptions = {
  enabled?: boolean;
};

async function withQueuedPopulation<T extends { id: number; currentPopulation: number }>(
  batch: T,
  user: Pick<StoredUser, "userId" | "farmId"> | null,
) {
  if (!user?.farmId) return batch;
  try {
    const delta = await getQueuedPopulationDelta(user.userId, user.farmId, batch.id);
    return { ...batch, currentPopulation: batch.currentPopulation + delta };
  } catch {
    return batch;
  }
}

export function useBatches({ enabled = true }: BatchListOptions = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.batches.lists(),
    queryFn: async () => {
      try {
        const batches = await batchApi.list();
        if (user?.farmId) {
          try { await saveBatchSnapshots(user.userId, user.farmId, batches); } catch { /* Keep online reads available if local storage is full. */ }
        }
        return batches;
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error)) throw error;
        if (user?.farmId) {
          try {
            const cached = await getBatchSnapshots(user.userId, user.farmId);
            if (cached.length > 0) return Promise.all(cached.map((batch) => withQueuedPopulation(batch, user)));
          } catch { /* Preserve the API error if local storage is unavailable. */ }
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
        if (user?.farmId) {
          try { await saveBatchSnapshots(user.userId, user.farmId, [batch]); } catch { /* Keep online reads available if local storage is full. */ }
        }
        return batch;
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error)) throw error;
        if (user?.farmId) {
          try {
            const cached = await getBatchSnapshot(user.userId, user.farmId, Number(batchId));
            if (cached) return withQueuedPopulation(cached, user);
          } catch { /* Preserve the API error if local storage is unavailable. */ }
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
        const overview = await batchApi.overview(batchId);
        if (user?.farmId) {
          try {
            await Promise.all([
              saveBatchSnapshots(user.userId, user.farmId, [overview.batch]),
              saveBatchOverviewSnapshot(user.userId, user.farmId, overview),
            ]);
          } catch { /* Keep online reads available if local storage is full. */ }
        }
        return overview;
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error)) throw error;
        if (user?.farmId) {
          try {
            const cachedOverview = await getBatchOverviewSnapshot(user.userId, user.farmId, Number(batchId));
            if (cachedOverview) {
              return { ...cachedOverview, batch: await withQueuedPopulation(cachedOverview.batch, user) };
            }
            const batch = await getBatchSnapshot(user.userId, user.farmId, Number(batchId));
            if (batch) return { batch: await withQueuedPopulation(batch, user), latestIndicator: null, recentRecords: [], activeAlerts: [] };
          } catch { /* Preserve the API error if local storage is unavailable. */ }
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.userId;
  const farmId = user?.farmId;

  // Warm the in-memory cache from IndexedDB on reload. The live query still
  // starts immediately, so cached dashboard data appears while it refreshes.
  useEffect(() => {
    if (userId == null || farmId == null) return;

    const queryKey = qk.batches.dashboard();
    if (queryClient.getQueryData(queryKey) !== undefined) return;

    let cancelled = false;
    const userScope = { userId, farmId };
    void getDashboardSnapshot(userId, farmId)
      .then(async (cached) => {
        if (!cached || cancelled || queryClient.getQueryData(queryKey) !== undefined) return;

        const items = await Promise.all(cached.map(async (item) => ({
          ...item,
          batch: await withQueuedPopulation(item.batch, userScope),
        })));

        // A fast live response wins if it arrived while IndexedDB was opening.
        if (!cancelled && queryClient.getQueryData(queryKey) === undefined) {
          const liveRequestInFlight = queryClient.getQueryState(queryKey)?.fetchStatus === "fetching";
          queryClient.setQueryData(queryKey, items, { updatedAt: 0 });
          // Keep the snapshot visible, but make sure a live request refreshes it.
          if (!liveRequestInFlight) {
            void queryClient.invalidateQueries({ queryKey, exact: true });
          }
        }
      })
      .catch(() => {
        // Snapshot hydration must not interfere with the live dashboard query.
      });

    return () => {
      cancelled = true;
    };
  }, [farmId, queryClient, userId]);

  return useQuery({
    queryKey: qk.batches.dashboard(),
    queryFn: async () => {
      try {
        const items = await batchApi.dashboard();
        if (user?.farmId) {
          try { await saveDashboardSnapshot(user.userId, user.farmId, items); } catch { /* Keep online reads available if local storage is full. */ }
        }
        return items;
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        try {
          const cached = await getDashboardSnapshot(user.userId, user.farmId);
          if (cached) {
            return Promise.all(cached.map(async (item) => ({
              ...item,
              batch: await withQueuedPopulation(item.batch, user),
            })));
          }
        } catch { /* Preserve the API error if local storage is unavailable. */ }
        throw error;
      }
    },
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}
