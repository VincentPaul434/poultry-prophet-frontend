// TypeScript mirror of the Poultry Prophet backend DTOs (com.poultryprophet.*).
// Keep these in sync with the Spring Boot records they correspond to.

// ---- Enums ----
export type Role = "MANAGER" | "HANDLER";
export type BatchStatus = "ACTIVE" | "CLOSED" | "ARCHIVED";
export type Severity = "INFO" | "WARNING" | "CRITICAL";
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";
export type ObservationQuality = "UNKNOWN" | "MEASURED" | "ESTIMATED" | "UNAVAILABLE";
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
  stageAuto: boolean;
  status: BatchStatus;
  handlerUserIds: number[];
  createdAt: string; // ISO instant
}

export interface CreateBatchRequest {
  name: string;
  initialPopulation: number;
  startDate: string; // ISO date
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
  feedIntakeG: number | null;
  waterIntakeMl: number | null;
  temperatureQuality: ObservationQuality;
  feedQuality: ObservationQuality;
  waterQuality: ObservationQuality;
  behaviorNotes: string | null;
  syncStatus: SyncStatus;
  createdAt: string; // ISO instant — when first created
}

export interface CreateRecordRequest {
  recordDate?: string | null;
  temperatureC: number;
  mortalityCount?: number | null;
  feedIntakeG?: number | null;
  waterIntakeMl?: number | null;
  behaviorNotes?: string | null;
  temperatureQuality?: ObservationQuality;
  feedQuality?: ObservationQuality;
  waterQuality?: ObservationQuality;
}

// ---- Stakeholder feedback workflows ----
export type IncubationStatus = "LOADED" | "INCUBATING" | "HATCHING" | "COMPLETED" | "CANCELLED";
export interface IncubationCycle {
  id: number;
  farmId: number;
  cycleName: string;
  incubatorCode: string;
  eggSource: string | null;
  bloodline: string | null;
  loadedDate: string;
  eggsLoaded: number;
  expectedHatchDate: string | null;
  actualHatchDate: string | null;
  hatchedCount: number | null;
  unhatchedCount: number | null;
  removedDamagedCount: number | null;
  status: IncubationStatus;
  notes: string | null;
  createdBatchId: number | null;
  createdAt: string;
  hatchRatePercent: number;
  durationDays: number;
}
export interface CreateIncubationCycleRequest {
  cycleName: string;
  incubatorCode: string;
  eggSource?: string | null;
  bloodline?: string | null;
  loadedDate: string;
  eggsLoaded: number;
  expectedHatchDate?: string | null;
  notes?: string | null;
}
export interface CompleteIncubationRequest {
  actualHatchDate: string;
  hatchedCount: number;
  unhatchedCount: number;
  removedDamagedCount: number;
  notes?: string | null;
}

export type InputProductType = "FEED" | "VITAMIN" | "MEDICINE" | "VACCINE" | "OTHER";
export interface FarmInputLog {
  id: number;
  farmId: number;
  batchId: number | null;
  incubationCycleId: number | null;
  recordedAt: string;
  productType: InputProductType;
  brandName: string;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  route: string | null;
  purpose: string | null;
  notes: string | null;
  recordedBy: number;
}
export interface CreateFarmInputRequest {
  batchId?: number | null;
  incubationCycleId?: number | null;
  recordedAt?: string | null;
  productType: InputProductType;
  brandName: string;
  productName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  route?: string | null;
  purpose?: string | null;
  notes?: string | null;
}

