"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { selectionSessionApi } from "@/lib/api";
import { shouldUseOfflineSnapshot } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import {
  getSelectionSessionSnapshot,
  listOutbox,
  onOfflineOutboxChanged,
  saveSelectionSessionSnapshot,
  type OutboxOperation,
} from "@/lib/offline-db";
import { qk } from "@/lib/query-keys";
import type { CreateSelectionSessionRequest, SelectionSession } from "@/lib/types";

function toLocalDraft(body: CreateSelectionSessionRequest, batchId: number, farmId: number, userId: number): SelectionSession {
  const evaluatedCount = body.evaluatedCount;
  const acceptedCount = body.acceptedCount;
  const now = new Date().toISOString();
  return {
    id: -Date.now(),
    farmId,
    batchId,
    selectionDate: body.selectionDate ?? now.slice(0, 10),
    reviewerId: userId,
    evaluatedCount,
    acceptedCount,
    continueObservationCount: body.continueObservationCount,
    notAcceptedCount: body.notAcceptedCount,
    otherCount: body.otherCount,
    selectionRatePercent: evaluatedCount > 0 ? Math.round((acceptedCount / evaluatedCount) * 10000) / 100 : null,
    selectionRateNumerator: acceptedCount,
    selectionRateDenominator: evaluatedCount,
    status: "DRAFT",
    criterionCodes: body.criterionCodes,
    criteriaNotes: body.criteriaNotes ?? null,
    sessionNotes: body.sessionNotes ?? null,
    operationId: body.operationId,
    supersedesSessionId: null,
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
    offlineSyncStatus: "PENDING",
  };
}

function applyQueuedOperations(
  base: SelectionSession[],
  operations: OutboxOperation[],
  batchId: number,
  userId: number,
) {
  const sessions = new Map(base.map((session) => [session.id, session]));
  const serverOperationIds = new Set(base.map((session) => session.operationId).filter((id): id is string => Boolean(id)));

  for (const operation of operations) {
    if (operation.batchId !== batchId) continue;
    const payload = operation.payload;
    if (operation.entityType === "SELECTION_SESSION") {
      if (serverOperationIds.has(operation.operationId)) continue;
      const evaluatedCount = typeof payload.evaluatedCount === "number" ? payload.evaluatedCount : 1;
      const acceptedCount = typeof payload.acceptedCount === "number" ? payload.acceptedCount : 0;
      const selectionDate = typeof payload.selectionDate === "string" ? payload.selectionDate : operation.occurredAt.slice(0, 10);
      const local: SelectionSession = {
        id: -operation.sequence,
        farmId: operation.farmId,
        batchId,
        selectionDate,
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
        createdAt: operation.queuedAt,
        updatedAt: operation.queuedAt,
        finalizedAt: null,
        offlineSyncStatus: operation.status,
      };
      sessions.set(local.id, local);
      continue;
    }

    if (operation.entityType !== "SELECTION_SESSION_UPDATE") continue;
    const sessionId = typeof payload.sessionId === "number" ? payload.sessionId : null;
    const existing = sessionId == null ? undefined : sessions.get(sessionId);
    if (!existing || existing.status !== "DRAFT") continue;
    const evaluatedCount = typeof payload.evaluatedCount === "number" ? payload.evaluatedCount : existing.evaluatedCount;
    const acceptedCount = typeof payload.acceptedCount === "number" ? payload.acceptedCount : existing.acceptedCount;
    sessions.set(sessionId!, {
      ...existing,
      selectionDate: typeof payload.selectionDate === "string" ? payload.selectionDate : existing.selectionDate,
      evaluatedCount,
      acceptedCount,
      continueObservationCount: typeof payload.continueObservationCount === "number" ? payload.continueObservationCount : existing.continueObservationCount,
      notAcceptedCount: typeof payload.notAcceptedCount === "number" ? payload.notAcceptedCount : existing.notAcceptedCount,
      otherCount: typeof payload.otherCount === "number" ? payload.otherCount : existing.otherCount,
      selectionRatePercent: evaluatedCount > 0 ? Math.round((acceptedCount / evaluatedCount) * 1000) / 10 : null,
      selectionRateNumerator: acceptedCount,
      selectionRateDenominator: evaluatedCount,
      criterionCodes: Array.isArray(payload.criterionCodes) ? payload.criterionCodes.filter((item): item is string => typeof item === "string") : existing.criterionCodes,
      criteriaNotes: typeof payload.criteriaNotes === "string" ? payload.criteriaNotes : null,
      sessionNotes: typeof payload.sessionNotes === "string" ? payload.sessionNotes : null,
      updatedAt: operation.queuedAt,
      offlineSyncStatus: operation.status,
    });
  }

  return [...sessions.values()]
    .sort((a, b) => b.selectionDate.localeCompare(a.selectionDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
}

async function getQueuedSelectionSessions(batchId: number, userId: number, farmId: number) {
  const operations = await listOutbox(userId, farmId);
  return operations.filter((operation) =>
    operation.batchId === batchId
    && (operation.entityType === "SELECTION_SESSION" || operation.entityType === "SELECTION_SESSION_UPDATE"));
}

export function useSelectionSessions(batchId: number | string, enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => onOfflineOutboxChanged(() => {
    void queryClient.invalidateQueries({ queryKey: qk.batches.selectionSessions(batchId) });
  }), [batchId, queryClient]);
  return useQuery<SelectionSession[]>({
    queryKey: qk.batches.selectionSessions(batchId),
    queryFn: async () => {
      const numericBatchId = Number(batchId);
      try {
        const remote = await selectionSessionApi.list(batchId);
        if (user?.farmId) {
          try { await saveSelectionSessionSnapshot(user.userId, user.farmId, numericBatchId, remote); } catch { /* Keep the online read if local storage is full. */ }
          try {
            const queued = await getQueuedSelectionSessions(numericBatchId, user.userId, user.farmId);
            return applyQueuedOperations(remote, queued, numericBatchId, user.userId);
          } catch { /* The server history remains available if local storage cannot be read. */ }
        }
        return remote;
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        try {
          const [cached, queued] = await Promise.all([
            getSelectionSessionSnapshot(user.userId, user.farmId, numericBatchId),
            getQueuedSelectionSessions(numericBatchId, user.userId, user.farmId),
          ]);
          if (cached !== null || queued.length > 0) {
            return applyQueuedOperations(cached ?? [], queued, numericBatchId, user.userId);
          }
        } catch { /* Preserve the API error if local storage is unavailable. */ }
        throw error;
      }
    },
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 30_000,
  });
}

function occurredAt(body: CreateSelectionSessionRequest) {
  return (body.selectionDate ?? new Date().toISOString().slice(0, 10)) + "T12:00:00.000Z";
}

export function useCreateSelectionSession(batchId: number | string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async (body: CreateSelectionSessionRequest) => {
      if (!user?.farmId) throw new Error("Sign in to save this selection draft.");
      if (navigator.onLine) {
        try {
          return await selectionSessionApi.create(batchId, body);
        } catch (error) {
          if (!shouldUseOfflineSnapshot(error)) throw error;
        }
      }
      await enqueue({
        entityType: "SELECTION_SESSION",
        batchId: Number(batchId),
        occurredAt: occurredAt(body),
        payload: body as unknown as Record<string, unknown>,
      });
      return toLocalDraft(body, Number(batchId), user.farmId, user.userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionSessions(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreviewRoot(batchId) });
    },
  });
}

