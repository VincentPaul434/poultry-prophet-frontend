"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";
import { offlineApi, syncApi } from "./api";
import { qk } from "./query-keys";
import { useAuth } from "./auth-context";
import { isAuthRequired } from "./auth-storage";
import {
  claimOutboxOperations,
  commitSyncedSelectionSession,
  getDeviceId,
  getLastSuccessfulSync,
  saveBatchEventSnapshot,
  saveBatchOverviewSnapshot,
  saveBatchSnapshots,
  saveDashboardSnapshot,
  saveFarmProductSnapshots,
  saveOfflineBootstrap,
  listOutbox,
  onOfflineOutboxChanged,
  putOutboxOperation,
  retryOutboxIssues,
  renewOutboxClaims,
  setLastSuccessfulSync,
  updateClaimedOutboxOperation,
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
  retryIssues: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);
const LEASE_MS = 60_000;

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
  const { user, isAuthenticated, isLoading, authRequired } = useAuth();
  const queryClient = useQueryClient();
  const runRef = useRef<Promise<void> | null>(null);
  const retryTimer = useRef<number | null>(null);
  const bootstrapAtRef = useRef(0);
  const scopeRef = useRef<string | null>(null);
  const syncRef = useRef<() => Promise<void>>(async () => undefined);
  const currentScope = isAuthenticated && user?.farmId ? `${user.userId}:${user.farmId}` : null;
  useLayoutEffect(() => { scopeRef.current = currentScope; bootstrapAtRef.current = 0; }, [currentScope]);
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
      setSnapshot((current) => ({ ...current, connection: isAuthenticated ? "AUTH_REQUIRED" : "OFFLINE", items: [], pendingCount: 0, issueCount: 0, syncingCount: 0 }));
      return [] as OutboxOperation[];
    }
    try {
      const scope = `${user.userId}:${user.farmId}`;
      const items = await listOutbox(user.userId, user.farmId);
      const pending = items.filter((item) => pendingStatuses([item.status])).length;
      const issues = items.filter((item) => ["CONFLICT", "REJECTED", "AUTH_REQUIRED"].includes(item.status)).length;
      const syncing = items.filter((item) => item.status === "SYNCING").length;
      const lastSuccessfulSync = await getLastSuccessfulSync();
      if (scopeRef.current !== scope) return [];
      setSnapshot((current) => ({ ...current, items, pendingCount: pending, issueCount: issues, syncingCount: syncing, lastSuccessfulSync, storageAvailable: true }));
      return items;
    } catch {
      setSnapshot((current) => ({ ...current, storageAvailable: false }));
      return [] as OutboxOperation[];
    }
  }, [isAuthenticated, user]);

  const hydrateOfflineBootstrap = useCallback(async () => {
    if (!user?.farmId || !isAuthenticated) return;
    try {
      const farmId = user.farmId;
      const data = await offlineApi.bootstrap();
      if (scopeRef.current !== `${user.userId}:${farmId}`) return;
      await saveOfflineBootstrap(user.userId, farmId, data);
      await Promise.all([
        saveBatchSnapshots(user.userId, farmId, data.batches),
        saveDashboardSnapshot(user.userId, farmId, data.dashboard),
        saveFarmProductSnapshots(user.userId, farmId, data.products),
        ...(data.events ? Object.entries(data.events).map(([batchId, events]) =>
          saveBatchEventSnapshot(user.userId, farmId, Number(batchId), events)) : []),
        ...(data.overviews ? Object.entries(data.overviews).map(([, overview]) =>
          saveBatchOverviewSnapshot(user.userId, farmId, overview)) : []),
      ]);
    } catch (error) {
      // A bootstrap failure must not discard the previous working set. The
      // outbox can still replay independently when the server is reachable.
      if (error instanceof ApiError && error.status === 401) {
        setSnapshot((current) => ({ ...current, connection: "AUTH_REQUIRED" }));
      }
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
      if (authRequired || isAuthRequired()) {
        await refresh();
        setSnapshot((current) => ({ ...current, connection: "AUTH_REQUIRED", syncingCount: 0 }));
        return;
      }
      const scope = `${user.userId}:${user.farmId}`;
      setSnapshot((current) => ({ ...current, connection: "CHECKING" }));
      const reachable = await serverReachable();
      if (scopeRef.current !== scope) return;
      if (!reachable) {
        setSnapshot((current) => ({ ...current, connection: navigator.onLine ? "SERVER_UNREACHABLE" : "OFFLINE" }));
        await refresh();
        return;
      }
      if (scopeRef.current !== scope) return;
      if (Date.now() - bootstrapAtRef.current > 5 * 60_000) {
        await hydrateOfflineBootstrap();
        bootstrapAtRef.current = Date.now();
      }

      if (isAuthRequired()) {
        await refresh();
        setSnapshot((current) => ({ ...current, connection: "AUTH_REQUIRED", syncingCount: 0 }));
        return;
      }

      let failureConnection: SyncConnection | null = null;
      while (scopeRef.current === scope && !isAuthRequired()) {
        const owner = uuid();
        const selected = await claimOutboxOperations(user.userId, user.farmId, owner, Date.now(), LEASE_MS);
        if (selected.length === 0) break;
        setSnapshot((current) => ({ ...current, connection: "SYNCING", syncingCount: selected.length }));
        const renewal = window.setInterval(() => {
          void renewOutboxClaims(selected.map((item) => item.operationId), owner, Date.now() + LEASE_MS).catch(() => undefined);
        }, LEASE_MS / 3);

        try {
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
          if (scopeRef.current !== scope) break;
          const response = await syncApi.operations(body);
          for (const item of selected) {
            const result = response.results.find((candidate) => candidate.operationId === item.operationId);
            if (!result) {
              await updateClaimedOutboxOperation(item.operationId, owner, { status: "RETRY_WAIT", attemptCount: item.attemptCount + 1, nextAttemptAt: new Date(Date.now() + backoff(item.attemptCount)).toISOString(), lastErrorCode: "MISSING_RESULT", lastErrorMessage: "The server did not acknowledge this record; it will retry automatically.", leaseOwner: undefined, leaseUntil: undefined });
              continue;
            }
            if (item.entityType === "DAILY_RECORD" && (result.status === "APPLIED" || result.status === "ALREADY_APPLIED")
              && (result.serverId == null || !Number.isSafeInteger(result.serverId) || result.serverId <= 0)) {
              await updateClaimedOutboxOperation(item.operationId, owner, { status: "RETRY_WAIT", attemptCount: item.attemptCount + 1, nextAttemptAt: new Date(Date.now() + backoff(item.attemptCount)).toISOString(), lastErrorCode: "MISSING_RECORD_ID", lastErrorMessage: "The server acknowledgement was incomplete; this measurement will retry.", leaseOwner: undefined, leaseUntil: undefined });
              continue;
            }
            if (result.status === "APPLIED" || result.status === "ALREADY_APPLIED") {
              if (result.serverId != null) {
                try { await commitSyncedSelectionSession(item, result.serverId, result.serverTime); } catch { /* A server acknowledgement must not be retried because local snapshots are full. */ }
              }
              if (!await updateClaimedOutboxOperation(item.operationId, owner, null)) continue;
              queryClient.invalidateQueries({ queryKey: qk.batches.all });
              queryClient.invalidateQueries({ queryKey: qk.inputs });
              queryClient.invalidateQueries({ queryKey: qk.alertsFarmRoot });
              queryClient.invalidateQueries({ queryKey: qk.alertsFarmSummary });
              if (item.entityType === "DAILY_RECORD") {
                queryClient.invalidateQueries({ queryKey: qk.batches.detail(item.batchId) });
              }
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
              if (item.entityType === "BATCH_EVENT") {
                queryClient.invalidateQueries({ queryKey: qk.finance });
                queryClient.invalidateQueries({ queryKey: qk.financeAnalytics(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.operationsAnalytics() });
                queryClient.invalidateQueries({ queryKey: qk.batches.detail(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.events(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreview(item.batchId) });
                queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviews(item.batchId) });
              }
              queryClient.invalidateQueries({ queryKey: qk.tasks });
              queryClient.invalidateQueries({ queryKey: qk.vaccinationPrograms });
            } else if (result.status === "AUTH_REQUIRED") {
              await updateClaimedOutboxOperation(item.operationId, owner, { status: "AUTH_REQUIRED", lastErrorMessage: result.message ?? "Sign in to sync this record.", leaseOwner: undefined, leaseUntil: undefined });
            } else if (result.status === "CONFLICT") {
              await updateClaimedOutboxOperation(item.operationId, owner, { status: "CONFLICT", lastErrorCode: result.status, lastErrorMessage: result.message ?? "Review this record before syncing.", leaseOwner: undefined, leaseUntil: undefined });
            } else if (result.status === "REJECTED") {
              await updateClaimedOutboxOperation(item.operationId, owner, { status: "REJECTED", lastErrorCode: result.status, lastErrorMessage: result.message ?? "This record needs review.", leaseOwner: undefined, leaseUntil: undefined });
            } else {
              await updateClaimedOutboxOperation(item.operationId, owner, { status: "RETRY_WAIT", attemptCount: item.attemptCount + 1, nextAttemptAt: new Date(Date.now() + backoff(item.attemptCount)).toISOString(), lastErrorCode: result.status, lastErrorMessage: result.message ?? "The server will be tried again.", leaseOwner: undefined, leaseUntil: undefined });
            }
          }
          await setLastSuccessfulSync(new Date().toISOString());
          await refresh();
        } catch (error) {
          const isAuth = error instanceof ApiError && error.status === 401;
          failureConnection = isAuth ? "AUTH_REQUIRED" : "SERVER_UNREACHABLE";
          await Promise.all(selected.map((item) => updateClaimedOutboxOperation(item.operationId, owner, {
            status: isAuth ? "AUTH_REQUIRED" : "RETRY_WAIT",
            attemptCount: item.attemptCount + 1,
            nextAttemptAt: isAuth ? undefined : new Date(Date.now() + backoff(item.attemptCount)).toISOString(),
            lastErrorCode: isAuth ? "401" : "NETWORK",
            lastErrorMessage: isAuth ? "Sign in again to sync this record." : "Server not reachable; it will retry automatically.",
            leaseOwner: undefined,
            leaseUntil: undefined,
          })));
          setSnapshot((current) => ({ ...current, connection: isAuth ? "AUTH_REQUIRED" : "SERVER_UNREACHABLE" }));
          await refresh();
          break;
        } finally {
          window.clearInterval(renewal);
        }
      }
      if (scopeRef.current !== scope) return;
      const finalItems = await refresh();
      setSnapshot((current) => ({ ...current, connection: isAuthRequired() || finalItems.some((item) => item.status === "AUTH_REQUIRED") ? "AUTH_REQUIRED" : failureConnection ?? (navigator.onLine ? "ONLINE" : "OFFLINE"), syncingCount: 0 }));
    })();
    runRef.current = run;
    try { await run; } finally {
      runRef.current = null;
      if (scopeRef.current !== currentScope && scopeRef.current) window.setTimeout(() => { void syncRef.current(); }, 0);
    }
  }, [authRequired, currentScope, hydrateOfflineBootstrap, isAuthenticated, isLoading, queryClient, refresh, user]);
  useLayoutEffect(() => { syncRef.current = syncNow; }, [syncNow]);

  // Reauthentication only releases records for the active user and farm.
  useEffect(() => {
    if (isLoading || authRequired || isAuthRequired() || !currentScope || !user?.farmId) return;
    let active = true;
    void retryOutboxIssues(user.userId, user.farmId).then(() => {
      if (active) void syncNow();
    }).catch(() => { if (active) void refresh(); });
    return () => { active = false; };
  // The scope transition, rather than a refresh of the user object, is the trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authRequired, currentScope, isLoading, user]);

  useEffect(() => {
    if (authRequired || !currentScope || !navigator.onLine || !snapshot.items.length) return;
    const heads = new Map<number, OutboxOperation>();
    for (const item of snapshot.items) if (!heads.has(item.batchId)) heads.set(item.batchId, item);
    const times = [...heads.values()].flatMap((item) => {
      if (item.status === "PENDING") return [Date.now()];
      if (item.status === "RETRY_WAIT") return [Date.parse(item.nextAttemptAt ?? "") || Date.now()];
      if (item.status === "SYNCING") return [item.leaseUntil ?? Date.now()];
      return [];
    });
    if (!times.length) return;
    const minimumDelay = snapshot.connection === "SERVER_UNREACHABLE" ? 30_000 : 250;
    const timer = window.setTimeout(() => { void syncNow(); }, Math.max(minimumDelay, Math.min(...times) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [authRequired, currentScope, snapshot.connection, snapshot.items, syncNow]);

  const scheduleSync = useCallback((delay = 250) => {
    if (retryTimer.current) window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => { void syncNow(); }, delay);
  }, [syncNow]);

  const retryIssues = useCallback(async () => {
    if (!user?.farmId || !isAuthenticated || authRequired || isAuthRequired()) return;
    await retryOutboxIssues(user.userId, user.farmId);
    await refresh();
    await syncNow();
  }, [authRequired, isAuthenticated, refresh, syncNow, user]);

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
      payload: entityType === "DAILY_RECORD"
        ? { ...payload, operationId, ownerUserId: user.userId, ownerFarmId: user.farmId }
        : { ...payload, operationId },
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

  const value = useMemo(() => ({ snapshot, enqueue, syncNow, retryIssues }), [enqueue, retryIssues, snapshot, syncNow]);
  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error("useOfflineSync must be used inside OfflineSyncProvider");
  return context;
}
