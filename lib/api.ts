// Typed service layer over the Poultry Prophet backend.
// One function per backend endpoint, grouped by resource. Every request goes
// through the shared axios instance (api-client) which injects the JWT and
// normalises errors. These are consumed by the React Query hooks in /hooks.

import { apiClient } from "./api-client";
import type { BatchComparison, FarmSummaryAnalytics } from "./farm-summary-types";
import type {
  Alert,
  AlertSummary,
  AuthResponse,
  Batch,
  BatchDashboardItem,
  BatchEvent,
  BatchOverview,
  BatchRetirementImpact,
  ArchiveBatchRequest,
  DeleteBatchRequest,
  Bird,
  CreateBatchEventRequest,
  CreateBatchRequest,
  CreateBatchFromIncubationRequest,
  CreateBirdRequest,
  CreateHandlerRequest,
  CreateInviteRequest,
  ChangePasswordRequest,
  CreateRangingRecordRequest,
  CreateRecordRequest,
  DailyRecord,
  Farm,
  Handler,
  Indicator,
  InviteResponse,
  LifecycleStage,
  LoginRequest,
  RangingRecord,
  RegisterRequest,
  ReportResponse,
  SelectionDecisionRequest,
  SelectionRow,
  SelectionView,
  SelectionReviewPayload,
  SelectionReviewResponse,
  CreateSelectionSessionRequest,
  SelectionSession,
  FinalizeSelectionReviewRequest,
  Threshold,
  UpdateFarmRequest,
  UpdateProfileRequest,
  UpdateThresholdRequest,
  VersionInfo,
  CompleteIncubationRequest,
  CreateFarmInputRequest,
  CreateFinancialTransactionRequest,
  CreateIncubationCycleRequest,
  CreateTaskRequest,
  FarmInputLog,
  FarmInputPageFilters,
  FinancialTransaction,
  BatchEventReport,
  FinanceTransactionType,
  FinanceAnalytics,
  FinancePageFilters,
  HandlerTask,
  HandlerTaskQueueBucket,
  HandlerTaskQueueSummary,
  PageResponse,
  TaskPageFilters,
  TaskSummaryResponse,
  IncubationCycle,
  UpdateTaskStatusRequest,
  GenerateTestBatchRequest,
  GenerateTestBatchResponse,
  TestLabStatus,
  SyncOperationsRequest,
  SyncOperationsResponse,
  SexComposition,
  CreateSexCompositionRequest,
  VaccinationProgram,
  CreateVaccinationProgramRequest,
  VaccinationPlanItem,
  AssignVaccinationProgramRequest,
  ReplaceVaccinationPlanRequest,
  RecordVaccinationRequest,
  FarmProduct,
  CreateFarmProductRequest,
  StockInRequest,
  InventoryAdjustmentRequest,
  InventoryMovement,
} from "./types";

type Id = number | string;

// ---- Auth ----
export const authApi = {
  login: (body: LoginRequest) =>
    apiClient.post<AuthResponse>("/auth/login", body).then((r) => r.data),
  register: (body: RegisterRequest) =>
    apiClient.post<AuthResponse>("/auth/register", body).then((r) => r.data),
};

export const syncApi = {
  operations: (body: SyncOperationsRequest) =>
    apiClient.post<SyncOperationsResponse>("/sync/v2/operations", body).then((r) => r.data),
};

export const offlineApi = {
  bootstrap: () => apiClient.get<import("./types").OfflineBootstrap>("/offline/bootstrap").then((r) => r.data),
};

export const versionApi = {
  get: () => apiClient.get<VersionInfo>("/version").then((r) => r.data),
};

export const testLabApi = {
  status: () => apiClient.get<TestLabStatus>("/test-lab/status").then((r) => r.data),
  generate: (body: GenerateTestBatchRequest) =>
    apiClient.post<GenerateTestBatchResponse>("/test-lab/generate", body).then((r) => r.data),
};

