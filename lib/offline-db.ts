"use client";

import type { Batch, BatchDashboardItem, BatchEvent, BatchOverview, FarmProduct, OfflineBootstrap, SelectionSession } from "./types";

export class OfflineStorageError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "OfflineStorageError";
  }
}

function storageFailure(error: DOMException | null, message: string) {
  return error?.name === "QuotaExceededError"
    ? new OfflineStorageError("This device has no space to save the record. Free device space and retry. Do not clear site data; queued records must be preserved.", "QUOTA_EXCEEDED")
    : new OfflineStorageError(`${message} Close other farm tabs, check device storage, and retry. Do not clear site data; queued records must be preserved.`, "STORAGE_FAILED");
}

export type OfflineEntityType = "BATCH_EVENT" | "FARM_INPUT" | "SELECTION_SESSION" | "SELECTION_SESSION_UPDATE" | "SEX_COMPOSITION" | "VACCINATION_PLAN" | "TASK_STATUS" | "VACCINATION_SCHEDULE" | "DAILY_RECORD";
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
  leaseOwner?: string;
  leaseUntil?: number;
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

export interface StoredOfflineBootstrap {
  key: string;
  userId: number;
  farmId: number;
  data: OfflineBootstrap;
  savedAt: string;
}

const DB_NAME = "poultry-prophet-offline-v1";
const DB_VERSION = 5;
const OUTBOX_STORE = "outbox";
const SNAPSHOT_STORE = "batchSnapshots";
const PRODUCT_STORE = "productSnapshots";
const DASHBOARD_STORE = "dashboardSnapshots";
const OVERVIEW_STORE = "batchOverviewSnapshots";
const EVENT_STORE = "batchEventSnapshots";
const SELECTION_SESSION_STORE = "selectionSessionSnapshots";
const META_STORE = "syncMeta";
const FIELD_STORE = "fieldBootstrapSnapshots";
const OUTBOX_CHANGED = "pp-offline-outbox-changed";

let dbPromise: Promise<IDBDatabase> | null = null;

function ensureBrowser() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new OfflineStorageError("Offline storage is not available in this browser.", "UNAVAILABLE");
  }
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageFailure(request.error, "Offline storage request failed."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(storageFailure(transaction.error, "Offline storage transaction failed."));
    transaction.onabort = () => reject(storageFailure(transaction.error, "Offline storage transaction was aborted."));
  });
}

function emitChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OUTBOX_CHANGED));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(OUTBOX_CHANGED);
    channel.postMessage("changed");
    channel.close();
  }
}

export function onOfflineOutboxChanged(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(OUTBOX_CHANGED, listener);
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(OUTBOX_CHANGED);
  if (channel) channel.onmessage = listener;
  return () => { window.removeEventListener(OUTBOX_CHANGED, listener); channel?.close(); };
}

