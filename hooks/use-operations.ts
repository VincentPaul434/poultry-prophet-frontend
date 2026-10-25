"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi, financeApi, incubationApi, inputApi, inventoryApi, operationsAnalyticsApi, taskApi, vaccinationApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { shouldUseOfflineSnapshot } from "@/lib/api-client";
import { getFarmProductSnapshots, getOfflineBootstrap, getQueuedInventoryDelta, listOutbox, saveFarmProductSnapshots } from "@/lib/offline-db";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/query-keys";
import type { AssignVaccinationProgramRequest, CompleteIncubationRequest, CreateBatchFromIncubationRequest, CreateFarmInputRequest, CreateFarmProductRequest, CreateFinancialTransactionRequest, CreateIncubationCycleRequest, CreateSexCompositionRequest, CreateTaskRequest, CreateVaccinationProgramRequest, FarmInputPageFilters, FinancePageFilters, HandlerTask, HandlerTaskQueueBucket, HandlerTaskQueueSummary, InventoryAdjustmentRequest, PageResponse, RecordVaccinationRequest, ReplaceVaccinationPlanRequest, SexComposition, StockInRequest, TaskPageFilters, TaskSummaryResponse, UpdateTaskStatusRequest } from "@/lib/types";

async function applyPendingTaskOperations(userId: number, farmId: number, tasks: HandlerTask[]) {
  const operations = await listOutbox(userId, farmId);
  const latestByTask = new Map<number, { status: HandlerTask["status"]; note?: string | null; occurredAt: string }>();
  for (const operation of operations) {
    if (operation.entityType !== "TASK_STATUS" || operation.status === "CONFLICT" || operation.status === "REJECTED") continue;
    const taskId = Number(operation.payload.taskId);
    const status = operation.payload.status;
    if (!Number.isFinite(taskId) || typeof status !== "string") continue;
    latestByTask.set(taskId, {
      status: status as HandlerTask["status"],
      note: typeof operation.payload.note === "string" ? operation.payload.note : null,
      occurredAt: operation.occurredAt,
    });
  }
  if (latestByTask.size === 0) return tasks;
  return tasks.map((task) => {
    const pending = latestByTask.get(task.id);
    if (!pending) return task;
    return {
      ...task,
      status: pending.status,
      completionNote: pending.note ?? task.completionNote,
      completedAt: pending.status === "COMPLETED" ? pending.occurredAt : null,
      pendingSync: true,
    };
  });
}

export function useIncubationCycles(enabled = true) { return useQuery({ queryKey: qk.incubation, queryFn: incubationApi.list, enabled }); }
export function useCreateIncubationCycle() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateIncubationCycleRequest) => incubationApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCompleteIncubation() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: CompleteIncubationRequest }) => incubationApi.complete(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCreateIncubationBatch() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: CreateBatchFromIncubationRequest }) => incubationApi.createBatch(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.batches.all }) }); }
export function useFarmInputs(batchId?: number, cycleId?: number, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.farmInputs(batchId, cycleId),
    queryFn: async () => {
      try { return await inputApi.list(batchId, cycleId); }
      catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        const cached = await getOfflineBootstrap(user.userId, user.farmId);
        if (!cached) throw error;
        if (batchId != null) return cached.inputs[String(batchId)] ?? [];
        return Object.values(cached.inputs).flat();
      }
    },
    enabled,
  });
}
export function useFarmInputPage(filters: FarmInputPageFilters, enabled = true) { return useQuery({ queryKey: qk.farmInputPage(filters as unknown as Record<string, unknown>), queryFn: () => inputApi.page(filters), enabled, placeholderData: (previous) => previous }); }
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
  async function withQueuedStock(products: import("@/lib/types").FarmProduct[]) {
    if (!user?.farmId) return products;
    return Promise.all(products.map(async (product) => {
      const delta = await getQueuedInventoryDelta(user.userId, user.farmId!, product.id);
      const stockOnHand = Number(product.stockOnHand) + delta;
      return { ...product, stockOnHand };
    }));
  }
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
          if (cached.length > 0) return withQueuedStock(includeInactive ? cached : cached.filter((item) => item.active));
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
const DEFAULT_TASK_PAGE: TaskPageFilters = {
  page: 0,
  size: 20,
  view: "OPEN",
  dueBucket: "ALL",
};

