"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";
import { syncApi } from "./api";
import { qk } from "./query-keys";
import { useAuth } from "./auth-context";
import {
  deleteOutboxOperation,
  commitSyncedSelectionSession,
  getDeviceId,
  getLastSuccessfulSync,
  listOutbox,
  onOfflineOutboxChanged,
  putOutboxOperation,
  setLastSuccessfulSync,
  updateOutboxOperation,
  type OfflineEntityType,
  type OutboxOperation,
  type OutboxStatus,
} from "./offline-db";
import type { SyncOperationsRequest } from "./types";

export type SyncConnection = "OFFLINE" | "CHECKING" | "ONLINE" | "SERVER_UNREACHABLE" | "SYNCING" | "AUTH_REQUIRED";

export interface SyncSnapshot {
  connection: SyncConnection;
  pendingCount: number;
  issueCount: number;
  syncingCount: number;
  items: OutboxOperation[];
  lastSuccessfulSync: string | null;
  storageAvailable: boolean;
}

interface EnqueueInput {
  entityType: OfflineEntityType;
  batchId: number;
  payload: Record<string, unknown>;
  occurredAt: string;
}

interface OfflineSyncContextValue {
  snapshot: SyncSnapshot;
  enqueue: (input: EnqueueInput) => Promise<{ operationId: string }>;
  syncNow: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

function uuid() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function backoff(attemptCount: number) {
  const base = Math.min(120_000, 2_000 * (2 ** Math.min(attemptCount, 6)));
  return base + Math.floor(Math.random() * 1_000);
}

async function serverReachable() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("/api/backend/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function pendingStatuses(status: OutboxStatus[]) {
  return status.includes("PENDING") || status.includes("RETRY_WAIT") || status.includes("SYNCING");
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const runRef = useRef<Promise<void> | null>(null);
  const retryTimer = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<SyncSnapshot>({
    connection: "CHECKING",
    pendingCount: 0,
    issueCount: 0,
    syncingCount: 0,
    items: [],
    lastSuccessfulSync: null,
    storageAvailable: true,
  });

  const refresh = useCallback(async () => {
    if (!user?.farmId) {
      setSnapshot((current) => ({ ...current, connection: isAuthenticated ? "AUTH_REQUIRED" : "OFFLINE", items: [], pendingCount: 0, issueCount: 0 }));
      return [] as OutboxOperation[];
    }
    try {
      const items = await listOutbox(user.userId, user.farmId);
      const pending = items.filter((item) => pendingStatuses([item.status])).length;
      const issues = items.filter((item) => ["CONFLICT", "REJECTED", "AUTH_REQUIRED"].includes(item.status)).length;
      const syncing = items.filter((item) => item.status === "SYNCING").length;
      const lastSuccessfulSync = await getLastSuccessfulSync();
      setSnapshot((current) => ({ ...current, items, pendingCount: pending, issueCount: issues, syncingCount: syncing, lastSuccessfulSync, storageAvailable: true }));
      return items;
    } catch {
      setSnapshot((current) => ({ ...current, storageAvailable: false }));
      return [] as OutboxOperation[];
    }
  }, [isAuthenticated, user]);

  const syncNow = useCallback(async () => {
    if (runRef.current) return runRef.current;
    const run = (async () => {
      if (isLoading) return;
      if (!isAuthenticated || !user?.farmId) {
        await refresh();
        return;
      }
      if (!navigator.onLine) {
        setSnapshot((current) => ({ ...current, connection: "OFFLINE" }));
        await refresh();
        return;
      }
      setSnapshot((current) => ({ ...current, connection: "CHECKING" }));
      if (!(await serverReachable())) {
        setSnapshot((current) => ({ ...current, connection: "SERVER_UNREACHABLE" }));
        await refresh();
        return;
      }

      const blockedBatches = new Set<number>();
      let items = await refresh();
      const eligible = () => items.filter((item) =>
        (item.status === "PENDING" || (item.status === "RETRY_WAIT" && (!item.nextAttemptAt || item.nextAttemptAt <= new Date().toISOString())))
        && !blockedBatches.has(item.batchId));

      while (eligible().length > 0) {
        const selectedByBatch = new Map<number, OutboxOperation>();
        for (const item of eligible()) {
          if (!selectedByBatch.has(item.batchId)) selectedByBatch.set(item.batchId, item);
          if (selectedByBatch.size >= 25) break;
        }
        const selected = [...selectedByBatch.values()].sort((a, b) => a.sequence - b.sequence);
        if (selected.length === 0) break;
        setSnapshot((current) => ({ ...current, connection: "SYNCING", syncingCount: selected.length }));
        await Promise.all(selected.map((item) => updateOutboxOperation(item.operationId, {
          status: "SYNCING",
          lastAttemptAt: new Date().toISOString(),
        })));

        const body: SyncOperationsRequest = {
          deviceId: await getDeviceId(),
          operations: selected.map((item) => ({
            operationId: item.operationId,
            schemaVersion: item.schemaVersion,
            entityType: item.entityType,
            batchId: item.batchId,
            occurredAt: item.occurredAt,
            payload: item.payload,
          })),
        };
        try {
          const response = await syncApi.operations(body);
          for (const result of response.results) {
            const item = selected.find((candidate) => candidate.operationId === result.operationId);
            if (!item) continue;
            if (result.status === "APPLIED" || result.status === "ALREADY_APPLIED") {
              if (result.serverId != null) {
                try { await commitSyncedSelectionSession(item, result.serverId, result.serverTime); } catch { /* A server acknowledgement must not be retried because local snapshots are full. */ }
              }
              await deleteOutboxOperation(item.operationId);
              queryClient.invalidateQueries({ queryKey: qk.batches.all });
              queryClient.invalidateQueries({ queryKey: qk.inputs });
              queryClient.invalidateQueries({ queryKey: qk.alertsFarmRoot });
              if (item.entityType === "SEX_COMPOSITION") {
                queryClient.invalidateQueries({ queryKey: qk.batches.sexComposition(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.detail(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviews(item.batchId) });
              }
              if (item.entityType === "FARM_INPUT" || item.entityType === "VACCINATION_PLAN") {
                queryClient.invalidateQueries({ queryKey: qk.inventory });
                queryClient.invalidateQueries({ queryKey: qk.inventoryPending });
                queryClient.invalidateQueries({ queryKey: qk.finance });
                queryClient.invalidateQueries({ queryKey: qk.operationsAnalytics() });
                queryClient.invalidateQueries({ queryKey: qk.batches.detail(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.dashboard() });
                queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviews(item.batchId) });
              }
              queryClient.invalidateQueries({ queryKey: qk.tasks });
              queryClient.invalidateQueries({ queryKey: qk.vaccinationPrograms });
            } else if (result.status === "AUTH_REQUIRED") {
              await updateOutboxOperation(item.operationId, { status: "AUTH_REQUIRED", lastErrorMessage: result.message ?? "Sign in to sync this record." });
              blockedBatches.add(item.batchId);
            } else if (result.status === "CONFLICT") {
              await updateOutboxOperation(item.operationId, { status: "CONFLICT", lastErrorCode: result.status, lastErrorMessage: result.message ?? "Review this record before syncing." });
              blockedBatches.add(item.batchId);
            } else if (result.status === "REJECTED") {
              await updateOutboxOperation(item.operationId, { status: "REJECTED", lastErrorCode: result.status, lastErrorMessage: result.message ?? "This record needs review." });
              blockedBatches.add(item.batchId);
            } else {
              await updateOutboxOperation(item.operationId, { status: "RETRY_WAIT", attemptCount: item.attemptCount + 1, nextAttemptAt: new Date(Date.now() + backoff(item.attemptCount)).toISOString(), lastErrorCode: result.status, lastErrorMessage: result.message ?? "The server will be tried again." });
            }
          }
          await setLastSuccessfulSync(new Date().toISOString());
          items = await refresh();
        } catch (error) {
          const isAuth = error instanceof ApiError && error.status === 401;
          await Promise.all(selected.map((item) => updateOutboxOperation(item.operationId, {
            status: isAuth ? "AUTH_REQUIRED" : "RETRY_WAIT",
            attemptCount: item.attemptCount + 1,
            nextAttemptAt: isAuth ? undefined : new Date(Date.now() + backoff(item.attemptCount)).toISOString(),
            lastErrorCode: isAuth ? "401" : "NETWORK",
            lastErrorMessage: isAuth ? "Sign in again to sync this record." : "Server not reachable; it will retry automatically.",
          })));
          setSnapshot((current) => ({ ...current, connection: isAuth ? "AUTH_REQUIRED" : "SERVER_UNREACHABLE" }));
          items = await refresh();
          break;
        }
      }
      const finalItems = await refresh();
      setSnapshot((current) => ({ ...current, connection: finalItems.some((item) => item.status === "AUTH_REQUIRED") ? "AUTH_REQUIRED" : navigator.onLine ? "ONLINE" : "OFFLINE", syncingCount: 0 }));
    })();
    runRef.current = run;
    try { await run; } finally { runRef.current = null; }
  }, [isAuthenticated, isLoading, queryClient, refresh, user]);

  const scheduleSync = useCallback((delay = 250) => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => { void syncNow(); }, delay);
  }, [syncNow]);

