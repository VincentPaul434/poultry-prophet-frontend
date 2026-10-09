"use client";

import type { Batch, BatchDashboardItem, BatchEvent, BatchOverview, FarmProduct, SelectionSession } from "./types";

export type OfflineEntityType = "BATCH_EVENT" | "FARM_INPUT" | "SELECTION_SESSION" | "SELECTION_SESSION_UPDATE" | "SEX_COMPOSITION" | "VACCINATION_PLAN";
export type OutboxStatus =
  | "PENDING"
  | "SYNCING"
  | "RETRY_WAIT"
  | "AUTH_REQUIRED"
  | "CONFLICT"
  | "REJECTED";

export interface OutboxOperation {
  operationId: string;
  schemaVersion: 1;
  entityType: OfflineEntityType;
  userId: number;
  farmId: number;
  batchId: number;
  payload: Record<string, unknown>;
  occurredAt: string;
  queuedAt: string;
  sequence: number;
  status: OutboxStatus;
  attemptCount: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
}

export interface StoredBatchSnapshot {
  key: string;
  userId: number;
  farmId: number;
  batch: Batch;
  savedAt: string;
}

export interface StoredFarmProductSnapshot {
  key: string;
  userId: number;
  farmId: number;
  products: FarmProduct[];
  savedAt: string;
}

export interface StoredDashboardSnapshot {
  key: string;
  userId: number;
  farmId: number;
  items: BatchDashboardItem[];
  savedAt: string;
}

export interface StoredBatchOverviewSnapshot {
  key: string;
  userId: number;
  farmId: number;
  batchId: number;
  overview: BatchOverview;
  savedAt: string;
}

export interface StoredBatchEventSnapshot {
  key: string;
  userId: number;
  farmId: number;
  batchId: number;
  events: BatchEvent[];
  savedAt: string;
}

export interface StoredSelectionSessionSnapshot {
  key: string;
  userId: number;
  farmId: number;
  batchId: number;
  sessions: SelectionSession[];
  savedAt: string;
}

const DB_NAME = "poultry-prophet-offline-v1";
const DB_VERSION = 4;
const OUTBOX_STORE = "outbox";
const SNAPSHOT_STORE = "batchSnapshots";
const PRODUCT_STORE = "productSnapshots";
const DASHBOARD_STORE = "dashboardSnapshots";
const OVERVIEW_STORE = "batchOverviewSnapshots";
const EVENT_STORE = "batchEventSnapshots";
const SELECTION_SESSION_STORE = "selectionSessionSnapshots";
const META_STORE = "syncMeta";
const OUTBOX_CHANGED = "pp-offline-outbox-changed";

let dbPromise: Promise<IDBDatabase> | null = null;

function ensureBrowser() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("Offline storage is not available in this browser.");
  }
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline storage transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline storage transaction was aborted."));
  });
}

function emitChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_CHANGED));
}

export function onOfflineOutboxChanged(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(OUTBOX_CHANGED, listener);
  return () => window.removeEventListener(OUTBOX_CHANGED, listener);
}

function openDatabase() {
  ensureBrowser();
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const outbox = db.objectStoreNames.contains(OUTBOX_STORE)
        ? request.transaction!.objectStore(OUTBOX_STORE)
        : db.createObjectStore(OUTBOX_STORE, { keyPath: "operationId" });
      if (!outbox.indexNames.contains("byUserFarm")) outbox.createIndex("byUserFarm", ["userId", "farmId"]);
      if (!outbox.indexNames.contains("byBatchSequence")) outbox.createIndex("byBatchSequence", ["batchId", "sequence"]);
      if (!outbox.indexNames.contains("byStatus")) outbox.createIndex("byStatus", "status");
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const snapshots = db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
        snapshots.createIndex("byUserFarm", ["userId", "farmId"]);
      }
      if (!db.objectStoreNames.contains(PRODUCT_STORE)) db.createObjectStore(PRODUCT_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(DASHBOARD_STORE)) db.createObjectStore(DASHBOARD_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(OVERVIEW_STORE)) db.createObjectStore(OVERVIEW_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(EVENT_STORE)) db.createObjectStore(EVENT_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(SELECTION_SESSION_STORE)) db.createObjectStore(SELECTION_SESSION_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
  return dbPromise;
}