// ---- Account (the caller's own profile/password) ----
export const accountApi = {
  // Returns a fresh AuthResponse: email is the JWT subject, so it reissues the token.
  updateProfile: (body: UpdateProfileRequest) =>
    apiClient.put<AuthResponse>("/account/profile", body).then((r) => r.data),
  changePassword: (body: ChangePasswordRequest) =>
    apiClient.put<void>("/account/password", body).then((r) => r.data),
};

// ---- Batches & lifecycle ----
export const batchApi = {
  list: () => apiClient.get<Batch[]>("/batches").then((r) => r.data),
  listArchived: () => apiClient.get<Batch[]>("/batches", { params: { archived: true } }).then((r) => r.data),
  dashboard: () => apiClient.get<BatchDashboardItem[]>("/batches/dashboard").then((r) => r.data),
  get: (batchId: Id) =>
    apiClient.get<Batch>(`/batches/${batchId}`).then((r) => r.data),
  create: (body: CreateBatchRequest) =>
    apiClient.post<Batch>("/batches", body).then((r) => r.data),
  overview: (batchId: Id) =>
    apiClient.get<BatchOverview>(`/batches/${batchId}/overview`).then((r) => r.data),
  retirementImpact: (batchId: Id) =>
    apiClient.get<BatchRetirementImpact>(`/batches/${batchId}/retirement-impact`).then((r) => r.data),
  archive: (batchId: Id, body: ArchiveBatchRequest = {}) =>
    apiClient.patch<Batch>(`/batches/${batchId}/archive`, body).then((r) => r.data),
  reconcilePopulation: (batchId: Id) =>
    apiClient.patch<Batch>(`/batches/${batchId}/population/reconcile`).then((r) => r.data),
  restore: (batchId: Id) =>
    apiClient.patch<Batch>(`/batches/${batchId}/restore`).then((r) => r.data),
  delete: (batchId: Id, body: DeleteBatchRequest) =>
    apiClient.delete<void>(`/batches/${batchId}`, { data: body }).then((r) => r.data),
  confirmHatchDate: (batchId: Id, hatchDate: string) => apiClient.patch<Batch>(`/batches/${batchId}/hatch-date`, { hatchDate }).then((r) => r.data),
  sexComposition: (batchId: Id) => apiClient.get<SexComposition | null>(`/batches/${batchId}/sex-composition`).then((r) => r.data),
  sexCompositionContext: (batchId: Id, observedOn?: string) => apiClient.get<import("@/lib/types").SexCompositionContext>(`/batches/${batchId}/sex-composition/context`, { params: observedOn ? { observedOn } : undefined }).then((r) => r.data),
  sexHistory: (batchId: Id) => apiClient.get<SexComposition[]>(`/batches/${batchId}/sex-composition/history`).then((r) => r.data),
  recordSexComposition: (batchId: Id, body: CreateSexCompositionRequest) => apiClient.post<SexComposition>(`/batches/${batchId}/sex-composition`, body).then((r) => r.data),
};

export const lifecycleApi = {
  list: () => apiClient.get<LifecycleStage[]>("/lifecycle-stages").then((r) => r.data),
};

// ---- Birds ----
export const birdApi = {
  list: (batchId: Id) =>
    apiClient.get<Bird[]>(`/batches/${batchId}/birds`).then((r) => r.data),
  band: (batchId: Id, body: CreateBirdRequest) =>
    apiClient.post<Bird>(`/batches/${batchId}/birds`, body).then((r) => r.data),
};

// ---- Daily records ----
export const recordApi = {
  recent: (batchId: Id, limit = 14) =>
    apiClient
      .get<DailyRecord[]>(`/batches/${batchId}/records`, { params: { limit } })
      .then((r) => r.data),
  create: (batchId: Id, body: CreateRecordRequest) =>
    apiClient.post<DailyRecord>(`/batches/${batchId}/records`, body).then((r) => r.data),
};

