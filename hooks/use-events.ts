"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchEventApi } from "@/lib/api";
import { shouldUseOfflineSnapshot } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { qk } from "@/lib/query-keys";
import type { BatchEvent, CreateBatchEventRequest, EventType } from "@/lib/types";
import { getBatchEventSnapshot, listOutbox, saveBatchEventSnapshot } from "@/lib/offline-db";

const eventTypes: EventType[] = [
  "MORTALITY", "HEALTH_DEATH", "ACCIDENTAL_DEATH", "SUSPECTED_PREDATION", "CONFIRMED_PREDATION",
  "MISSING", "FOUND_RETURNED", "TRANSFER_OUT", "TRANSFER_IN", "SALE", "CULLING", "COUNT_CORRECTION",
  "HEALTH_CONCERN", "VACCINE_MEDICINE", "BEHAVIOR_OBSERVATION",
];

function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && eventTypes.includes(value as EventType);
}

function toQueuedEvent(operation: Awaited<ReturnType<typeof listOutbox>>[number], batchId: number, user: NonNullable<ReturnType<typeof useAuth>["user"]>): BatchEvent | null {
  const payload = operation.payload;
  if (operation.entityType !== "BATCH_EVENT" || operation.batchId !== batchId || !isEventType(payload.eventType)) return null;
  const eventType = payload.eventType;
  const eventDate = typeof payload.eventDate === "string" ? payload.eventDate : operation.occurredAt.slice(0, 10);
  return {
    id: -operation.sequence,
    batchId,
    handlerId: user.userId,
    handlerName: user.fullName,
    eventDate,
    eventType,
    severityLabel: typeof payload.severityLabel === "string" ? payload.severityLabel : null,
    affectedCount: typeof payload.affectedCount === "number" ? payload.affectedCount : 0,
    title: typeof payload.title === "string" ? payload.title : eventType.replaceAll("_", " ").toLowerCase(),
    details: typeof payload.details === "string" ? payload.details : null,
    tags: typeof payload.tags === "string" ? payload.tags : null,
    createdAt: operation.queuedAt,
    operationId: operation.operationId,
    populationDelta: typeof payload.populationDelta === "number" ? payload.populationDelta : null,
    syncStatus: operation.status,
  };
}

async function getQueuedEvents(batchId: number, user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  if (!user.farmId) return [];
  const operations = await listOutbox(user.userId, user.farmId);
  return operations.map((operation) => toQueuedEvent(operation, batchId, user)).filter((event): event is BatchEvent => event !== null);
}

function mergeEvents(events: BatchEvent[], queued: BatchEvent[], limit: number) {
  const operationIds = new Set(events.map((event) => event.operationId).filter((id): id is string => Boolean(id)));
  return [...events, ...queued.filter((event) => !event.operationId || !operationIds.has(event.operationId))]
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function useBatchEvents(batchId: number | string, limit = 30, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.batches.events(batchId, limit),
    queryFn: async () => {
      try {
        const events = await batchEventApi.recent(batchId, limit);
        if (user?.farmId) {
          try { await saveBatchEventSnapshot(user.userId, user.farmId, Number(batchId), events); } catch { /* Keep online reads available if local storage is full. */ }
        }
        if (user) {
          try { return mergeEvents(events, await getQueuedEvents(Number(batchId), user), limit); } catch { /* The server history remains available if local storage cannot be read. */ }
        }
        return events;
      } catch (error) {
        if (!shouldUseOfflineSnapshot(error) || !user?.farmId) throw error;
        try {
          const cached = await getBatchEventSnapshot(user.userId, user.farmId, Number(batchId));
          const queued = await getQueuedEvents(Number(batchId), user);
          if (cached || queued.length > 0) return mergeEvents(cached ?? [], queued, limit);
        } catch { /* Preserve the API error if local storage is unavailable. */ }
        throw error;
      }
    },
    enabled: enabled && batchId != null && batchId !== "",
  });
}

export function useCreateEvent(batchId: number | string) {
  const queryClient = useQueryClient();
  const { enqueue } = useOfflineSync();
  return useMutation({
    mutationFn: async (body: CreateBatchEventRequest) => {
      const operationId = body.operationId ?? crypto.randomUUID();
      await enqueue({
        entityType: "BATCH_EVENT",
        batchId: Number(batchId),
        occurredAt: `${body.eventDate ?? new Date().toISOString().slice(0, 10)}T12:00:00.000Z`,
        payload: { ...body, operationId },
      });
      return { operationId };
    },
    onSuccess: () => {
      // Mortality changes the batch list and all batch-scoped derived data, plus the
      // manager's farm-wide notification feed.
      queryClient.invalidateQueries({ queryKey: qk.batches.all });
      queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
      queryClient.invalidateQueries({ queryKey: qk.alertsFarmRoot });
    },
  });
}