async function nextSequence(db: IDBDatabase) {
  const tx = db.transaction([META_STORE], "readwrite");
  const store = tx.objectStore(META_STORE);
  const current = (await requestResult(store.get("sequence")) as { value?: number } | undefined)?.value ?? 0;
  const sequence = current + 1;
  store.put({ key: "sequence", value: sequence });
  await transactionDone(tx);
  return sequence;
}

export async function getDeviceId() {
  ensureBrowser();
  const key = "pp_offline_device_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, created);
  return created;
}

export async function putOutboxOperation(operation: Omit<OutboxOperation, "sequence" | "status" | "attemptCount">) {
  const db = await openDatabase();
  const sequence = await nextSequence(db);
  const record: OutboxOperation = { ...operation, sequence, status: "PENDING", attemptCount: 0 };
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  tx.objectStore(OUTBOX_STORE).put(record);
  await transactionDone(tx);
  emitChanged();
  return record;
}

export async function listOutbox(userId: number, farmId: number) {
  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readonly");
  const all = await requestResult(tx.objectStore(OUTBOX_STORE).getAll()) as OutboxOperation[];
  await transactionDone(tx);
  return all.filter((item) => item.userId === userId && item.farmId === farmId)
    .sort((a, b) => a.sequence - b.sequence);
}

export async function getQueuedPopulationDelta(userId: number, farmId: number, batchId: number) {
  const operations = await listOutbox(userId, farmId);
  const signs: Record<string, number> = {
    MORTALITY: -1,
    HEALTH_DEATH: -1,
    ACCIDENTAL_DEATH: -1,
    SUSPECTED_PREDATION: -1,
    CONFIRMED_PREDATION: -1,
    MISSING: -1,
    FOUND_RETURNED: 1,
    TRANSFER_OUT: -1,
    TRANSFER_IN: 1,
    SALE: -1,
    CULLING: -1,
  };
  return operations
    .filter((operation) => operation.batchId === batchId
      && operation.entityType === "BATCH_EVENT"
      && operation.status !== "CONFLICT"
      && operation.status !== "REJECTED")
    .reduce((total, operation) => {
      const eventType = operation.payload.eventType;
      if (eventType === "COUNT_CORRECTION") {
        const correction = operation.payload.populationDelta;
        return total + (typeof correction === "number" ? correction : 0);
      }
      const sign = typeof eventType === "string" ? signs[eventType] : undefined;
      const count = operation.payload.affectedCount;
      return total + (sign && typeof count === "number" ? sign * count : 0);
    }, 0);
}

export async function retryOutboxIssues(userId: number, farmId: number) {
  const items = await listOutbox(userId, farmId);
  const issues = items.filter((item) => item.status === "CONFLICT" || item.status === "REJECTED");
  await Promise.all(issues.map((item) => updateOutboxOperation(item.operationId, {
    status: "PENDING",
    attemptCount: 0,
    nextAttemptAt: undefined,
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
  })));
  return issues.length;
}

export async function updateOutboxOperation(operationId: string, patch: Partial<OutboxOperation>) {
  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  const existing = await requestResult(store.get(operationId)) as OutboxOperation | undefined;
  if (existing) store.put({ ...existing, ...patch });
  await transactionDone(tx);
  emitChanged();
}

export async function deleteOutboxOperation(operationId: string) {
  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  tx.objectStore(OUTBOX_STORE).delete(operationId);
  await transactionDone(tx);
  emitChanged();
}

