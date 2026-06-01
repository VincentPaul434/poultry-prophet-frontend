// TypeScript mirror of the Poultry Prophet backend DTOs (com.poultryprophet.*).
// Keep these in sync with the Spring Boot records they correspond to.

// ---- Enums ----
export type Role = "MANAGER" | "HANDLER";
export type BatchStatus = "ACTIVE" | "CLOSED";
export type Severity = "INFO" | "WARNING" | "CRITICAL";
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";
export type QualityRating = "C" | "B" | "B_PLUS" | "A" | "A_PLUS" | "A_PLUS_PLUS";
export type HealthEventSeverity = "NONE" | "ROUTINE" | "MINOR" | "MODERATE" | "MAJOR";
export type SelectionOutcome = "ADVANCE" | "REJECT";

// ---- Auth ----
export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  fullName: string;
  role: Role;
  farmId: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ---- Farm profile ----
export interface Farm {
  id: number;
  name: string | null;
  location: string | null;
  description: string | null;
}

export interface UpdateFarmRequest {
  name: string;
  location?: string | null;
  description?: string | null;
}

// ---- Batches & lifecycle ----
export interface Batch {
  id: number;
  farmId: number;
  name: string;
  initialPopulation: number;
  currentPopulation: number;
  startDate: string; // ISO date
  bloodline: string | null;
  source: string | null;
  stageId: number;
  stageName: string;
  status: BatchStatus;
  handlerUserIds: number[];
  createdAt: string; // ISO instant
}

export interface CreateBatchRequest {
  name: string;
  initialPopulation: number;
  startDate: string; // ISO date
  stageId: number;
  bloodline?: string | null;
  source?: string | null;
  handlerUserIds?: number[];
}

export interface LifecycleStage {
  id: number;
  name: string;
  orderIndex: number;
}

// ---- Birds ----
export interface Bird {
  id: number;
  batchId: number;
  bandNumber: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateBirdRequest {
  bandNumber: string;
  notes?: string | null;
}

// ---- Daily records ----
export interface DailyRecord {
  id: number;
  batchId: number;
  handlerId: number;
  handlerName: string;
  recordDate: string; // ISO date
  temperatureC: number;
  mortalityCount: number;
  feedIntakeG: number;
  waterIntakeMl: number;
  behaviorNotes: string | null;
  syncStatus: SyncStatus;
  createdAt: string; // ISO instant — when first created
}

export interface CreateRecordRequest {
  recordDate?: string | null;
  temperatureC: number;
  mortalityCount: number;
  feedIntakeG: number;
  waterIntakeMl: number;
  behaviorNotes?: string | null;
}

// ---- Per-bird ranging records ----
export interface RangingRecord {
  id: number;
  birdId: number;
  recordDate: string;
  weightG: number;
  healthEvent: HealthEventSeverity | null;
  temperamentNotes: string | null;
  qualityRating: QualityRating;
}

export interface CreateRangingRecordRequest {
  recordDate?: string | null;
  weightG: number;
  healthEvent?: HealthEventSeverity | null;
  temperamentNotes?: string | null;
  qualityRating: QualityRating;
}

// ---- Analytics: indicators & thresholds ----
export interface Indicator {
  id: number;
  batchId: number;
  recordId: number;
  recordDate: string;
  bhi: number;
  bsi: number | null;
  wfr: number | null;
  readinessScore: number;
  computedAt: string;
}

export interface Threshold {
  id: number;
  farmId: number | null;
  indicator: string;
  minValue: number;
  maxValue: number;
}

export interface UpdateThresholdRequest {
  minValue: number;
  maxValue: number;
}

// ---- Alerts ----
export interface Alert {
  id: number;
  batchId: number;
  indicatorId: number | null;
  indicatorType: string;
  severity: Severity;
  message: string;
  acknowledged: boolean;
  acknowledgedByUserId: number | null;
  acknowledgedAt: string | null;
  acknowledgmentNote: string | null;
  createdAt: string;
}

// Pushed over STOMP /topic/farms/{farmId}/alerts
export interface AlertEvent {
  alertId: number;
  batchId: number;
  severity: Severity;
  indicatorType: string;
  summary: string;
  occurredAt: string;
}

// ---- Selection (month-5 ranked view + decisions) ----
export interface SelectionDecision {
  outcome: SelectionOutcome;
  overridden: boolean;
  reason: string | null;
  decidedAt: string;
}

export interface SelectionRow {
  rank: number;
  birdId: number;
  bandNumber: string;
  broodingHealthIndex: number;
  growthScore: number;
  healthHistoryScore: number;
  behaviouralScore: number;
  crs: number;
  recommendedAdvance: boolean;
  decision: SelectionDecision | null;
}

export interface SelectionView {
  batchId: number;
  cutLineCrs: number;
  rows: SelectionRow[];
}

export interface SelectionDecisionRequest {
  advance: boolean;
  reason?: string | null;
}

// ---- Dashboard overview ----
export interface BatchOverview {
  batch: Batch;
  latestIndicator: Indicator | null;
  recentRecords: DailyRecord[];
  activeAlerts: Alert[];
}

// ---- Reports ----
export interface ReportPayload {
  batchId: number;
  batchName: string;
  periodStart: string;
  periodEnd: string;
  avgBhi: number | null;
  avgWfr: number | null;
  totalMortality: number;
  readinessScore: number | null;
  trend: Indicator[];
  significantAlerts: Alert[];
}

export interface ReportResponse {
  reportId: number;
  payload: ReportPayload;
}

// ---- Batch events (field log) ----
export type EventType =
  | "MORTALITY"
  | "HEALTH_CONCERN"
  | "VACCINE_MEDICINE"
  | "BEHAVIOR_OBSERVATION";

export interface BatchEvent {
  id: number;
  batchId: number;
  handlerId: number;
  handlerName: string;
  eventDate: string; // ISO date
  eventType: EventType;
  severityLabel: string | null;
  affectedCount: number;
  title: string;
  details: string | null;
  tags: string | null; // comma-separated
  createdAt: string; // ISO instant — when the log was submitted
}

export interface CreateBatchEventRequest {
  eventDate?: string | null;
  eventType: EventType;
  title: string;
  severityLabel?: string | null;
  affectedCount?: number;
  details?: string | null;
  tags?: string | null;
}

// ---- Handlers & invites ----
export interface Handler {
  id: number;
  email: string;
  fullName: string;
}

export interface CreateInviteRequest {
  email: string;
  expiresInDays: number;
}

export interface InviteResponse {
  token: string;
  email: string;
  farmId: number;
  expiresAt: string;
}