function taskMatchesFilters(task: HandlerTask, filters: TaskPageFilters) {
  if (filters.view === "OPEN" && !["TODO", "IN_PROGRESS", "BLOCKED"].includes(task.status)) return false;
  if (filters.view === "COMPLETED" && task.status !== "COMPLETED") return false;
  if (filters.view === "CANCELLED" && task.status !== "CANCELLED") return false;
  if (filters.view === "ALL" && task.status === "CANCELLED") return false;
  if (filters.batchId != null && task.batchId !== filters.batchId) return false;
  if (filters.farmWide && task.batchId != null) return false;
  if (filters.assignedHandlerId != null && task.assignedHandlerId !== filters.assignedHandlerId) return false;
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.sourceType && task.sourceType !== filters.sourceType) return false;
  if (filters.assignmentScope && task.assignmentScope !== filters.assignmentScope) return false;
  if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
  if (task.visibleFrom && new Date(task.visibleFrom).getTime() > Date.now()) return false;
  if (filters.view === "OPEN" || filters.view === "ALL") {
    const now = Date.now();
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    if (filters.dueBucket === "LATE" && !(task.dueAt && new Date(task.dueAt).getTime() < now)) return false;
    if (filters.dueBucket === "TODAY" && !(task.dueAt && new Date(task.dueAt).getTime() >= now && new Date(task.dueAt).getTime() < tomorrow.getTime())) return false;
    if (filters.dueBucket === "UPCOMING" && !(task.dueAt && new Date(task.dueAt).getTime() >= tomorrow.getTime())) return false;
    if (filters.dueBucket === "NO_DUE" && task.dueAt != null) return false;
  }
  return true;
}

function isOpenTask(task: HandlerTask) {
  return ["TODO", "IN_PROGRESS", "BLOCKED"].includes(task.status);
}

function isVaccinationTask(task: HandlerTask) {
  return task.sourceType === "VACCINATION_PLAN";
}

function handlerQueueMatches(task: HandlerTask, bucket: HandlerTaskQueueBucket, now = new Date()) {
  if (bucket === "COMPLETED") return task.status === "COMPLETED";
  if (!isOpenTask(task)) return false;
  if (task.visibleFrom && new Date(task.visibleFrom).getTime() > now.getTime()) return false;
  if (bucket === "NOW") {
    if (isVaccinationTask(task)) return true;
    if (!task.dueAt) return true;
    const due = new Date(task.dueAt);
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    return due.getTime() < tomorrow.getTime();
  }
  if (isVaccinationTask(task) || !task.dueAt) return false;
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return new Date(task.dueAt).getTime() >= tomorrow.getTime();
}

function offlineTaskPage(tasks: HandlerTask[], filters: TaskPageFilters): PageResponse<HandlerTask> {
  const values = tasks.filter((task) => taskMatchesFilters(task, filters)).sort((a, b) => {
    if (filters.view === "COMPLETED") return (new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()) || b.id - a.id;
    if (filters.view === "CANCELLED") return (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) || b.id - a.id;
    if (a.dueAt == null && b.dueAt != null) return 1;
    if (a.dueAt != null && b.dueAt == null) return -1;
    return (new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()) || b.id - a.id;
  });
  const start = filters.page * filters.size;
  const items = values.slice(start, start + filters.size);
  return {
    items,
    page: filters.page,
    size: filters.size,
    totalItems: values.length,
    totalPages: Math.ceil(values.length / filters.size),
    hasPrevious: filters.page > 0,
    hasNext: start + filters.size < values.length,
  };
}

function offlineTaskSummary(tasks: HandlerTask[]): TaskSummaryResponse {
  const open = tasks.filter((task) => ["TODO", "IN_PROGRESS", "BLOCKED"].includes(task.status));
  const now = Date.now();
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  const late = open.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now).length;
  const today = open.filter((task) => task.dueAt && new Date(task.dueAt).getTime() >= now && new Date(task.dueAt).getTime() < tomorrow.getTime()).length;
  const upcoming = open.filter((task) => task.dueAt && new Date(task.dueAt).getTime() >= tomorrow.getTime()).length;
  const noDueDate = open.filter((task) => !task.dueAt).length;
  return { open: late + today + upcoming + noDueDate, late, today, upcoming, noDueDate, completed: tasks.filter((task) => task.status === "COMPLETED").length, cancelled: tasks.filter((task) => task.status === "CANCELLED").length };
}

