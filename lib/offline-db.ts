"use client";

import type { Batch, FarmProduct } from "./types";

export type OfflineEntityType = "BATCH_EVENT" | "FARM_INPUT";
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

const DB_NAME = "poultry-prophet-offline-v1";
const DB_VERSION = 2;
const OUTBOX_STORE = "outbox";
const SNAPSHOT_STORE = "batchSnapshots";
const PRODUCT_STORE = "productSnapshots";
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