// ---- Per-bird ranging records ----
export const rangingApi = {
  list: (batchId: Id, birdId: Id) =>
    apiClient
      .get<RangingRecord[]>(`/batches/${batchId}/birds/${birdId}/ranging`)
      .then((r) => r.data),
  create: (batchId: Id, birdId: Id, body: CreateRangingRecordRequest) =>
    apiClient
      .post<RangingRecord>(`/batches/${batchId}/birds/${birdId}/ranging`, body)
      .then((r) => r.data),
};

// ---- Analytics: indicators & thresholds ----
export const indicatorApi = {
  latest: (batchId: Id) =>
    apiClient.get<Indicator>(`/legacy/batches/${batchId}/indicators/latest`).then((r) => r.data),
  recent: (batchId: Id, limit = 14) =>
    apiClient
      .get<Indicator[]>(`/legacy/batches/${batchId}/indicators`, { params: { limit } })
      .then((r) => r.data),
};

export const thresholdApi = {
  list: () => apiClient.get<Threshold[]>("/legacy/thresholds").then((r) => r.data),
  update: (id: number, body: UpdateThresholdRequest) =>
    apiClient.put<Threshold>(`/legacy/thresholds/${id}`, body).then((r) => r.data),
};

// ---- Alerts ----
export const alertApi = {
  list: (batchId: Id, activeOnly = false, limit = 50) =>
    apiClient
      .get<Alert[]>(`/batches/${batchId}/alerts`, { params: { activeOnly, limit } })
      .then((r) => r.data),
  // Farm-wide feed across all batches for the notifications centre.
  listFarm: (activeOnly = true, limit = 100) =>
    apiClient
      .get<Alert[]>(`/alerts`, { params: { activeOnly, limit } })
      .then((r) => r.data),
  pageFarm: (params: { activeOnly: boolean; page: number; size: number; severity?: string; batchId?: number; sort?: string }) =>
    apiClient.get<PageResponse<Alert>>("/alerts/page", { params }).then((r) => r.data),
  summary: () => apiClient.get<AlertSummary>("/alerts/summary").then((r) => r.data),
  acknowledge: (id: number, note?: string) =>
    apiClient.post<Alert>(`/alerts/${id}/acknowledge`, { note }).then((r) => r.data),
};

// ---- Legacy selection (kept only for historical/demo compatibility) ----
export const selectionApi = {
  view: (batchId: Id) =>
    apiClient.get<SelectionView>(`/legacy/batches/${batchId}/selection`).then((r) => r.data),
  decide: (batchId: Id, birdId: Id, body: SelectionDecisionRequest) =>
    apiClient
      .post<SelectionRow>(`/legacy/batches/${batchId}/selection/birds/${birdId}`, body)
      .then((r) => r.data),
};

export const selectionReviewApi = {
  preview: (batchId: Id, params?: { periodStart?: string; periodEnd?: string; asOfDate?: string }) =>
    apiClient
      .get<SelectionReviewPayload>(`/batches/${batchId}/selection-review/preview`, { params })
      .then((r) => r.data),
  list: (batchId: Id) =>
    apiClient.get<SelectionReviewResponse[]>(`/batches/${batchId}/selection-reviews`).then((r) => r.data),
  create: (batchId: Id, body?: { periodStart?: string; periodEnd?: string; asOfDate?: string; purpose?: string; snapshotNote?: string; idempotencyKey?: string }) =>
    apiClient
      .post<SelectionReviewResponse>(`/batches/${batchId}/selection-reviews`, body ?? {})
      .then((r) => r.data),
  finalize: (batchId: Id, reviewId: number, body: FinalizeSelectionReviewRequest) =>
    apiClient
      .post<SelectionReviewResponse>(`/batches/${batchId}/selection-reviews/${reviewId}/finalize`, body)
      .then((r) => r.data),
  pdf: (batchId: Id, reviewId: number) =>
    apiClient
      .get<Blob>(`/batches/${batchId}/selection-reviews/${reviewId}/pdf`, { responseType: "blob" })
      .then((r) => r.data),
};

