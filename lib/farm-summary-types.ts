export type AnalyticsScope = "FARM" | "BATCH";
export type AnalyticsOrigin = "REAL" | "SYNTHETIC" | "ALL";

export interface FarmSummaryAnalytics {
  scope: AnalyticsScope;
  batchId: number | null;
  batchName: string | null;
  startDate: string;
  endDate: string;
  timeZone: string;
  generatedAt: string;
  population: {
    activeBatches: number;
    initialPopulation: number;
    currentPopulation: number;
    available: boolean;
  };
  events: {
    healthRelatedDeaths: number;
    otherLosses: number;
    healthConcerns: number;
    interventions: number;
    totalEvents: number;
    birdsAffected: number;
  };
  activity: Array<{
    periodStart: string;
    periodEnd: string;
    label: string;
    unit: string;
    healthConcerns: number;
    healthRelatedDeaths: number;
    otherLosses: number;
    interventions: number;
    otherEvents: number;
  }>;
  finance: {
    currency: string;
    income: string;
    expense: string;
    net: string;
    transactionCount: number;
    series: Array<{
      periodStart: string;
      periodEnd: string;
      label: string;
      income: string;
      expense: string;
      net: string;
    }>;
    categories: Array<{ category: string; amount: string }>;
    available: boolean;
    limitation: string;
  };
  tasks: {
    total: number;
    open: number;
    completed: number;
    overdue: number;
    completionRatePercent: number;
    available: boolean;
  };
  incubation: {
    totalCycles: number;
    completedCycles: number;
    inProgressCycles: number;
    finalizedEggsLoaded: number;
    finalizedHatched: number;
    finalizedHatchRatePercent: number;
    averageDurationDays: number;
    available: boolean;
  };
  inputTypes: Record<string, number>;
  limitations: string[];
}

export interface BatchComparison {
  requestedWindowDays: number;
  effectiveWindowDays: number;
  timeZone: string;
  warnings: string[];
  batches: Array<{
    batchId: number;
    batchName: string;
    bloodline: string | null;
    source: string | null;
    windowStart: string;
    windowEnd: string;
    initialPopulation: number;
    populationAtWindowEnd: number | null;
    populationStatus: "VALID" | "RECONCILIATION_REQUIRED";
    populationWarning: string | null;
    firstInvalidEventDate: string | null;
    healthRelatedDeaths: number;
    healthRelatedLossRatePercent: number | null;
    healthConcerns: number;
    interventionRecords: number;
    populationChangesByCause: Record<string, number>;
    evaluatedAtSelection: number | null;
    acceptedAtSelection: number | null;
    selectionRatePercent: number | null;
    selectionDataStatus: "AVAILABLE" | "NO_RECORD";
    sourceEventCount: number;
    sourceProductRecordCount: number;
    limitations: string[];
  }>;
}
