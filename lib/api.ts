// Typed service layer over the Poultry Prophet backend.
// One function per backend endpoint, grouped by resource. Every request goes
// through the shared axios instance (api-client) which injects the JWT and
// normalises errors. These are consumed by the React Query hooks in /hooks.

import { apiClient } from "./api-client";
import type {
  Alert,
  AuthResponse,
  Batch,
  BatchEvent,
  BatchOverview,
  Bird,
  CreateBatchEventRequest,
  CreateBatchRequest,
  CreateBirdRequest,
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
  Threshold,
  UpdateFarmRequest,
  UpdateProfileRequest,
  UpdateThresholdRequest,
} from "./types";

type Id = number | string;

// ---- Auth ----
export const authApi = {
  login: (body: LoginRequest) =>
    apiClient.post<AuthResponse>("/auth/login", body).then((r) => r.data),
  register: (body: RegisterRequest) =>
    apiClient.post<AuthResponse>("/auth/register", body).then((r) => r.data),
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
  get: (batchId: Id) =>
    apiClient.get<Batch>(`/batches/${batchId}`).then((r) => r.data),
  create: (body: CreateBatchRequest) =>
    apiClient.post<Batch>("/batches", body).then((r) => r.data),
  changeStage: (batchId: Id, stageId: number) =>
    apiClient
      .patch<Batch>(`/batches/${batchId}/stage`, { stageId })
      .then((r) => r.data),
  overview: (batchId: Id) =>
    apiClient.get<BatchOverview>(`/batches/${batchId}/overview`).then((r) => r.data),
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
    apiClient.get<Indicator>(`/batches/${batchId}/indicators/latest`).then((r) => r.data),
  recent: (batchId: Id, limit = 14) =>
    apiClient
      .get<Indicator[]>(`/batches/${batchId}/indicators`, { params: { limit } })
      .then((r) => r.data),
};

export const thresholdApi = {
  list: () => apiClient.get<Threshold[]>("/thresholds").then((r) => r.data),
  update: (id: number, body: UpdateThresholdRequest) =>
    apiClient.put<Threshold>(`/thresholds/${id}`, body).then((r) => r.data),
};

// ---- Alerts ----
export const alertApi = {
  list: (batchId: Id, activeOnly = false, limit = 50) =>
    apiClient
      .get<Alert[]>(`/batches/${batchId}/alerts`, { params: { activeOnly, limit } })
      .then((r) => r.data),
  acknowledge: (id: number, note?: string) =>
    apiClient.post<Alert>(`/alerts/${id}/acknowledge`, { note }).then((r) => r.data),
};

// ---- Selection (month-5 ranked view + manager decisions) ----
export const selectionApi = {
  view: (batchId: Id) =>
    apiClient.get<SelectionView>(`/batches/${batchId}/selection`).then((r) => r.data),
  decide: (batchId: Id, birdId: Id, body: SelectionDecisionRequest) =>
    apiClient
      .post<SelectionRow>(`/batches/${batchId}/selection/birds/${birdId}`, body)
      .then((r) => r.data),
};

// ---- Reports ----
export const reportApi = {
  build: (batchId: Id, start: string, end: string) =>
    apiClient
      .get<ReportResponse>(`/batches/${batchId}/reports`, { params: { start, end } })
      .then((r) => r.data),
  // Returns a downloadable blob (PDF/CSV) from the export endpoint.
  export: (reportId: number, format: "pdf" | "csv" = "pdf") =>
    apiClient
      .post<Blob>(`/reports/${reportId}/export`, null, {
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