export const selectionSessionApi = {
  list: (batchId: Id) =>
    apiClient.get<SelectionSession[]>(`/batches/${batchId}/selection-sessions`).then((r) => r.data),
  get: (batchId: Id, sessionId: number) =>
    apiClient.get<SelectionSession>(`/batches/${batchId}/selection-sessions/${sessionId}`).then((r) => r.data),
  create: (batchId: Id, body: CreateSelectionSessionRequest) =>
    apiClient.post<SelectionSession>(`/batches/${batchId}/selection-sessions`, body).then((r) => r.data),
  update: (batchId: Id, sessionId: number, body: CreateSelectionSessionRequest) =>
    apiClient.patch<SelectionSession>(`/batches/${batchId}/selection-sessions/${sessionId}`, body).then((r) => r.data),
  finalize: (batchId: Id, sessionId: number) =>
    apiClient.post<SelectionSession>(`/batches/${batchId}/selection-sessions/${sessionId}/finalize`).then((r) => r.data),
  supersede: (batchId: Id, sessionId: number, body: CreateSelectionSessionRequest) =>
    apiClient.post<SelectionSession>(`/batches/${batchId}/selection-sessions/${sessionId}/supersede`, body).then((r) => r.data),
};

// ---- Reports ----
export const reportApi = {
  build: (batchId: Id, start: string, end: string) =>
    apiClient
      .get<ReportResponse>(`/legacy/batches/${batchId}/reports`, { params: { start, end } })
      .then((r) => r.data),
  // Returns a downloadable blob (PDF/CSV) from the export endpoint.
  export: (reportId: number, format: "pdf" | "csv" = "pdf") =>
    apiClient
      .post<Blob>(`/legacy/reports/${reportId}/export`, null, {
        params: { format },
        responseType: "blob",
      })
      .then((r) => r.data),
};

// ---- Batch events (field log) ----
export const batchEventApi = {
  recent: (batchId: Id, limit = 30) =>
    apiClient
      .get<BatchEvent[]>(`/batches/${batchId}/events`, { params: { limit } })
      .then((r) => r.data),
  page: (batchId: Id, params: Record<string, unknown>) =>
    apiClient.get<PageResponse<BatchEvent>>(`/batches/${batchId}/events/page`, { params }).then((r) => r.data),
  report: (batchId: Id, params: Record<string, unknown>) =>
    apiClient.get<BatchEventReport>(`/batches/${batchId}/events/report`, { params }).then((r) => r.data),
  create: (batchId: Id, body: CreateBatchEventRequest) =>
    apiClient
      .post<BatchEvent>(`/batches/${batchId}/events`, body)
      .then((r) => r.data),
};

// ---- Farm profile ----
export const farmApi = {
  current: () => apiClient.get<Farm>("/farm").then((r) => r.data),
  update: (body: UpdateFarmRequest) =>
    apiClient.put<Farm>("/farm", body).then((r) => r.data),
};

// ---- Handlers & invites ----
export const handlerApi = {
  list: () => apiClient.get<Handler[]>("/handlers").then((r) => r.data),
  create: (body: CreateHandlerRequest) =>
    apiClient.post<Handler>("/handlers", body).then((r) => r.data),
};

export const inviteApi = {
  create: (body: CreateInviteRequest) =>
    apiClient.post<InviteResponse>("/invites", body).then((r) => r.data),
  // Invites awaiting acceptance for the logged-in handler (HANDLER role only).
  pending: () =>
    apiClient.get<InviteResponse[]>("/invites/pending").then((r) => r.data),
  accept: (token: string) =>
    apiClient.post<AuthResponse>(`/invites/${token}/accept`).then((r) => r.data),
  decline: (token: string) =>
    apiClient.post<void>(`/invites/${token}/decline`).then((r) => r.data),
};