export async function saveBatchSnapshots(userId: number, farmId: number, batches: Batch[]) {
  const db = await openDatabase();
  const tx = db.transaction([SNAPSHOT_STORE], "readwrite");
  const store = tx.objectStore(SNAPSHOT_STORE);
  const savedAt = new Date().toISOString();
  for (const batch of batches) {
    store.put({ key: `${userId}:${farmId}:${batch.id}`, userId, farmId, batch, savedAt } satisfies StoredBatchSnapshot);
  }
  await transactionDone(tx);
}

export async function getBatchSnapshot(userId: number, farmId: number, batchId: number) {
  const db = await openDatabase();
  const tx = db.transaction([SNAPSHOT_STORE], "readonly");
  const result = await requestResult(tx.objectStore(SNAPSHOT_STORE).get(`${userId}:${farmId}:${batchId}`)) as StoredBatchSnapshot | undefined;
  await transactionDone(tx);
  return result?.batch ?? null;
}

export async function getBatchSnapshots(userId: number, farmId: number) {
  const db = await openDatabase();
  const tx = db.transaction([SNAPSHOT_STORE], "readonly");
  const all = await requestResult(tx.objectStore(SNAPSHOT_STORE).getAll()) as StoredBatchSnapshot[];
  await transactionDone(tx);
  return all.filter((item) => item.userId === userId && item.farmId === farmId).map((item) => item.batch);
}

export async function saveFarmProductSnapshots(userId: number, farmId: number, products: FarmProduct[]) {
  const db = await openDatabase();
  const tx = db.transaction([PRODUCT_STORE], "readwrite");
  tx.objectStore(PRODUCT_STORE).put({ key: `${userId}:${farmId}`, userId, farmId, products, savedAt: new Date().toISOString() } satisfies StoredFarmProductSnapshot);
  await transactionDone(tx);
}

export async function getFarmProductSnapshots(userId: number, farmId: number) {
  const db = await openDatabase();
  const tx = db.transaction([PRODUCT_STORE], "readonly");
  const result = await requestResult(tx.objectStore(PRODUCT_STORE).get(`${userId}:${farmId}`)) as StoredFarmProductSnapshot | undefined;
  await transactionDone(tx);
  return result?.products ?? [];
}

export async function saveDashboardSnapshot(userId: number, farmId: number, items: BatchDashboardItem[]) {
  const db = await openDatabase();
  const tx = db.transaction([DASHBOARD_STORE], "readwrite");
  tx.objectStore(DASHBOARD_STORE).put({
    key: `${userId}:${farmId}`,
    userId,
    farmId,
    items,
    savedAt: new Date().toISOString(),
  } satisfies StoredDashboardSnapshot);
  await transactionDone(tx);
}

export async function getDashboardSnapshot(userId: number, farmId: number) {
  const db = await openDatabase();
  const tx = db.transaction([DASHBOARD_STORE], "readonly");
  const result = await requestResult(tx.objectStore(DASHBOARD_STORE).get(`${userId}:${farmId}`)) as StoredDashboardSnapshot | undefined;
  await transactionDone(tx);
  return result?.items ?? null;
}

export async function saveBatchOverviewSnapshot(userId: number, farmId: number, overview: BatchOverview) {
  const db = await openDatabase();
  const tx = db.transaction([OVERVIEW_STORE], "readwrite");
  tx.objectStore(OVERVIEW_STORE).put({
    key: `${userId}:${farmId}:${overview.batch.id}`,
    userId,
    farmId,
    batchId: overview.batch.id,
    overview,
    savedAt: new Date().toISOString(),
  } satisfies StoredBatchOverviewSnapshot);
  await transactionDone(tx);
}

export async function getBatchOverviewSnapshot(userId: number, farmId: number, batchId: number) {
  const db = await openDatabase();
  const tx = db.transaction([OVERVIEW_STORE], "readonly");
  const result = await requestResult(tx.objectStore(OVERVIEW_STORE).get(`${userId}:${farmId}:${batchId}`)) as StoredBatchOverviewSnapshot | undefined;
  await transactionDone(tx);
  return result?.overview ?? null;
}