export function useUpdateSelectionSession(batchId: number | string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async ({ sessionId, body }: { sessionId: number; body: CreateSelectionSessionRequest }) => {
      if (!user?.farmId) throw new Error("Sign in to save this selection draft.");
      let targetSessionId = sessionId;
      if (targetSessionId < 0) {
        let syncedDraft = queryClient.getQueryData<SelectionSession[]>(qk.batches.selectionSessions(batchId))
          ?.find((session) => session.id > 0 && session.operationId === body.operationId);
        if (!syncedDraft) {
          try {
            const snapshot = await getSelectionSessionSnapshot(user.userId, user.farmId, Number(batchId));
            syncedDraft = snapshot?.find((session) => session.id > 0 && session.operationId === body.operationId);
          } catch { /* The outbox can still keep a not-yet-synced draft. */ }
        }
        if (syncedDraft) {
          targetSessionId = syncedDraft.id;
        } else {
        await enqueue({
          entityType: "SELECTION_SESSION",
          batchId: Number(batchId),
          occurredAt: occurredAt(body),
          payload: body as unknown as Record<string, unknown>,
        });
        return toLocalDraft(body, Number(batchId), user.farmId, user.userId);
        }
      }

      if (navigator.onLine) {
        try {
          return await selectionSessionApi.update(batchId, targetSessionId, body);
        } catch (error) {
          if (!shouldUseOfflineSnapshot(error)) throw error;
        }
      }
      await enqueue({
        entityType: "SELECTION_SESSION_UPDATE",
        batchId: Number(batchId),
        occurredAt: occurredAt(body),
        payload: { ...body, sessionId: targetSessionId },
      });
      const cached = queryClient.getQueryData<SelectionSession[]>(qk.batches.selectionSessions(batchId));
      const existing = cached?.find((session) => session.id === targetSessionId);
      return existing ? {
        ...existing,
        selectionDate: body.selectionDate ?? existing.selectionDate,
        evaluatedCount: body.evaluatedCount,
        acceptedCount: body.acceptedCount,
        continueObservationCount: body.continueObservationCount,
        notAcceptedCount: body.notAcceptedCount,
        otherCount: body.otherCount,
      selectionRatePercent: body.evaluatedCount > 0 ? Math.round((body.acceptedCount / body.evaluatedCount) * 10000) / 100 : null,
        selectionRateNumerator: body.acceptedCount,
        selectionRateDenominator: body.evaluatedCount,
        criterionCodes: body.criterionCodes,
        criteriaNotes: body.criteriaNotes ?? null,
        sessionNotes: body.sessionNotes ?? null,
        offlineSyncStatus: "PENDING" as const,
      } : toLocalDraft(body, Number(batchId), user.farmId, user.userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionSessions(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreviewRoot(batchId) });
    },
  });
}

export function useFinalizeSelectionSession(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => selectionSessionApi.finalize(batchId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionSessions(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.batches.selectionReviewPreviewRoot(batchId) });
    },
  });
}