export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
export interface HandlerTask {
  id: number;
  farmId: number;
  batchId: number | null;
  incubationCycleId: number | null;
  title: string;
  instructions: string | null;
  assignedHandlerId: number | null;
  assignedManagerId: number;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateTaskRequest {
  title: string;
  instructions?: string | null;
  batchId?: number | null;
  incubationCycleId?: number | null;
  assignedHandlerId?: number | null;
  dueAt?: string | null;
  priority?: TaskPriority;
}
export interface UpdateTaskStatusRequest { status: TaskStatus; note?: string | null; }

export type FinanceTransactionType = "INCOME" | "EXPENSE";
export interface FinancialTransaction {
  id: number;
  farmId: number;
  batchId: number | null;
  incubationCycleId: number | null;
  transactionDate: string;
  type: FinanceTransactionType;
  category: string;
  amount: string;
  currency: string;
  counterparty: string | null;
  description: string | null;
  status: "POSTED" | "VOIDED";
  enteredBy: number;
  voidReason: string | null;
  createdAt: string;
}
export interface CreateFinancialTransactionRequest {
  batchId?: number | null;
  incubationCycleId?: number | null;
  transactionDate: string;
  type: FinanceTransactionType;
  category: string;
  amount: number;
  currency?: string;
  counterparty?: string | null;
  description?: string | null;
}
export interface OperationsAnalytics {
  startDate: string;
  endDate: string;
  incubation: { totalCycles: number; completedCycles: number; eggsLoaded: number; hatched: number; unhatched: number; removedOrDamaged: number; hatchRatePercent: number; averageDurationDays: number };
  tasks: { totalTasks: number; openTasks: number; completedTasks: number; overdueTasks: number; completionRatePercent: number };
  inputs: { totalLogs: number; byProductType: Record<string, number>; byBrand: Record<string, number> };
  finance: { currency: string; income: string; expense: string; net: string; transactionCount: number };
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
  bhi: number | null;
  bsi: number | null;
  wfr: number | null;
  readinessScore: number | null;
  temperatureC: number | null;
  mortalityCount: number | null;
  feedIntakeG: number | null;
  waterIntakeMl: number | null;
  temperatureScore: number | null;
  mortalityScore: number | null;
  feedScore: number | null;
  waterScore: number | null;
  temperatureContribution: number | null;
  mortalityContribution: number | null;
  feedContribution: number | null;
  waterContribution: number | null;
  temperatureQuality: ObservationQuality;
  feedQuality: ObservationQuality;
  waterQuality: ObservationQuality;
  formulaVersion: string;
  sufficientData: boolean;
  missingDataWarning: string | null;
  metrics: Record<string, MetricExplanation>;
  factors: FactorContribution[];
  computedAt: string;
}

export interface MetricExplanation {
  value: number | null;
  unit: string;
  configuredMin: number | null;
  configuredMax: number | null;
  status:
    | "INSUFFICIENT_DATA"
    | "NOT_APPLICABLE"
    | "NO_CONFIGURED_RANGE"
    | "WITHIN_CONFIGURED_RANGE"
    | "OUTSIDE_CONFIGURED_RANGE";
}

export interface FactorContribution {
  key: string;
  label: string;
  rawValue: number | null;
  unit: string;
  score: number | null;
  contribution: number | null;
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
  sourceEventId: number | null;
  indicatorId: number | null;
  indicatorType: string;
  batchName: string | null;
  handlerName: string | null;
  deathCount: number | null;
  cause: string | null;
  occurrenceDate: string | null;
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
  farmId: number;
  batchId: number;
  sourceEventId: number | null;
  severity: Severity;
  indicatorType: string;
  summary: string;
  batchName: string | null;
  handlerName: string | null;
  deathCount: number | null;
  cause: string | null;
  occurrenceDate: string | null;
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

// ---- Batch Selection Review Report (descriptive, manager-reviewed) ----
export type SelectionReviewStatus = "DRAFT" | "FINALIZED";
export type ManagerReviewStatus =
  | "NOT_REVIEWED"
  | "FOR_IN_PERSON_ASSESSMENT"
  | "CONTINUE_OBSERVATION"
  | "REVIEW_COMPLETED";

export interface SelectionReviewPayload {
  reportTitle: string;
  disclaimer: string;
  payloadVersion: string;
  periodStart: string;
  periodEnd: string;
  asOfDate: string;
  batch: SelectionReviewBatchOverview;
  population: SelectionReviewPopulation;
  healthEvents: SelectionReviewHealthEvent[];
  productUse: SelectionReviewProductUse[];
  incubation: SelectionReviewIncubation | null;
  finance: SelectionReviewFinance | null;
  dataAvailability: SelectionReviewDataAvailability[];
  reviewInstructions: SelectionReviewInstructions;
}

export interface SelectionReviewBatchOverview {
  batchId: number;
  batchName: string;
  bloodline: string | null;
  source: string | null;
  initialPopulation: number;
  currentPopulation: number;
  currentPopulationDisplay: string;
  ageDays: number;
  stageName: string;
  startDate: string;
  lastRecordedEventDate: string | null;
}

export interface SelectionReviewPopulation {
  initialPopulation: number;
  currentPopulation: number;
  healthRelatedDeaths: number;
  healthRelatedLossPercentage: number | null;
  accidentalDeaths: number;
  predation: number;
  missing: number;
  returned: number;
  transfersOut: number;
  transfersIn: number;
  sales: number;
  culling: number;
  countCorrections: number;
  legacyMortalityRecords: number;
  sourceEventCount: number;
  categoryCounts: Record<string, number>;
}

export interface SelectionReviewHealthEvent {
  sourceEventId: number;
  eventDate: string;
  eventType: string;
  title: string;
  severity: string | null;
  affectedCount: number;
  details: string | null;
  tags: string | null;
  recordedBy: number;
}

export interface SelectionReviewProductUse {
  sourceId: number;
  recordedAt: string;
  productType: string;
  brandName: string;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  purpose: string | null;
  notes: string | null;
  recordedBy: number;
}

export interface SelectionReviewIncubation {
  cycleId: number;
  cycleName: string;
  incubatorCode: string;
  loadedDate: string;
  eggsLoaded: number;
  expectedHatchDate: string | null;
  actualHatchDate: string | null;
  hatchedCount: number | null;
  unhatchedCount: number | null;
  removedDamagedCount: number | null;
  hatchRate: number | null;
  limitation: string;
}

export interface SelectionReviewFinance {
  startDate: string;
  endDate: string;
  recordedIncome: number;
  recordedExpense: number;
  recordedNetCashFlow: number;
  postedTransactionCount: number;
  recordsMayBeIncomplete: boolean;
  limitation: string;
}

export interface SelectionReviewDataAvailability {
  section: string;
  status: "AVAILABLE" | "PARTIAL" | "NO_RECORDS" | "NOT_APPLICABLE";
  recordCount: number;
  latestDate: string | null;
  message: string;
}

export interface SelectionReviewInstructions {
  status: ManagerReviewStatus;
  managerNotes: string | null;
  nextReviewDate: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface SelectionReviewResponse {
  id: number;
  farmId: number;
  batchId: number;
  batchName: string;
  periodStart: string;
  periodEnd: string;
  asOfDate: string;
  status: SelectionReviewStatus;
  reviewStatus: ManagerReviewStatus;
  managerNotes: string | null;
  nextReviewDate: string | null;
  versionNumber: number;
  purpose: string | null;
  snapshotNote: string | null;
  payloadVersion: string;
  payload: SelectionReviewPayload;
  generatedBy: number;
  generatedAt: string;
  sourceCutoffAt: string | null;
  newerDataAvailable: boolean;
  reviewedBy: number | null;
  reviewedAt: string | null;
}

export interface FinalizeSelectionReviewRequest {
  reviewStatus: ManagerReviewStatus;
  managerNotes?: string | null;
  nextReviewDate?: string | null;
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
  | "HEALTH_DEATH"
  | "ACCIDENTAL_DEATH"
  | "SUSPECTED_PREDATION"
  | "CONFIRMED_PREDATION"
  | "MISSING"
  | "FOUND_RETURNED"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "SALE"
  | "CULLING"
  | "COUNT_CORRECTION"
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
  operationId?: string | null;
  populationDelta?: number | null;
  populationAfter?: number | null;
  remainingPopulation?: number | null;
}

export interface CreateBatchEventRequest {
  eventDate?: string | null;
  eventType: EventType;
  title: string;
  severityLabel?: string | null;
  affectedCount?: number;
  operationId?: string;
  populationDelta?: number | null;
  details?: string | null;
  tags?: string | null;
}

export interface VersionInfo {
  application: string;
  version: string;
  commitSha: string;
  buildTime: string;
  environment: string;
  compatibleFrontendVersion: string;
}

// ---- Handlers & invites ----
export interface Handler {
  id: number;
  email: string;
  fullName: string;
}

export interface CreateHandlerRequest {
  email: string;
  password: string;
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
