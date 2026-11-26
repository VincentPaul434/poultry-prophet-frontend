"use client";
import { newSecureUuid } from "@/lib/uuid";

/** A pending online request, not an acknowledged financial or inventory record. */
export type ManagerIntentKind = "FINANCE_CREATE" | "FINANCE_CORRECTION" | "STOCK_IN" | "PRODUCT_CREATE" | "STOCK_ADJUSTMENT";
export interface ManagerIntentScope { userId: number; farmId: number; kind: ManagerIntentKind; targetId: string; contextId?: string; }
export interface ManagerIntent<T = unknown> extends ManagerIntentScope {
  key: string;
  operationId: string;
  payload: T;
  createdAt: string;
}

const DATABASE = "poultry-prophet-manager-intents-v1";
const STORE = "intents";
export const MANAGER_INTENTS_CHANGED = "pp-manager-intents-changed";

function changed() { if (typeof window !== "undefined") window.dispatchEvent(new Event(MANAGER_INTENTS_CHANGED)); }

export function financeIntentTarget(body: { batchId?: number | null; incubationCycleId?: number | null }): string {
  return body.batchId != null ? String(body.batchId) : body.incubationCycleId != null ? `cycle:${body.incubationCycleId}` : "farm";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Cannot safely save this request on this device."));
    const request = indexedDB.open(DATABASE, 1);
    let settled = false;
    const fail = (message: string) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(message)); } };
    const timer = setTimeout(() => fail("Manager request storage did not open in time. Close other app tabs and try again."), 10_000);
    request.onupgradeneeded = () => { if (settled) { request.transaction?.abort(); return; } if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "key" }); };
    request.onblocked = () => fail("Close other app tabs, then try saving this request again.");
    request.onerror = () => fail("Cannot safely save this request on this device.");
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      clearTimeout(timer);
      resolve(request.result);
    };
  });
}

function keyFor(scope: ManagerIntentScope) {
  if (!Number.isSafeInteger(scope.userId) || scope.userId < 1 || !Number.isSafeInteger(scope.farmId) || scope.farmId < 1 || !scope.targetId) throw new Error("Sign in to the correct farm before saving.");
  return JSON.stringify([scope.userId, scope.farmId, scope.kind, scope.targetId]);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);
}

/** Atomically reserve an immutable operation; matching retries use the same UUID. */
export async function prepareManagerIntent<T>(scope: ManagerIntentScope, payload: T, suppliedOperationId?: string): Promise<ManagerIntent<T>> {
  const key = keyFor(scope);
  if (suppliedOperationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(suppliedOperationId)) throw new Error("This request has an invalid operation ID.");
  const db = await openDatabase();
  try {
    const intent = await new Promise<ManagerIntent<T>>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let intent: ManagerIntent<T> | undefined;
      let mismatch = false;
      const request = store.get(key);
      request.onsuccess = () => {
        const existing = request.result as ManagerIntent<T> | undefined;
        if (existing) {
          mismatch = canonical(existing.payload) !== canonical(payload) || Boolean(suppliedOperationId && suppliedOperationId !== existing.operationId);
          intent = existing;
        } else {
          let operationId: string;
          try { operationId = suppliedOperationId ?? newSecureUuid(); } catch { tx.abort(); return; }
          intent = { ...scope, key, operationId, payload, createdAt: new Date().toISOString() };
          store.put(intent);
        }
      };
      tx.oncomplete = () => mismatch ? reject(new Error("A previous request is unresolved. Retry its original details before submitting different details.")) : resolve(intent!);
      tx.onabort = () => reject(new Error("Cannot safely save this request on this device. Check device storage and try again."));
      tx.onerror = () => { /* onabort reports the transaction error */ };
    });
    changed();
    return intent;
  } finally { db.close(); }
}

export async function listManagerIntents<T = unknown>(scope: Pick<ManagerIntentScope, "userId" | "farmId" | "kind">): Promise<ManagerIntent<T>[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as ManagerIntent<T>[]).filter((item) => item.userId === scope.userId && item.farmId === scope.farmId && item.kind === scope.kind).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      request.onerror = () => reject(new Error("Cannot read the saved requests on this device."));
    });
  } finally { db.close(); }
}

export async function readManagerIntent<T = unknown>(scope: ManagerIntentScope): Promise<ManagerIntent<T> | null> {
  const db = await openDatabase();
  try {
    return await new Promise<ManagerIntent<T> | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(keyFor(scope));
      request.onsuccess = () => resolve((request.result as ManagerIntent<T> | undefined) ?? null);
      request.onerror = () => reject(new Error("Cannot read the saved request on this device."));
    });
  } finally { db.close(); }
}

/** Remove only after the matching operation has been acknowledged by the server. */
export async function resolveManagerIntent(scope: ManagerIntentScope, operationId: string): Promise<boolean> {
  const db = await openDatabase();
  try {
    const removed = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let removed = false;
      const key = keyFor(scope);
      const request = store.get(key);
      request.onsuccess = () => { if (request.result?.operationId === operationId) { store.delete(key); removed = true; } };
      tx.oncomplete = () => resolve(removed);
      tx.onabort = () => reject(new Error("Could not update the saved request. Retry with the original details."));
      tx.onerror = () => { /* onabort reports the transaction error */ };
    });
    if (removed) changed();
    return removed;
  } finally { db.close(); }
}