// ---- Incubation, inputs, tasks, finance, and descriptive analytics ----
export const incubationApi = {
  list: () => apiClient.get<IncubationCycle[]>("/incubation-cycles").then((r) => r.data),
  create: (body: CreateIncubationCycleRequest) => apiClient.post<IncubationCycle>("/incubation-cycles", body).then((r) => r.data),
  complete: (id: number, body: CompleteIncubationRequest) => apiClient.post<IncubationCycle>(`/incubation-cycles/${id}/complete`, body).then((r) => r.data),
  createBatch: (id: number, body: CreateBatchFromIncubationRequest) => apiClient.post<Batch>(`/incubation-cycles/${id}/create-batch`, body).then((r) => r.data),
};
export const inputApi = {
  list: (batchId?: number, incubationCycleId?: number) => apiClient.get<FarmInputLog[]>("/inputs", { params: { batchId, incubationCycleId } }).then((r) => r.data),
  page: (filters: FarmInputPageFilters) => apiClient.get<PageResponse<FarmInputLog>>("/inputs/page", { params: filters }).then((r) => r.data),
  create: (body: CreateFarmInputRequest) => apiClient.post<FarmInputLog>("/inputs", body).then((r) => r.data),
};
export const inventoryApi = {
  products: (includeInactive = false) => apiClient.get<FarmProduct[]>("/inventory/products", { params: { includeInactive } }).then((r) => r.data),
  createProduct: (body: CreateFarmProductRequest) => apiClient.post<FarmProduct>("/inventory/products", body).then((r) => r.data),
  stockIn: (productId: number, body: StockInRequest) => apiClient.post<InventoryMovement>(`/inventory/products/${productId}/stock-ins`, body).then((r) => r.data),
  adjust: (productId: number, body: InventoryAdjustmentRequest) => apiClient.post<InventoryMovement>(`/inventory/products/${productId}/adjustments`, body).then((r) => r.data),
  movements: (params: { productId?: number; batchId?: number } = {}) => apiClient.get<InventoryMovement[]>("/inventory/movements", { params }).then((r) => r.data),
  movementsPage: (params: { page: number; size: number; productId?: number; batchId?: number }) => apiClient.get<PageResponse<InventoryMovement>>("/inventory/movements/page", { params }).then((r) => r.data),
  pendingReview: () => apiClient.get<FarmInputLog[]>("/inventory/pending-review").then((r) => r.data),
  retryPending: (inputId: number) => apiClient.post<FarmInputLog>(`/inventory/pending-review/${inputId}/apply`).then((r) => r.data),
};
export const taskApi = {
  list: (filters: TaskPageFilters) => apiClient.get<PageResponse<HandlerTask>>("/tasks", { params: taskParams(filters) }).then((r) => r.data),
  // Compatibility read for one release while older deployments catch up with
  // the dedicated handler-queue endpoints. Both the old API (array) and the
  // new paged API shape are normalized for the queue hooks.
  mine: () => apiClient.get<HandlerTask[] | PageResponse<HandlerTask>>("/tasks", { params: { mine: true, page: 0, size: 100 } }).then((r) => Array.isArray(r.data) ? r.data : r.data.items),
  summary: (filters: Partial<Omit<TaskPageFilters, "page" | "size" | "view" | "dueBucket">> = {}) =>
    apiClient.get<TaskSummaryResponse>("/tasks/summary", { params: taskParams(filters) }).then((r) => r.data),
  handlerQueue: (bucket: HandlerTaskQueueBucket, page = 0, size = 10) =>
    apiClient.get<PageResponse<HandlerTask>>("/tasks/handler-queue", { params: { bucket, page, size } }).then((r) => r.data),
  handlerQueueSummary: () => apiClient.get<HandlerTaskQueueSummary>("/tasks/handler-queue/summary").then((r) => r.data),
  create: (body: CreateTaskRequest) => apiClient.post<HandlerTask>("/tasks", body).then((r) => r.data),
  updateStatus: (id: number, body: UpdateTaskStatusRequest) => apiClient.post<HandlerTask>(`/tasks/${id}/status`, body).then((r) => r.data),
};

