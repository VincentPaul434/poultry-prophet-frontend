import type { Query, QueryClient } from "@tanstack/react-query";

export const LIVE_REFRESH_INTERVAL = 60_000;

const liveRoots = new Set([
  "batches", "farm", "farm-inputs", "inventory", "handler-tasks", "alerts",
  "incubation-cycles", "finance", "analytics", "vaccination-programs", "version",
  "selection-review-death-events", "selection-review-demo-cost-impact",
]);

/** Refresh mounted farm reads; saved report payloads remain immutable. */
export function isLiveFarmQuery(query: Pick<Query, "queryKey">) {
  return typeof query.queryKey[0] === "string" && liveRoots.has(query.queryKey[0]);
}

export async function refreshActiveFarmQueries(client: QueryClient) {
  await client.invalidateQueries({ predicate: isLiveFarmQuery, refetchType: "none" });
  await client.refetchQueries({ predicate: isLiveFarmQuery, type: "active" }, { cancelRefetch: false, throwOnError: true });
}
