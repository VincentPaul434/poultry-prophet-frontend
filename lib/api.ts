// Typed service layer over the Poultry Prophet backend.
// One function per backend endpoint, grouped by resource. All requests go
// through the shared axios instance (lib/api-client) which injects the JWT.

import apiClient from './api-client';
import type {
  Alert,
  AuthResponse,
  Batch,
  BatchOverview,
  Bird,
  CreateBatchRequest,
  CreateBirdRequest,
  CreateRangingRecordRequest,
  CreateRecordRequest,
  DailyRecord,
  Handler,
  Indicator,
  LifecycleStage,
  RangingRecord,
  RegisterRequest,
  SelectionDecisionRequest,
  SelectionRow,
  SelectionView,
  Threshold,
  UpdateThresholdRequest,
} from './types';

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  register: (request: RegisterRequest) =>
    apiClient.post<AuthResponse>('/auth/register', request).then((r) => r.data),
};

// ---- Batches & lifecycle ----
export const batchApi = {
  list: () => apiClient.get<Batch[]>('/batches').then((r) => r.data),
  get: (batchId: number | string) =>
    apiClient.get<Batch>(`/batches/${batchId}`).then((r) => r.data),
  create: (request: CreateBatchRequest) =>
    apiClient.post<Batch>('/batches', request).then((r) => r.data),
  changeStage: (batchId: number | string, stageId: number) =>
    apiClient.patch<Batch>(`/batches/${batchId}/stage`, { stageId }).then((r) => r.data),
  overview: (batchId: number | string) =>
    apiClient.get<BatchOverview>(`/batches/${batchId}/overview`).then((r) => r.data),
};

export const lifecycleApi = {
  list: () => apiClient.get<LifecycleStage[]>('/lifecycle-stages').then((r) => r.data),
};

// ---- Birds ----
export const birdApi = {
  list: (batchId: number | string) =>
    apiClient.get<Bird[]>(`/batches/${batchId}/birds`).then((r) => r.data),
  band: (batchId: number | string, request: CreateBirdRequest) =>
    apiClient.post<Bird>(`/batches/${batchId}/birds`, request).then((r) => r.data),
};

// ---- Daily records (brooding/general) ----
export const recordApi = {
  recent: (batchId: number | string, limit = 14) =>
    apiClient
      .get<DailyRecord[]>(`/batches/${batchId}/records`, { params: { limit } })
      .then((r) => r.data),
  create: (batchId: number | string, request: CreateRecordRequest) =>
    apiClient.post<DailyRecord>(`/batches/${batchId}/records`, request).then((r) => r.data),
};

// ---- Per-bird ranging records ----
export const rangingApi = {
  list: (batchId: number | string, birdId: number | string) =>
    apiClient
      .get<RangingRecord[]>(`/batches/${batchId}/birds/${birdId}/ranging`)
      .then((r) => r.data),
  create: (
    batchId: number | string,
    birdId: number | string,
    request: CreateRangingRecordRequest
  ) =>
    apiClient
      .post<RangingRecord>(`/batches/${batchId}/birds/${birdId}/ranging`, request)
      .then((r) => r.data),
};

// ---- Analytics: indicators & thresholds ----
export const indicatorApi = {
  latest: (batchId: number | string) =>
    apiClient.get<Indicator>(`/batches/${batchId}/indicators/latest`).then((r) => r.data),
  recent: (batchId: number | string, limit = 14) =>
    apiClient
      .get<Indicator[]>(`/batches/${batchId}/indicators`, { params: { limit } })
      .then((r) => r.data),
};

export const thresholdApi = {
  list: () => apiClient.get<Threshold[]>('/thresholds').then((r) => r.data),
  update: (id: number, request: UpdateThresholdRequest) =>
    apiClient.put<Threshold>(`/thresholds/${id}`, request).then((r) => r.data),
};

// ---- Alerts ----
export const alertApi = {
  list: (batchId: number | string, activeOnly = false, limit = 50) =>
    apiClient
      .get<Alert[]>(`/batches/${batchId}/alerts`, { params: { activeOnly, limit } })
      .then((r) => r.data),
  acknowledge: (id: number, note?: string) =>
    apiClient.post<Alert>(`/alerts/${id}/acknowledge`, { note }).then((r) => r.data),
};

// ---- Selection (month-5 ranked view + manager decisions) ----
export const selectionApi = {
  view: (batchId: number | string) =>
    apiClient.get<SelectionView>(`/batches/${batchId}/selection`).then((r) => r.data),
  decide: (batchId: number | string, birdId: number | string, request: SelectionDecisionRequest) =>
    apiClient
      .post<SelectionRow>(`/batches/${batchId}/selection/birds/${birdId}`, request)
      .then((r) => r.data),
};

// ---- Handlers (for manager batch assignment UIs) ----
export const handlerApi = {
  list: () => apiClient.get<Handler[]>('/handlers').then((r) => r.data),
};

// ---- Reports ----
export const reportApi = {
  build: (batchId: number | string, start: string, end: string) =>
    apiClient
      .get(`/batches/${batchId}/reports`, { params: { start, end } })
      .then((r) => r.data),
  export: (reportId: number, format: 'pdf' | 'csv' = 'pdf') =>
    apiClient
      .post(`/reports/${reportId}/export`, null, {
        params: { format },
        responseType: 'blob',
      })
      .then((r) => r.data as Blob),
};