function offlineHandlerQueuePage(tasks: HandlerTask[], bucket: HandlerTaskQueueBucket, page: number, size: number): PageResponse<HandlerTask> {
  const values = tasks.filter((task) => handlerQueueMatches(task, bucket)).sort((a, b) => {
    if (bucket === "COMPLETED") return (new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()) || b.id - a.id;
    if (a.dueAt == null && b.dueAt != null) return 1;
    if (a.dueAt != null && b.dueAt == null) return -1;
    return (new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()) || b.id - a.id;
  });
  const start = page * size;
  return { items: values.slice(start, start + size), page, size, totalItems: values.length,
    totalPages: Math.ceil(values.length / size), hasPrevious: page > 0, hasNext: start + size < values.length };
}

function offlineHandlerQueueSummary(tasks: HandlerTask[]): HandlerTaskQueueSummary {
  return {
    now: tasks.filter((task) => handlerQueueMatches(task, "NOW")).length,
    upcoming: tasks.filter((task) => handlerQueueMatches(task, "UPCOMING")).length,
    completed: tasks.filter((task) => task.status === "COMPLETED").length,
    vaccinationReminders: tasks.filter((task) => isVaccinationTask(task) && handlerQueueMatches(task, "NOW")).length,
  };
}

/**
 * The handler queue was added after the original task API. A 400/404 here is
 * therefore usually a mixed-release deployment, not a bad task record. Keep
 * the fallback narrow so permission and validation errors are still shown.
 */
function isTaskQueueContractMismatch(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

export function useTaskPage(filters: TaskPageFilters = DEFAULT_TASK_PAGE, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.taskPage(filters as unknown as Record<string, unknown>),
    enabled,
    queryFn: async () => {
      try {
        return await taskApi.list(filters);
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        const cached = await getOfflineBootstrap(user.userId, user.farmId);
        if (!cached) throw error;
        return offlineTaskPage(await applyPendingTaskOperations(user.userId, user.farmId, cached.tasks), filters);
      }
    },
    placeholderData: (previous) => previous,
  });
}

export function useTaskQueue(bucket: HandlerTaskQueueBucket, enabled = true) {
  const { user } = useAuth();
  const size = 10;
  return useInfiniteQuery({
    queryKey: qk.handlerTaskQueue(bucket, size),
    initialPageParam: 0,
    enabled,
    queryFn: async ({ pageParam }) => {
      try {
        return await taskApi.handlerQueue(bucket, pageParam, size);
      } catch (error) {
        if (isTaskQueueContractMismatch(error)) {
          const legacyTasks = await taskApi.mine();
          return offlineHandlerQueuePage(legacyTasks, bucket, pageParam, size);
        }
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        const cached = await getOfflineBootstrap(user.userId, user.farmId);
        if (!cached) throw error;
        return offlineHandlerQueuePage(await applyPendingTaskOperations(user.userId, user.farmId, cached.tasks), bucket, pageParam, size);
      }
    },
    getNextPageParam: (lastPage) => lastPage.hasNext ? lastPage.page + 1 : undefined,
  });
}

export function useHandlerTaskQueueSummary(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.handlerTaskQueueSummary,
    enabled,
    queryFn: async () => {
      try {
        return await taskApi.handlerQueueSummary();
      } catch (error) {
        if (isTaskQueueContractMismatch(error)) {
          return offlineHandlerQueueSummary(await taskApi.mine());
        }
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        const cached = await getOfflineBootstrap(user.userId, user.farmId);
        if (!cached) throw error;
        return offlineHandlerQueueSummary(await applyPendingTaskOperations(user.userId, user.farmId, cached.tasks));
      }
    },
  });
}

export function useTaskSummary(filters: Partial<Omit<TaskPageFilters, "page" | "size" | "view" | "dueBucket">> = {}, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.taskSummary(filters as Record<string, unknown>),
    enabled,
    queryFn: async () => {
      try {
        return await taskApi.summary(filters);
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        const cached = await getOfflineBootstrap(user.userId, user.farmId);
        if (!cached) throw error;
        return offlineTaskSummary(await applyPendingTaskOperations(user.userId, user.farmId, cached.tasks));
      }
    },
  });
}

/** Compatibility wrapper for compact consumers that only need the first page. */
export function useTasks(mine = false) {
  void mine;
  const page = useTaskPage({ ...DEFAULT_TASK_PAGE, size: 20 });
  return { ...page, data: page.data?.items };
}

