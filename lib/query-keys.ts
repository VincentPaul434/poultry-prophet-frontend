// Centralised, hierarchical query-key factory.
//
// Keys are nested so a coarse key invalidates everything beneath it, e.g.
//   queryClient.invalidateQueries({ queryKey: qk.batches.detail(id) })
// invalidates the batch, its overview, records, birds, indicators, alerts, etc.
// because they all live under ["batches", id, ...]. This is the backbone of the
// caching strategy: mutations invalidate the narrowest key that covers the data
// they changed.

export const qk = {
  lifecycleStages: ["lifecycle-stages"] as const,
  handlers: ["handlers"] as const,
  thresholds: ["thresholds"] as const,

  batches: {
    all: ["batches"] as const,
    lists: () => [...qk.batches.all, "list"] as const,
    detail: (batchId: number | string) =>
      [...qk.batches.all, String(batchId)] as const,
    overview: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "overview"] as const,
    birds: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "birds"] as const,
    records: (batchId: number | string, limit?: number) =>
      [...qk.batches.detail(batchId), "records", { limit }] as const,
    indicatorsLatest: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "indicators", "latest"] as const,
    indicators: (batchId: number | string, limit?: number) =>
      [...qk.batches.detail(batchId), "indicators", { limit }] as const,
    alerts: (batchId: number | string, activeOnly?: boolean, limit?: number) =>
      [...qk.batches.detail(batchId), "alerts", { activeOnly, limit }] as const,
    selection: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "selection"] as const,
    ranging: (batchId: number | string, birdId: number | string) =>
      [...qk.batches.detail(batchId), "birds", String(birdId), "ranging"] as const,
  },
} as const;