function taskParams(filters: Partial<TaskPageFilters>) {
  const params: Record<string, unknown> = {};
  if (filters.page != null) params.page = filters.page;
  if (filters.size != null) params.size = filters.size;
  if (filters.view && filters.view !== "ALL") params.view = filters.view;
  if (filters.dueBucket && filters.dueBucket !== "ALL") params.dueBucket = filters.dueBucket;
  if (filters.batchId != null) params.batchId = filters.batchId;
  if (filters.farmWide != null) params.farmWide = filters.farmWide;
  if (filters.assignedHandlerId != null) params.assignedHandlerId = filters.assignedHandlerId;
  if (filters.priority) params.priority = filters.priority;
  if (filters.sourceType) params.sourceType = filters.sourceType;
  if (filters.assignmentScope) params.assignmentScope = filters.assignmentScope;
  if (filters.search?.trim()) params.search = filters.search.trim();
  return params;
}
export const vaccinationApi = {
  programs: () => apiClient.get<VaccinationProgram[]>("/vaccination-programs").then((r) => r.data),
  createProgram: (body: CreateVaccinationProgramRequest) => apiClient.post<VaccinationProgram>("/vaccination-programs", body).then((r) => r.data),
  plan: (batchId: number) => apiClient.get<VaccinationPlanItem[]>(`/batches/${batchId}/vaccination-plan`).then((r) => r.data),
  assign: (batchId: number, body: AssignVaccinationProgramRequest) => apiClient.post<VaccinationPlanItem[]>(`/batches/${batchId}/vaccination-plan`, body).then((r) => r.data),
  replace: (batchId: number, body: ReplaceVaccinationPlanRequest) => apiClient.put<VaccinationPlanItem[]>(`/batches/${batchId}/vaccination-plan`, body).then((r) => r.data),
  record: (id: number, body: RecordVaccinationRequest) => apiClient.post<VaccinationPlanItem>(`/vaccination-plan-items/${id}/record`, body).then((r) => r.data),
  skip: (id: number, reason: string) => apiClient.post<VaccinationPlanItem>(`/vaccination-plan-items/${id}/skip`, { reason }).then((r) => r.data),
};
export const financeApi = {
  list: () => apiClient.get<FinancialTransaction[]>("/financial-transactions").then((r) => r.data),
  page: (filters: FinancePageFilters) => apiClient.get<PageResponse<FinancialTransaction>>("/financial-transactions/page", { params: filters }).then((r) => r.data),
  create: (body: CreateFinancialTransactionRequest) => apiClient.post<FinancialTransaction>("/financial-transactions", body).then((r) => r.data),
  analytics: (batchId?: number, start?: string, end?: string, type?: FinanceTransactionType, farmWide?: boolean, category?: string, sourceType?: string, status?: "POSTED" | "VOIDED") => apiClient.get<FinanceAnalytics>("/financial-transactions/analytics", { params: { batchId, start, end, type, farmWide, category, sourceType, status } }).then((r) => r.data),
};
export const operationsAnalyticsApi = {
  get: (params: { scope?: "FARM" | "BATCH"; batchId?: number; start?: string; end?: string; origin?: "REAL" | "SYNTHETIC" | "ALL"; testRunId?: string } = {}) => apiClient.get<FarmSummaryAnalytics>("/analytics/operations/v2", { params }).then((r) => r.data),
  compare: (params: { batchIds: number[]; windowDays: number; origin?: "REAL" | "SYNTHETIC" | "ALL" }) => apiClient.get<BatchComparison>("/analytics/batches/compare", { params: { batchIds: params.batchIds.join(","), windowDays: params.windowDays, origin: params.origin ?? "REAL" } }).then((r) => r.data),
};