export function useCreateTask() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateTaskRequest) => taskApi.create(body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.tasks }); } }); }
export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async ({ id, body, batchId }: { id: number; body: UpdateTaskStatusRequest; batchId?: number | null }) => {
      const operationId = body.operationId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const payload = { ...body, operationId, occurredAt: body.occurredAt ?? new Date().toISOString(), taskId: id };
      if (typeof navigator === "undefined" || navigator.onLine) {
        try { return await taskApi.updateStatus(id, payload); }
        catch (error) {
          if (!(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error;
        }
      }
      await enqueue({ entityType: "TASK_STATUS", batchId: batchId ?? 0, occurredAt: payload.occurredAt, payload });
      return { queued: true as const, operationId };
    },
    onSuccess: (data, variables) => {
      if ("queued" in data && data.queued) {
        qc.setQueriesData<PageResponse<HandlerTask>>({ queryKey: qk.tasks }, (current) => {
          if (!current || !Array.isArray(current.items)) return current;
          return {
            ...current,
            items: current.items.map((task) => task.id === variables.id
              ? { ...task, status: variables.body.status, completionNote: variables.body.note ?? task.completionNote,
                  completedAt: variables.body.status === "COMPLETED" ? new Date().toISOString() : null, pendingSync: true }
              : task),
          };
        });
      }
      qc.invalidateQueries({ queryKey: qk.tasks });
      qc.invalidateQueries({ queryKey: qk.handlerTaskQueueSummary });
      return qc.invalidateQueries({ queryKey: ["handler-tasks", "queue"] });
    },
  });
}
export function useSexComposition(batchId: number, enabled = true) { return useQuery({ queryKey: qk.batches.sexComposition(batchId), queryFn: () => batchApi.sexComposition(batchId), enabled }); }
export function useSexCompositionContext(batchId: number, observedOn?: string, enabled = true) {
  return useQuery({
    queryKey: qk.batches.sexCompositionContext(batchId, observedOn),
    queryFn: () => batchApi.sexCompositionContext(batchId, observedOn),
    enabled,
    staleTime: 5_000,
  });
}
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
export function useVaccinationPlan(batchId: number, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.batches.vaccinationPlan(batchId),
    queryFn: async () => {
      try { return await vaccinationApi.plan(batchId); }
      catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        const cached = await getOfflineBootstrap(user.userId, user.farmId);
        if (!cached) throw error;
        return cached.vaccinationPlans[String(batchId)] ?? [];
      }
    },
    enabled,
    staleTime: 15_000,
  });
}
export function useCreateVaccinationProgram() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async (input: CreateVaccinationProgramRequest | { body: CreateVaccinationProgramRequest; batchId: number; replace: boolean }) => {
      const body = "body" in input ? input.body : input;
      const scheduleContext = "body" in input ? input : null;
      if (!scheduleContext || (typeof navigator !== "undefined" && navigator.onLine)) {
        try { return await vaccinationApi.createProgram(body); }
        catch (error) {
          if (!scheduleContext || !(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error;
        }
      }
      const operationId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      await enqueue({
        entityType: "VACCINATION_SCHEDULE",
        batchId: scheduleContext.batchId,
        occurredAt: new Date().toISOString(),
        payload: { action: "CREATE_AND_ASSIGN", replace: scheduleContext.replace, program: body, operationId },
      });
      return { queued: true as const, operationId };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vaccinationPrograms }),
  });
}
export function useAssignVaccinationProgram() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async ({ batchId, body }: { batchId: number; body: AssignVaccinationProgramRequest }) => {
      const operationId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      if (typeof navigator === "undefined" || navigator.onLine) {
        try { return await vaccinationApi.assign(batchId, body); }
        catch (error) { if (!(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error; }
      }
      await enqueue({ entityType: "VACCINATION_SCHEDULE", batchId, occurredAt: new Date().toISOString(), payload: { action: "ASSIGN", programId: body.programId, operationId } });
      return { queued: true as const, operationId };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.batchId) });
      qc.invalidateQueries({ queryKey: qk.batches.detail(variables.batchId) });
      qc.invalidateQueries({ queryKey: qk.batches.dashboard() });
      qc.invalidateQueries({ queryKey: qk.tasks });
    },
  });
}
export function useReplaceVaccinationProgram() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async ({ batchId, body }: { batchId: number; body: ReplaceVaccinationPlanRequest }) => {
      const operationId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      if (typeof navigator === "undefined" || navigator.onLine) {
        try { return await vaccinationApi.replace(batchId, body); }
        catch (error) { if (!(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error; }
      }
      await enqueue({ entityType: "VACCINATION_SCHEDULE", batchId, occurredAt: new Date().toISOString(), payload: { action: "REPLACE", programId: body.programId, operationId } });
      return { queued: true as const, operationId };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.batchId) });
      qc.invalidateQueries({ queryKey: qk.batches.detail(variables.batchId) });
      qc.invalidateQueries({ queryKey: qk.batches.dashboard() });
      qc.invalidateQueries({ queryKey: qk.tasks });
    },
  });
}
export function useRecordVaccination() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async ({ plan, body }: { plan: import("@/lib/types").VaccinationPlanItem; body: RecordVaccinationRequest }) => {
      const operationId = body.operationId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const payload = { ...body, operationId };
      if (typeof navigator === "undefined" || navigator.onLine) {
        try { return await vaccinationApi.record(plan.id, payload); }
        catch (error) {
          if (!(error instanceof ApiError) || ![0, 502, 503, 504].includes(error.status)) throw error;
        }
      }
      await enqueue({ entityType: "VACCINATION_PLAN", batchId: plan.batchId, occurredAt: body.recordedAt ?? new Date().toISOString(), payload: { ...payload, planId: plan.id } });
      return { queued: true as const, operationId };
    },
    onSuccess: (data, variables) => {
      if ("queued" in data && data.queued) {
        const completedAt = variables.body.recordedAt ?? new Date().toISOString();
        qc.setQueryData<import("@/lib/types").VaccinationPlanItem[]>(
          qk.batches.vaccinationPlan(variables.plan.batchId),
          (current) => current?.map((item) => item.id === variables.plan.id
            ? { ...item, status: "COMPLETED", displayState: "COMPLETED", completedAt, completionOperationId: data.operationId }
            : item) ?? current,
        );
      }
      qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.plan.batchId) });
      qc.invalidateQueries({ queryKey: qk.batches.detail(variables.plan.batchId) });
      qc.invalidateQueries({ queryKey: qk.batches.dashboard() });
      qc.invalidateQueries({ queryKey: qk.tasks });
      qc.invalidateQueries({ queryKey: qk.inputs });
      qc.invalidateQueries({ queryKey: qk.inventory });
      qc.invalidateQueries({ queryKey: qk.inventoryPending });
      qc.invalidateQueries({ queryKey: qk.finance });
      qc.invalidateQueries({ queryKey: qk.operationsAnalytics() });
      qc.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(variables.plan.batchId) });
      qc.invalidateQueries({ queryKey: qk.batches.selectionReviews(variables.plan.batchId) });
    },
  });
}
export function useSkipVaccination() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, reason }: { id: number; batchId: number; reason: string }) => vaccinationApi.skip(id, reason), onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: qk.batches.vaccinationPlan(variables.batchId) }); qc.invalidateQueries({ queryKey: qk.tasks }); } }); }
export function useFinanceTransactionPage(filters: FinancePageFilters, enabled = true) { return useQuery({ queryKey: qk.financePage(filters as unknown as Record<string, unknown>), queryFn: () => financeApi.page(filters), enabled, placeholderData: (previous) => previous }); }
export function useFinanceTransactions(enabled = true) { return useFinanceTransactionPage({ page: 0, size: 20 }, enabled); }
export function useCreateFinanceTransaction() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateFinancialTransactionRequest) => financeApi.create(body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.finance }); qc.invalidateQueries({ queryKey: qk.operationsAnalytics() }); } }); }
export function useOperationsAnalytics(params: { scope?: "FARM" | "BATCH"; batchId?: number; start?: string; end?: string; origin?: "REAL" | "SYNTHETIC" | "ALL"; testRunId?: string } = {}, enabled = true) { return useQuery({ queryKey: qk.operationsAnalytics(params), queryFn: () => operationsAnalyticsApi.get(params), enabled, staleTime: 30_000 }); }
export function useBatchComparison(params: { batchIds: number[]; windowDays: number; origin?: "REAL" | "SYNTHETIC" | "ALL" }, enabled = true) { return useQuery({ queryKey: qk.batchComparison(params), queryFn: () => operationsAnalyticsApi.compare(params), enabled: enabled && params.batchIds.length >= 2, staleTime: 30_000 }); }
export function useFinanceAnalytics(batchId?: number, start?: string, end?: string, enabled = true, type?: import("@/lib/types").FinanceTransactionType, farmWide = false, category?: string, sourceType?: string, status?: "POSTED" | "VOIDED") { return useQuery({ queryKey: qk.financeAnalytics(batchId, start, end, type, farmWide, category, sourceType, status), queryFn: () => financeApi.analytics(batchId, start, end, type, farmWide, category, sourceType, status), enabled, staleTime: 30_000 }); }
