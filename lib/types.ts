// Type definitions mirroring the Poultry Prophet Spring Boot backend DTOs.
// Keep these in sync with com.poultryprophet.*.dto.* on the backend.

// ---- Enums (match backend enum constants exactly) ----

/** Backend com.poultryprophet.user.Role */
export type Role = 'MANAGER' | 'HANDLER';

/** Lowercase role used throughout the UI / route guards. */
export type UserRole = 'manager' | 'handler';

/** Backend com.poultryprophet.batch.BatchStatus */
export type BatchStatus = 'ACTIVE' | 'CLOSED';

/** Backend com.poultryprophet.alert.Severity */
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

/** Backend com.poultryprophet.ranging.QualityRating */
export type QualityRating = 'C' | 'B' | 'B_PLUS' | 'A' | 'A_PLUS' | 'A_PLUS_PLUS';

/** Backend com.poultryprophet.ranging.HealthEventSeverity */
export type HealthEventSeverity = 'NONE' | 'ROUTINE' | 'MINOR' | 'MODERATE' | 'MAJOR';

/** Backend com.poultryprophet.record.SyncStatus */
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

// ---- Auth (AuthController / AuthResponse) ----

/** Flat shape returned by POST /api/auth/{login,register}. */
export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  fullName: string;
  role: Role;
  farmId: number;
}

/** Normalised user kept in the auth context / localStorage. */
export interface User {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  farmId: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}

// ---- Batches (BatchController / BatchResponse) ----

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
  startDate: string;
  stageId: number;
  bloodline?: string;
  source?: string;
  handlerUserIds?: number[];
}

export interface LifecycleStage {
  id: number;
  name: string;
  orderIndex: number;
}

// ---- Birds (BirdController / BirdResponse) ----

export interface Bird {
  id: number;
  batchId: number;
  bandNumber: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateBirdRequest {
  bandNumber: string;
  notes?: string;
}

// ---- Daily records (DailyRecordController / DailyRecordResponse) ----

export interface DailyRecord {
  id: number;
  batchId: number;
  handlerId: number;
  recordDate: string;
  temperatureC: number;
  mortalityCount: number;
  feedIntakeG: number;
  waterIntakeMl: number;
  behaviorNotes: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
}

export interface CreateRecordRequest {
  recordDate?: string;
  temperatureC: number;
  mortalityCount: number;
  feedIntakeG: number;
  waterIntakeMl: number;
  behaviorNotes?: string;
}

// ---- Ranging records (RangingRecordController / RangingRecordResponse) ----

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
  recordDate?: string;
  weightG: number;
  healthEvent?: HealthEventSeverity;
  temperamentNotes?: string;
  qualityRating: QualityRating;
}

// ---- Analytics indicators (IndicatorController / IndicatorResponse) ----

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

// ---- Alerts (AlertController / AlertResponse) ----

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

// ---- Dashboard overview (OverviewController / BatchOverviewResponse) ----

export interface BatchOverview {
  batch: Batch;
  latestIndicator: Indicator | null;
  recentRecords: DailyRecord[];
  activeAlerts: Alert[];
}

// ---- Selection (SelectionController / SelectionViewResponse) ----

export interface SelectionDecision {
  outcome: string;
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
  reason?: string;
}

// ---- Handlers (UserController / HandlerResponse) ----

export interface Handler {
  id: number;
  email: string;
  fullName: string;
}

// ---- Auth context ----

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}