export async function saveBatchEventSnapshot(userId: number, farmId: number, batchId: number, events: BatchEvent[]) {
  const db = await openDatabase();
  const tx = db.transaction([EVENT_STORE], "readwrite");
  const store = tx.objectStore(EVENT_STORE);
  const key = `${userId}:${farmId}:${batchId}`;
  const existing = await requestResult(store.get(key)) as StoredBatchEventSnapshot | undefined;
  const merged = new Map<number, BatchEvent>();
  for (const event of [...(existing?.events ?? []), ...events]) merged.set(event.id, event);
  const combined = [...merged.values()]
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 200);
  store.put({
    key,
    userId,
    farmId,
    batchId,
    events: combined,
    savedAt: new Date().toISOString(),
  } satisfies StoredBatchEventSnapshot);
  await transactionDone(tx);
}

export async function getBatchEventSnapshot(userId: number, farmId: number, batchId: number) {
  const db = await openDatabase();
  const tx = db.transaction([EVENT_STORE], "readonly");
  const result = await requestResult(tx.objectStore(EVENT_STORE).get(`${userId}:${farmId}:${batchId}`)) as StoredBatchEventSnapshot | undefined;
  await transactionDone(tx);
  return result?.events ?? null;
}

export async function saveSelectionSessionSnapshot(userId: number, farmId: number, batchId: number, sessions: SelectionSession[]) {
  const db = await openDatabase();
  const tx = db.transaction([SELECTION_SESSION_STORE], "readwrite");
  tx.objectStore(SELECTION_SESSION_STORE).put({
    key: `${userId}:${farmId}:${batchId}`,
    userId,
    farmId,
    batchId,
    sessions,
    savedAt: new Date().toISOString(),
  } satisfies StoredSelectionSessionSnapshot);
  await transactionDone(tx);
}

export async function getSelectionSessionSnapshot(userId: number, farmId: number, batchId: number) {
  const db = await openDatabase();
  const tx = db.transaction([SELECTION_SESSION_STORE], "readonly");
  const result = await requestResult(tx.objectStore(SELECTION_SESSION_STORE).get(`${userId}:${farmId}:${batchId}`)) as StoredSelectionSessionSnapshot | undefined;
  await transactionDone(tx);
  return result?.sessions ?? null;
}

