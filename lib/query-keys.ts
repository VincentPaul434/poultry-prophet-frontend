// Centralised, hierarchical query-key factory.
//
// Keys are nested so a coarse key invalidates everything beneath it, e.g.
//   queryClient.invalidateQueries({ queryKey: qk.batches.detail(id) })
// invalidates the batch, its overview, records, birds, indicators, alerts, etc.
// because they all live under ["batches", id, ...]. This is the backbone of the
// caching strategy: mutations invalidate the narrowest key that covers the data
// they changed.

export const qk = {
  farm: ["farm"] as const,
  version: ["version"] as const,
  lifecycleStages: ["lifecycle-stages"] as const,
  handlers: ["handlers"] as const,
  thresholds: ["thresholds"] as const,
  invitesPending: ["invites", "pending"] as const,
  incubation: ["incubation-cycles"] as const,
  inputs: ["farm-inputs"] as const,
  farmInputs: (batchId?: number, cycleId?: number) => ["farm-inputs", batchId, cycleId] as const,
  inventory: ["inventory"] as const,
  inventoryProducts: (includeInactive = false) => ["inventory", "products", { includeInactive }] as const,
  inventoryMovements: (params?: Record<string, unknown>) => ["inventory", "movements", params ?? {}] as const,
  inventoryPending: ["inventory", "pending-review"] as const,
  tasks: ["handler-tasks"] as const,
  taskList: (mine = false) => ["handler-tasks", { mine }] as const,
  finance: ["finance"] as const,
  financeAnalytics: (batchId?: number, start?: string, end?: string) => ["finance", "analytics", { batchId, start, end }] as const,
  operationsAnalytics: (params?: Record<string, unknown>) => ["analytics", "operations", params ?? {}] as const,
  batchComparison: (params?: Record<string, unknown>) => ["analytics", "batch-comparison", params ?? {}] as const,
  testLab: ["test-lab"] as const,
  // Farm-wide alert feed (notifications centre), distinct from per-batch alerts.
  alertsFarmRoot: ["alerts", "farm"] as const,
  alertsFarm: (activeOnly?: boolean) => ["alerts", "farm", { activeOnly }] as const,
  testLabStatus: ["test-lab", "status"] as const,

  batches: {
    all: ["batches"] as const,
    lists: () => [...qk.batches.all, "list"] as const,
    dashboard: () => [...qk.batches.all, "dashboard"] as const,
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
    alertsRoot: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "alerts"] as const,
    alerts: (batchId: number | string, activeOnly?: boolean, limit?: number) =>
      [...qk.batches.detail(batchId), "alerts", { activeOnly, limit }] as const,
    selection: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "selection"] as const,
    selectionReviewPreviewRoot: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "selection-review", "preview"] as const,
    selectionReviewPreview: (
      batchId: number | string,
      params?: { periodStart?: string; periodEnd?: string; asOfDate?: string },
    ) => [...qk.batches.selectionReviewPreviewRoot(batchId), params ?? {}] as const,
    selectionReviews: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "selection-reviews"] as const,
    selectionSessions: (batchId: number | string) =>
      [...qk.batches.detail(batchId), "selection-sessions"] as const,
    ranging: (batchId: number | string, birdId: number | string) =>
      [...qk.batches.detail(batchId), "birds", String(birdId), "ranging"] as const,
    events: (batchId: number | string, limit?: number) =>
      [...qk.batches.detail(batchId), "events", { limit }] as const,
  },
} as const;
