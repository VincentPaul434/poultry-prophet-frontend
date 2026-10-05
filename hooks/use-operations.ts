"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financeApi, incubationApi, inputApi, inventoryApi, operationsAnalyticsApi, taskApi } from "@/lib/api";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { getFarmProductSnapshots, saveFarmProductSnapshots } from "@/lib/offline-db";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/query-keys";
import type { CompleteIncubationRequest, CreateFarmInputRequest, CreateFarmProductRequest, CreateFinancialTransactionRequest, CreateIncubationCycleRequest, CreateTaskRequest, InventoryAdjustmentRequest, StockInRequest, UpdateTaskStatusRequest } from "@/lib/types";

export function useIncubationCycles(enabled = true) { return useQuery({ queryKey: qk.incubation, queryFn: incubationApi.list, enabled }); }
export function useCreateIncubationCycle() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateIncubationCycleRequest) => incubationApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCompleteIncubation() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: CompleteIncubationRequest }) => incubationApi.complete(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCreateIncubationBatch() { const qc = useQueryClient(); return useMutation({ mutationFn: (id: number) => incubationApi.createBatch(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.batches.all }) }); }
export function useFarmInputs(batchId?: number, cycleId?: number, enabled = true) { return useQuery({ queryKey: [...qk.inputs, batchId, cycleId], queryFn: () => inputApi.list(batchId, cycleId), enabled }); }
export function useCreateFarmInput() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async (body: CreateFarmInputRequest) => {
      if (!body.batchId) return inputApi.create(body);
      const operationId = body.operationId ?? crypto.randomUUID();
      await enqueue({
        entityType: "FARM_INPUT",
        batchId: body.batchId,
        occurredAt: body.recordedAt ?? new Date().toISOString(),
        payload: { ...body, operationId },
      });
      return { operationId };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.inputs }); qc.invalidateQueries({ queryKey: qk.batches.all }); },
  });
}
export function useFarmProducts(includeInactive = false, enabled = true) {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.inventoryProducts(includeInactive), queryFn: async () => {
    try {
      const products = await inventoryApi.products(includeInactive);
      if (user?.farmId) await saveFarmProductSnapshots(user.userId, user.farmId, products);
      return products;
    } catch (error) {
      if (user?.farmId) {
        const cached = await getFarmProductSnapshots(user.userId, user.farmId);
        if (cached.length > 0) return includeInactive ? cached : cached.filter((item) => item.active);
      }
      throw error;
    }
  }, enabled: enabled && Boolean(user?.farmId), staleTime: 30_000 });
}
export function useCreateFarmProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateFarmProductRequest) => inventoryApi.createProduct(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory }) }); }
export function useStockInProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, body }: { productId: number; body: StockInRequest }) => inventoryApi.stockIn(productId, body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.inventory }); qc.invalidateQueries({ queryKey: qk.finance }); } }); }
export function useAdjustInventory() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, body }: { productId: number; body: InventoryAdjustmentRequest }) => inventoryApi.adjust(productId, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory }) }); }
export function usePendingInventoryReview(enabled = true) { return useQuery({ queryKey: qk.inventoryPending, queryFn: inventoryApi.pendingReview, enabled, staleTime: 15_000 }); }
export function useRetryPendingInventory() { const qc = useQueryClient(); return useMutation({ mutationFn: (inputId: number) => inventoryApi.retryPending(inputId), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.inventory }); qc.invalidateQueries({ queryKey: qk.inventoryPending }); qc.invalidateQueries({ queryKey: qk.inputs }); } }); }
export function useTasks(mine = false) { return useQuery({ queryKey: [...qk.tasks, { mine }], queryFn: () => taskApi.list(mine) }); }
export function useCreateTask() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateTaskRequest) => taskApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }) }); }
export function useUpdateTaskStatus() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: UpdateTaskStatusRequest }) => taskApi.updateStatus(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }) }); }
export function useFinanceTransactions(enabled = true) { return useQuery({ queryKey: qk.finance, queryFn: financeApi.list, enabled }); }
export function useCreateFinanceTransaction() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateFinancialTransactionRequest) => financeApi.create(body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.finance }); qc.invalidateQueries({ queryKey: qk.operationsAnalytics() }); } }); }
export function useOperationsAnalytics(params: { scope?: "FARM" | "BATCH"; batchId?: number; start?: string; end?: string; origin?: "REAL" | "SYNTHETIC" | "ALL"; testRunId?: string } = {}, enabled = true) { return useQuery({ queryKey: qk.operationsAnalytics(params), queryFn: () => operationsAnalyticsApi.get(params), enabled, staleTime: 30_000 }); }
export function useBatchComparison(params: { batchIds: number[]; windowDays: number; origin?: "REAL" | "SYNTHETIC" | "ALL" }, enabled = true) { return useQuery({ queryKey: qk.batchComparison(params), queryFn: () => operationsAnalyticsApi.compare(params), enabled: enabled && params.batchIds.length >= 2, staleTime: 30_000 }); }
export function useFinanceAnalytics(batchId?: number, start?: string, end?: string, enabled = true) { return useQuery({ queryKey: qk.financeAnalytics(batchId, start, end), queryFn: () => financeApi.analytics(batchId, start, end), enabled, staleTime: 30_000 }); }
