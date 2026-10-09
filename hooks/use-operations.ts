"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi, financeApi, incubationApi, inputApi, inventoryApi, operationsAnalyticsApi, taskApi, vaccinationApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { shouldUseOfflineSnapshot } from "@/lib/api-client";
import { getFarmProductSnapshots, saveFarmProductSnapshots } from "@/lib/offline-db";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/query-keys";
import type { AssignVaccinationProgramRequest, CompleteIncubationRequest, CreateFarmInputRequest, CreateFarmProductRequest, CreateFinancialTransactionRequest, CreateIncubationCycleRequest, CreateSexCompositionRequest, CreateTaskRequest, CreateVaccinationProgramRequest, InventoryAdjustmentRequest, RecordVaccinationRequest, ReplaceVaccinationPlanRequest, SexComposition, StockInRequest, UpdateTaskStatusRequest } from "@/lib/types";

export function useIncubationCycles(enabled = true) { return useQuery({ queryKey: qk.incubation, queryFn: incubationApi.list, enabled }); }
export function useCreateIncubationCycle() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateIncubationCycleRequest) => incubationApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCompleteIncubation() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: CompleteIncubationRequest }) => incubationApi.complete(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCreateIncubationBatch() { const qc = useQueryClient(); return useMutation({ mutationFn: (id: number) => incubationApi.createBatch(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.batches.all }) }); }
export function useFarmInputs(batchId?: number, cycleId?: number, enabled = true) { return useQuery({ queryKey: qk.farmInputs(batchId, cycleId), queryFn: () => inputApi.list(batchId, cycleId), enabled }); }
export function useCreateFarmInput() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async (body: CreateFarmInputRequest) => {
      if (!body.batchId) return inputApi.create(body);
      const operationId = body.operationId ?? crypto.randomUUID();
      const payload = { ...body, operationId };

      // Online product/medicine records should be written immediately so the
      // handler gets a server acknowledgement and the new record can appear
      // in the batch log before the modal closes. The outbox remains the
      // fallback for a genuine offline or temporarily unavailable connection.
      if (typeof navigator === "undefined" || navigator.onLine) {
        try {
          return await inputApi.create(payload);
        } catch (error) {
          if (!(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error;
        }
      }

      await enqueue({
        entityType: "FARM_INPUT",
        batchId: body.batchId,
        occurredAt: body.recordedAt ?? new Date().toISOString(),
        payload,
      });
      return { queued: true, operationId };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.inputs });
      qc.invalidateQueries({ queryKey: qk.inventory });
      qc.invalidateQueries({ queryKey: qk.inventoryPending });
      qc.invalidateQueries({ queryKey: qk.finance });
      qc.invalidateQueries({ queryKey: qk.operationsAnalytics() });
      qc.invalidateQueries({ queryKey: qk.batches.all });
      if (variables.batchId) {
        qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.batchId) });
        qc.invalidateQueries({ queryKey: qk.batches.detail(variables.batchId) });
        qc.invalidateQueries({ queryKey: qk.batches.dashboard() });
        qc.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(variables.batchId) });
        qc.invalidateQueries({ queryKey: qk.batches.selectionReviews(variables.batchId) });
        qc.invalidateQueries({ queryKey: qk.tasks });
      }
    },
  });
}
export function useFarmProducts(includeInactive = false, enabled = true) {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.inventoryProducts(includeInactive), queryFn: async () => {
    try {
      const products = await inventoryApi.products(includeInactive);
      if (user?.farmId) {
        try { await saveFarmProductSnapshots(user.userId, user.farmId, products); } catch { /* Keep online reads available if local storage is full. */ }
      }
      return products;
    } catch (error) {
      if (!shouldUseOfflineSnapshot(error)) throw error;
      if (user?.farmId) {
        try {
          const cached = await getFarmProductSnapshots(user.userId, user.farmId);
          if (cached.length > 0) return includeInactive ? cached : cached.filter((item) => item.active);
        } catch { /* Preserve the API error if local storage is unavailable. */ }
      }
      throw error;
    }
  }, enabled: enabled && Boolean(user?.farmId), staleTime: 30_000 });
}
export function useInventoryMovements(params: { productId?: number; batchId?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: qk.inventoryMovements(params),
    queryFn: () => inventoryApi.movements(params),
    enabled,
    staleTime: 15_000,
  });
}
export function useCreateFarmProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateFarmProductRequest) => inventoryApi.createProduct(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory }) }); }
export function useStockInProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, body }: { productId: number; body: StockInRequest }) => inventoryApi.stockIn(productId, body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.inventory }); qc.invalidateQueries({ queryKey: qk.finance }); } }); }
export function useAdjustInventory() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, body }: { productId: number; body: InventoryAdjustmentRequest }) => inventoryApi.adjust(productId, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory }) }); }
export function usePendingInventoryReview(enabled = true) { return useQuery({ queryKey: qk.inventoryPending, queryFn: inventoryApi.pendingReview, enabled, staleTime: 15_000 }); }
export function useRetryPendingInventory() { const qc = useQueryClient(); return useMutation({ mutationFn: (inputId: number) => inventoryApi.retryPending(inputId), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.inventory }); qc.invalidateQueries({ queryKey: qk.inventoryPending }); qc.invalidateQueries({ queryKey: qk.inputs }); } }); }
export function useTasks(mine = false) { return useQuery({ queryKey: qk.taskList(mine), queryFn: () => taskApi.list(mine) }); }
export function useCreateTask() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateTaskRequest) => taskApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }) }); }
export function useUpdateTaskStatus() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: UpdateTaskStatusRequest }) => taskApi.updateStatus(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }) }); }
export function useSexComposition(batchId: number, enabled = true) { return useQuery({ queryKey: qk.batches.sexComposition(batchId), queryFn: () => batchApi.sexComposition(batchId), enabled }); }
export function useRecordSexComposition() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async ({ batchId, body }: { batchId: number; body: CreateSexCompositionRequest }) => {
      const operationId = body.operationId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const payload = { ...body, operationId };

      // Online records are authoritative immediately. Queue only when the browser
      // or API is genuinely unavailable, matching the product and vaccination flows.
      if (typeof navigator === "undefined" || navigator.onLine) {
        try {
          return await batchApi.recordSexComposition(batchId, payload);
        } catch (error) {
          if (!(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error;
        }
      }

      const optimistic: SexComposition = {
        id: -Date.now(),
        farmId: 0,
        batchId,
        observedOn: body.observedOn,
        populationAsOfObservation: body.maleCount + body.femaleCount + body.unclassifiedCount,
        maleCount: body.maleCount,
        femaleCount: body.femaleCount,
        unclassifiedCount: body.unclassifiedCount,
        recordedBy: 0,
        revisionReason: body.revisionReason ?? null,
        notes: body.notes ?? null,
        operationId,
        supersedesRecordId: null,
        status: "CURRENT",
        createdAt: new Date().toISOString(),
        pendingSync: true,
      };
      await enqueue({
        entityType: "SEX_COMPOSITION",
        batchId,
        occurredAt: body.observedOn,
        payload,
      });
      return { queued: true as const, operationId, composition: optimistic };
    },
    onSuccess: (data, variables) => {
      const queued = "queued" in data && data.queued === true;
      const composition = queued ? data.composition : data;
      qc.setQueryData(qk.batches.sexComposition(variables.batchId), composition);
      qc.invalidateQueries({ queryKey: qk.batches.detail(variables.batchId) });
      if (!queued) {
        qc.invalidateQueries({ queryKey: qk.batches.sexComposition(variables.batchId) });
        qc.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(variables.batchId) });
      }
    },
  });
}
export function useVaccinationPrograms(enabled = true) { return useQuery({ queryKey: qk.vaccinationPrograms, queryFn: vaccinationApi.programs, enabled, staleTime: 60_000 }); }
export function useVaccinationPlan(batchId: number, enabled = true) { return useQuery({ queryKey: qk.batches.vaccinationPlan(batchId), queryFn: () => vaccinationApi.plan(batchId), enabled, staleTime: 15_000 }); }
export function useCreateVaccinationProgram() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateVaccinationProgramRequest) => vaccinationApi.createProgram(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.vaccinationPrograms }) }); }
export function useAssignVaccinationProgram() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ batchId, body }: { batchId: number; body: AssignVaccinationProgramRequest }) => vaccinationApi.assign(batchId, body), onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.batchId) }); qc.invalidateQueries({ queryKey: qk.batches.detail(variables.batchId) }); qc.invalidateQueries({ queryKey: qk.batches.dashboard() }); qc.invalidateQueries({ queryKey: qk.tasks }); } }); }
export function useReplaceVaccinationProgram() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ batchId, body }: { batchId: number; body: ReplaceVaccinationPlanRequest }) => vaccinationApi.replace(batchId, body), onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.batchId) }); qc.invalidateQueries({ queryKey: qk.batches.detail(variables.batchId) }); qc.invalidateQueries({ queryKey: qk.batches.dashboard() }); qc.invalidateQueries({ queryKey: qk.tasks }); } }); }
export function useRecordVaccination() { const qc = useQueryClient(); const { enqueue } = useOfflineSync(); return useMutation({ mutationFn: async ({ plan, body }: { plan: import("@/lib/types").VaccinationPlanItem; body: RecordVaccinationRequest }) => { const operationId = body.operationId ?? crypto.randomUUID(); const payload = { ...body, operationId }; if (typeof navigator === "undefined" || navigator.onLine) { try { return await vaccinationApi.record(plan.id, payload); } catch (error) { if (!(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error; } } await enqueue({ entityType: "VACCINATION_PLAN", batchId: plan.batchId, occurredAt: body.recordedAt ?? new Date().toISOString(), payload: { ...payload, planId: plan.id } }); return { queued: true, operationId }; }, onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.plan.batchId) }); qc.invalidateQueries({ queryKey: qk.batches.detail(variables.plan.batchId) }); qc.invalidateQueries({ queryKey: qk.batches.dashboard() }); qc.invalidateQueries({ queryKey: qk.tasks }); qc.invalidateQueries({ queryKey: qk.inputs }); qc.invalidateQueries({ queryKey: qk.inventory }); qc.invalidateQueries({ queryKey: qk.inventoryPending }); qc.invalidateQueries({ queryKey: qk.finance }); qc.invalidateQueries({ queryKey: qk.operationsAnalytics() }); qc.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(variables.plan.batchId) }); qc.invalidateQueries({ queryKey: qk.batches.selectionReviews(variables.plan.batchId) }); } }); }
export function useSkipVaccination() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, reason }: { id: number; batchId: number; reason: string }) => vaccinationApi.skip(id, reason), onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.batchId) }); qc.invalidateQueries({ queryKey: qk.tasks }); } }); }
export function useFinanceTransactions(enabled = true) { return useQuery({ queryKey: qk.finance, queryFn: financeApi.list, enabled }); }
export function useCreateFinanceTransaction() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateFinancialTransactionRequest) => financeApi.create(body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.finance }); qc.invalidateQueries({ queryKey: qk.operationsAnalytics() }); } }); }
export function useOperationsAnalytics(params: { scope?: "FARM" | "BATCH"; batchId?: number; start?: string; end?: string; origin?: "REAL" | "SYNTHETIC" | "ALL"; testRunId?: string } = {}, enabled = true) { return useQuery({ queryKey: qk.operationsAnalytics(params), queryFn: () => operationsAnalyticsApi.get(params), enabled, staleTime: 30_000 }); }
export function useBatchComparison(params: { batchIds: number[]; windowDays: number; origin?: "REAL" | "SYNTHETIC" | "ALL" }, enabled = true) { return useQuery({ queryKey: qk.batchComparison(params), queryFn: () => operationsAnalyticsApi.compare(params), enabled: enabled && params.batchIds.length >= 2, staleTime: 30_000 }); }
export function useFinanceAnalytics(batchId?: number, start?: string, end?: string, enabled = true) { return useQuery({ queryKey: qk.financeAnalytics(batchId, start, end), queryFn: () => financeApi.analytics(batchId, start, end), enabled, staleTime: 30_000 }); }