function openDatabase() {
  ensureBrowser();
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error | DOMException) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(error);
    };
    const timeout = window.setTimeout(() => fail(new OfflineStorageError(
      "Offline storage did not open in time. Close other farm tabs and retry. Do not clear site data; queued records must be preserved.", "OPEN_TIMEOUT",
    )), 10_000);
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onblocked = () => fail(new OfflineStorageError(
      "Offline storage is waiting for another tab. Close other farm tabs and retry. Do not clear site data; queued records must be preserved.", "BLOCKED",
    ));
    request.onupgradeneeded = () => {
      // A timed-out/blocked request cannot be cancelled. If it later receives
      // access, abort its upgrade and let an explicit retry open the database.
      if (settled) { request.transaction?.abort(); return; }
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
      if (!db.objectStoreNames.contains(FIELD_STORE)) db.createObjectStore(FIELD_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      window.clearTimeout(timeout);
      request.result.onversionchange = () => { request.result.close(); dbPromise = null; };
      resolve(request.result);
    };
    request.onerror = () => fail(storageFailure(request.error, "Could not open offline storage."));
  }).catch((error) => { dbPromise = null; throw error; });
  return dbPromise;
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
  const tx = db.transaction([OUTBOX_STORE, META_STORE], "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  const existing = await requestResult(store.get(operation.operationId)) as OutboxOperation | undefined;
  if (existing) {
    // A command UUID binds immutable intent even before the first attempt.
    // Identical duplicate saves are harmless, but must retain queue order,
    // original queuedAt, claims, attempts and any unresolved result.
    const canonicalPayload = (payload: Record<string, unknown>) => JSON.stringify(payload, (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
        : value);
    const identical = existing.schemaVersion === operation.schemaVersion
      && existing.entityType === operation.entityType
      && existing.userId === operation.userId && existing.farmId === operation.farmId
      && existing.batchId === operation.batchId && existing.occurredAt === operation.occurredAt
      && canonicalPayload(existing.payload) === canonicalPayload(operation.payload);
    await transactionDone(tx);
    if (!identical) throw new Error("This offline record already exists with different details. Its original queued record was preserved.");
    return existing;
  }
  const meta = tx.objectStore(META_STORE);
  const current = (await requestResult(meta.get("sequence")) as { value?: number } | undefined)?.value ?? 0;
  const sequence = current + 1;
  meta.put({ key: "sequence", value: sequence });
  const record: OutboxOperation = { ...operation, sequence, status: "PENDING", attemptCount: 0 };
  store.put(record);
  await transactionDone(tx);
  emitChanged();
  return record;
}

// The read and claims share one transaction, so tabs cannot claim the same head.
export async function claimOutboxOperations(userId: number, farmId: number, owner: string, now: number, leaseMs: number) {
  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  const items = await requestResult(store.index("byUserFarm").getAll([userId, farmId])) as OutboxOperation[];
  const heads = new Map<number, OutboxOperation>();
  for (const item of items.sort((a, b) => a.sequence - b.sequence)) {
    if (!heads.has(item.batchId)) heads.set(item.batchId, item);
  }
  const selected = [...heads.values()].filter((item) => item.status === "PENDING"
    || (item.status === "RETRY_WAIT" && (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now))
    || (item.status === "SYNCING" && (!item.leaseUntil || item.leaseUntil <= now))).slice(0, 25);
  for (const item of selected) {
    item.status = "SYNCING";
    item.leaseOwner = owner;
    item.leaseUntil = now + leaseMs;
    item.lastAttemptAt = new Date(now).toISOString();
    store.put(item);
  }
  await transactionDone(tx);
  if (selected.length) emitChanged();
  return selected;
}

export async function updateClaimedOutboxOperation(operationId: string, owner: string, patch: Partial<OutboxOperation> | null) {
  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  const existing = await requestResult(store.get(operationId)) as OutboxOperation | undefined;
  const owned = existing?.status === "SYNCING" && existing.leaseOwner === owner;
  if (owned) {
    if (patch) store.put({ ...existing, ...patch });
    else store.delete(operationId);
  }
  await transactionDone(tx);
  if (owned) emitChanged();
  return owned;
}

export async function renewOutboxClaims(operationIds: string[], owner: string, leaseUntil: number) {
  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  for (const id of operationIds) {
    const item = await requestResult(store.get(id)) as OutboxOperation | undefined;
    if (item?.status === "SYNCING" && item.leaseOwner === owner) store.put({ ...item, leaseUntil });
  }
  await transactionDone(tx);
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

export async function getQueuedInventoryDelta(userId: number, farmId: number, farmProductId: number) {
  const operations = await listOutbox(userId, farmId);
  return operations
    .filter((operation) => operation.entityType === "FARM_INPUT"
      && operation.status !== "CONFLICT"
      && operation.status !== "REJECTED"
      && Number(operation.payload.farmProductId) === farmProductId)
    .reduce((total, operation) => {
      const quantity = Number(operation.payload.quantity);
      return Number.isFinite(quantity) ? total - quantity : total;
    }, 0);
}

export async function retryOutboxIssues(userId: number, farmId: number) {
  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  const items = await requestResult(store.index("byUserFarm").getAll([userId, farmId])) as OutboxOperation[];
  // A conflict or rejection is a manager-review state, not an automatic retry.
  // Only an expired authentication state is safe to retry without changing data.
  const issues = items.filter((item) => item.status === "AUTH_REQUIRED");
  for (const item of issues) store.put({ ...item,
    status: "PENDING",
    attemptCount: 0,
    nextAttemptAt: undefined,
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
  });
  await transactionDone(tx);
  if (issues.length) emitChanged();
  return issues.length;
}

export type DeathObservation = "SIGNS" | "NO_SIGNS" | "UNKNOWN";

/** Only an unstructured legacy death rejected for missing observation is editable here. */
export function canCorrectRejectedDeathObservation(item: OutboxOperation) {
  return item.status === "REJECTED"
    && item.entityType === "BATCH_EVENT"
    && (item.payload.eventType === "HEALTH_DEATH" || item.payload.eventType === "MORTALITY")
    && item.payload.deathObservation == null
    && (item.lastErrorMessage === "Record what was observed or that it is unknown"
      || item.lastErrorMessage === "Describe the signs noticed");
}

/** Correct one rejected record without changing its identity or place in the batch queue. */
export async function correctRejectedDeathObservation(operationId: string, userId: number, farmId: number, observation: DeathObservation, signs = "") {
  const cleanSigns = signs.trim();
  if (observation !== "SIGNS" && observation !== "NO_SIGNS" && observation !== "UNKNOWN") throw new Error("Choose what was observed.");
  if (observation === "SIGNS" && !cleanSigns) throw new Error("Describe the signs noticed.");

  const db = await openDatabase();
  const tx = db.transaction([OUTBOX_STORE], "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  const existing = await requestResult(store.get(operationId)) as OutboxOperation | undefined;
  if (!existing || existing.userId !== userId || existing.farmId !== farmId || !canCorrectRejectedDeathObservation(existing)) {
    await transactionDone(tx);
    throw new Error("This record is no longer available to correct. Refresh and try again.");
  }
  const oldDetails = typeof existing.payload.details === "string" ? existing.payload.details : "";
  const notes = oldDetails.replace(/^[^\S\r\n]*signs[^\S\r\n]+noticed[^\S\r\n]*:[^\S\r\n]*(?:\r\n|\r|\n|$)/i, "").trim();
  const summary = observation === "SIGNS" ? `Signs noticed: ${cleanSigns}`
    : observation === "NO_SIGNS" ? "No signs noticed." : "Signs not observed / unknown.";
  store.put({ ...existing,
    payload: { ...existing.payload, deathObservation: observation, deathSigns: observation === "SIGNS" ? cleanSigns : null,
      details: [summary, notes].filter(Boolean).join("\n") },
    status: "PENDING", attemptCount: 0, nextAttemptAt: undefined, lastAttemptAt: undefined,
    lastErrorCode: undefined, lastErrorMessage: undefined, leaseOwner: undefined, leaseUntil: undefined,
  });
  await transactionDone(tx);
  emitChanged();
}

export async function saveOfflineBootstrap(userId: number, farmId: number, data: OfflineBootstrap) {
  const db = await openDatabase();
  const tx = db.transaction([FIELD_STORE], "readwrite");
  tx.objectStore(FIELD_STORE).put({
    key: `${userId}:${farmId}`,
    userId,
    farmId,
    data,
    savedAt: new Date().toISOString(),
  } satisfies StoredOfflineBootstrap);
  await transactionDone(tx);
}

export async function getOfflineBootstrap(userId: number, farmId: number) {
  const db = await openDatabase();
  const tx = db.transaction([FIELD_STORE], "readonly");
  const result = await requestResult(tx.objectStore(FIELD_STORE).get(`${userId}:${farmId}`)) as StoredOfflineBootstrap | undefined;
  await transactionDone(tx);
  return result?.data ?? null;
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
      selectionReviewId: typeof payload.selectionReviewId === "number" ? payload.selectionReviewId : null,
      sourceDataAcknowledged: payload.sourceDataAcknowledged === true,
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
    sourceDataAcknowledged: payload.sourceDataAcknowledged === true || existing.sourceDataAcknowledged,
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

// Remove cached copies after confirmed server deletion. Pending outbox entries are
// deliberately retained so deletion never silently discards unsynchronized work.
export async function removeDeletedBatchSnapshots(userId: number, farmId: number, batchId: number) {
  const db = await openDatabase();
  const stores = [SNAPSHOT_STORE, OVERVIEW_STORE, EVENT_STORE, SELECTION_SESSION_STORE, DASHBOARD_STORE, FIELD_STORE];
  const tx = db.transaction(stores, "readwrite");
  const key = `${userId}:${farmId}:${batchId}`;
  for (const store of [SNAPSHOT_STORE, OVERVIEW_STORE, EVENT_STORE, SELECTION_SESSION_STORE]) tx.objectStore(store).delete(key);
  const dashboard = tx.objectStore(DASHBOARD_STORE);
  const request = dashboard.get(`${userId}:${farmId}`);
  request.onsuccess = () => {
    const snapshot = request.result as StoredDashboardSnapshot | undefined;
    if (snapshot) dashboard.put({ ...snapshot, items: snapshot.items.filter(item => item.batch.id !== batchId) });
  };
  tx.objectStore(FIELD_STORE).delete(`${userId}:${farmId}`);
  await transactionDone(tx);
}
