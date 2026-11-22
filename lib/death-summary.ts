import { batchEventApi } from "@/lib/api";
import type { BatchEvent } from "@/lib/types";

export type DeathEventType = "HEALTH_DEATH" | "ACCIDENTAL_DEATH";

type DeathNoteSource = {
  eventType: string;
  title: string;
  details: string | null;
  tags?: string | null;
};

const DEATH_TYPES: readonly DeathEventType[] = ["HEALTH_DEATH", "ACCIDENTAL_DEATH"];
const PAGE_SIZE = 100;
// An explicit failure is safer than silently presenting a truncated history.
const MAX_PAGES_PER_TYPE = 10000;

/** Fetch both death categories for the report's complete population period. */
export async function fetchDeathEvents(batchId: number | string, start: string, end: string): Promise<BatchEvent[]> {
  const groups = await Promise.all(DEATH_TYPES.map(async (type) => {
    const events: BatchEvent[] = [];
    const seen = new Set<number>();

    for (let page = 0; page < MAX_PAGES_PER_TYPE; page += 1) {
      const result = await batchEventApi.page(batchId, { start, end, type, page, size: PAGE_SIZE });
      if (!Array.isArray(result.items) || result.page !== page || typeof result.hasNext !== "boolean") {
        throw new Error("Death records could not be loaded completely.");
      }
      if (result.hasNext && result.items.length === 0) {
        throw new Error("Death records could not be loaded completely.");
      }
      for (const item of result.items) {
        if (item.eventType !== type || seen.has(item.id)) {
          throw new Error("Death records changed while loading. Please try again.");
        }
        seen.add(item.id);
        events.push(item);
      }
      if (!result.hasNext) return events;
    }

    throw new Error("There are too many death records to load completely.");
  }));
  return groups.flat();
}

const GENERIC_TEXT = new Set([
  "death", "deaths", "health death", "health related death", "health related deaths",
  "accident", "accidental death", "accidental deaths", "mortality", "unknown",
  "none", "not recorded", "not specified", "n a", "na", "no details",
]);

function noteKey(value: string) {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, " ").trim();
}

/** Return recorded notes and tags on death events; category labels are not causes. */
export function collectDeathNotes(events: ReadonlyArray<DeathNoteSource>): Record<DeathEventType, string[]> {
  const result: Record<DeathEventType, string[]> = { HEALTH_DEATH: [], ACCIDENTAL_DEATH: [] };
  const seen: Record<DeathEventType, Set<string>> = { HEALTH_DEATH: new Set(), ACCIDENTAL_DEATH: new Set() };

  for (const event of events) {
    if (event.eventType !== "HEALTH_DEATH" && event.eventType !== "ACCIDENTAL_DEATH") continue;
    const type = event.eventType;
    for (const candidate of [event.title, event.details, ...(event.tags?.split(",") ?? [])]) {
      const value = candidate?.trim().replace(/\s+/g, " ");
      if (!value || value.toUpperCase().startsWith("SALE_PURPOSE:")) continue;
      const key = noteKey(value);
      if (!key || GENERIC_TEXT.has(key) || seen[type].has(key)) continue;
      seen[type].add(key);
      result[type].push(value);
    }
  }
  return result;
}