export async function upsertSelectionSessionSnapshot(userId: number, farmId: number, batchId: number, session: SelectionSession) {
  const db = await openDatabase();
  const tx = db.transaction([SELECTION_SESSION_STORE], "readwrite");
  const store = tx.objectStore(SELECTION_SESSION_STORE);
  const key = `${userId}:${farmId}:${batchId}`;
  const existing = await requestResult(store.get(key)) as StoredSelectionSessionSnapshot | undefined;
  const sessions = new Map((existing?.sessions ?? []).map((item) => [item.id, item]));
  sessions.set(session.id, session);
  store.put({
    key,
    userId,
    farmId,
    batchId,
    sessions: [...sessions.values()].sort((a, b) => b.selectionDate.localeCompare(a.selectionDate) || b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
    savedAt: new Date().toISOString(),
  } satisfies StoredSelectionSessionSnapshot);
  await transactionDone(tx);
}

export async function commitSyncedSelectionSession(operation: OutboxOperation, serverId: number, serverTime: string) {
  if (operation.entityType !== "SELECTION_SESSION" && operation.entityType !== "SELECTION_SESSION_UPDATE") return;
  const userId = operation.userId;
  const farmId = operation.farmId;
  const batchId = operation.batchId;
  const payload = operation.payload;
  const sessions = await getSelectionSessionSnapshot(userId, farmId, batchId) ?? [];

  if (operation.entityType === "SELECTION_SESSION") {
    const evaluatedCount = typeof payload.evaluatedCount === "number" ? payload.evaluatedCount : 1;
    const acceptedCount = typeof payload.acceptedCount === "number" ? payload.acceptedCount : 0;
    const session: SelectionSession = {
      id: serverId,
      farmId,
      batchId,
      selectionDate: typeof payload.selectionDate === "string" ? payload.selectionDate : operation.occurredAt.slice(0, 10),
      reviewerId: userId,
      evaluatedCount,
      acceptedCount,
      continueObservationCount: typeof payload.continueObservationCount === "number" ? payload.continueObservationCount : 0,
      notAcceptedCount: typeof payload.notAcceptedCount === "number" ? payload.notAcceptedCount : 0,
      otherCount: typeof payload.otherCount === "number" ? payload.otherCount : 0,
      selectionRatePercent: evaluatedCount > 0 ? Math.round((acceptedCount / evaluatedCount) * 10000) / 100 : null,
      selectionRateNumerator: acceptedCount,
      selectionRateDenominator: evaluatedCount,
      status: "DRAFT",
      criterionCodes: Array.isArray(payload.criterionCodes) ? payload.criterionCodes.filter((item): item is string => typeof item === "string") : [],
      criteriaNotes: typeof payload.criteriaNotes === "string" ? payload.criteriaNotes : null,
      sessionNotes: typeof payload.sessionNotes === "string" ? payload.sessionNotes : null,
      operationId: operation.operationId,
      supersedesSessionId: null,
      createdAt: serverTime,
      updatedAt: serverTime,
      finalizedAt: null,
    };
    await upsertSelectionSessionSnapshot(userId, farmId, batchId, session);
    return;
  }

  const sessionId = typeof payload.sessionId === "number" ? payload.sessionId : serverId;
  const existing = sessions.find((session) => session.id === sessionId);
  if (!existing) return;
  const evaluatedCount = typeof payload.evaluatedCount === "number" ? payload.evaluatedCount : existing.evaluatedCount;
  const acceptedCount = typeof payload.acceptedCount === "number" ? payload.acceptedCount : existing.acceptedCount;
  const updated: SelectionSession = {
    ...existing,
    selectionDate: typeof payload.selectionDate === "string" ? payload.selectionDate : existing.selectionDate,
    evaluatedCount,
    acceptedCount,
    continueObservationCount: typeof payload.continueObservationCount === "number" ? payload.continueObservationCount : existing.continueObservationCount,
    notAcceptedCount: typeof payload.notAcceptedCount === "number" ? payload.notAcceptedCount : existing.notAcceptedCount,
    otherCount: typeof payload.otherCount === "number" ? payload.otherCount : existing.otherCount,
    selectionRatePercent: evaluatedCount > 0 ? Math.round((acceptedCount / evaluatedCount) * 10000) / 100 : null,
    selectionRateNumerator: acceptedCount,
    selectionRateDenominator: evaluatedCount,
    criterionCodes: Array.isArray(payload.criterionCodes) ? payload.criterionCodes.filter((item): item is string => typeof item === "string") : existing.criterionCodes,
    criteriaNotes: typeof payload.criteriaNotes === "string" ? payload.criteriaNotes : null,
    sessionNotes: typeof payload.sessionNotes === "string" ? payload.sessionNotes : null,
    updatedAt: serverTime,
  };
  await upsertSelectionSessionSnapshot(userId, farmId, batchId, updated);
}

export async function setLastSuccessfulSync(value: string) {
  const db = await openDatabase();
  const tx = db.transaction([META_STORE], "readwrite");
  tx.objectStore(META_STORE).put({ key: "lastSuccessfulSync", value });
  await transactionDone(tx);
}

export async function getLastSuccessfulSync() {
  const db = await openDatabase();
  const tx = db.transaction([META_STORE], "readonly");
  const result = await requestResult(tx.objectStore(META_STORE).get("lastSuccessfulSync")) as { value?: string } | undefined;
  await transactionDone(tx);
  return result?.value ?? null;
}
