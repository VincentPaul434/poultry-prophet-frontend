import type { OutboxOperation } from "./offline-db";

const populationTypes = new Set([
  "MORTALITY", "HEALTH_DEATH", "ACCIDENTAL_DEATH", "SUSPECTED_PREDATION", "CONFIRMED_PREDATION",
  "MISSING", "FOUND_RETURNED", "TRANSFER_OUT", "TRANSFER_IN", "SALE", "CULLING", "COUNT_CORRECTION",
]);

/** Pending work is disclosed separately: a lost acknowledgement may already be in server totals. */
export function pendingPopulation(items: OutboxOperation[], userId: number, farmId: number, batchId: number) {
  let pendingRecords = 0, deaths = 0, issues = 0;
  const seen = new Set<string>();
  for (const item of items) {
    if (item.userId !== userId || item.farmId !== farmId || item.batchId !== batchId
      || item.entityType !== "BATCH_EVENT" || !populationTypes.has(String(item.payload.eventType)) || seen.has(item.operationId)) continue;
    seen.add(item.operationId);
    if (item.status === "CONFLICT" || item.status === "REJECTED") { issues++; continue; }
    pendingRecords++;
    if (["MORTALITY", "HEALTH_DEATH", "ACCIDENTAL_DEATH"].includes(String(item.payload.eventType))) {
      const count = item.payload.affectedCount;
      if (typeof count === "number" && Number.isSafeInteger(count) && count > 0) deaths += count;
    }
  }
  return { pendingRecords, deaths, issues };
}