  const enqueue = useCallback(async ({ entityType, batchId, payload, occurredAt }: EnqueueInput) => {
    if (!user?.farmId || !isAuthenticated) throw new Error("Sign in before saving a farm record.");
    const operationId = typeof payload.operationId === "string" ? payload.operationId : uuid();
    await putOutboxOperation({
      operationId,
      schemaVersion: 1,
      entityType,
      userId: user.userId,
      farmId: user.farmId,
      batchId,
      payload: { ...payload, operationId },
      occurredAt,
      queuedAt: new Date().toISOString(),
    });
    await refresh();
    scheduleSync();
    return { operationId };
  }, [isAuthenticated, refresh, scheduleSync, user]);

  useEffect(() => {
    if (isLoading) return;
    const initialise = window.setTimeout(() => { void refresh(); void syncNow(); }, 0);
    const onOnline = () => scheduleSync(100);
    const onFocus = () => scheduleSync(100);
    const onVisibility = () => { if (document.visibilityState === "visible") scheduleSync(100); };
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const stopListening = onOfflineOutboxChanged(() => { void refresh(); });
    return () => {
      window.clearTimeout(initialise);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      stopListening();
    };
  }, [isLoading, refresh, scheduleSync, syncNow]);

  const value = useMemo(() => ({ snapshot, enqueue, syncNow }), [enqueue, snapshot, syncNow]);
  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error("useOfflineSync must be used inside OfflineSyncProvider");
  return context;
}
