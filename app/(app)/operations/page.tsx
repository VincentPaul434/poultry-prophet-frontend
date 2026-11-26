"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Button } from "@/components/ui/button";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, CalendarDays, ChevronDown, GitCompareArrows, HeartPulse, LayoutDashboard, WalletCards } from "lucide-react";
import { useBatches, useDashboardBatches } from "@/hooks/use-batches";
import { useBatchComparison, useOperationsAnalytics } from "@/hooks/use-operations";
import type { AnalyticsScope, BatchComparison, FarmSummaryAnalytics } from "@/lib/farm-summary-types";
import FinanceWorkspace from "@/components/finance-workspace";
import { FarmBatchCharts } from "@/components/farm-batch-charts";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { getEventLogHref } from "@/lib/logging-navigation";

function formatLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function today() {
  return formatLocalDate(new Date());
}

function daysAgo(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return formatLocalDate(value);
}

function count(value: number | null | undefined) {
  return value == null ? "No record" : value.toLocaleString();
}

export default function OperationsPage() {
  const { display: displayText } = useDisplayLocale();
  return <Suspense fallback={<div className="mx-auto w-full max-w-6xl p-6 text-sm text-muted-foreground">{displayText("Loading farm overview…")}</div>}><OperationsPageContent /></Suspense>;
}

type OverviewFilters = {
  section: "snapshot" | "activity" | "finance" | "compare";
  scope: AnalyticsScope;
  batchId: string;
  start: string;
  end: string;
  origin: "REAL" | "SYNTHETIC" | "ALL";
};

function defaultOverviewFilters(): OverviewFilters {
  return { section: "snapshot", scope: "FARM", batchId: "", start: daysAgo(29), end: today(), origin: "REAL" };
}

function readOverviewFilters(searchParams: ReturnType<typeof useSearchParams>): OverviewFilters {
  const defaults = defaultOverviewFilters();
  const scope = searchParams.get("scope") === "BATCH" ? "BATCH" : "FARM";
  const origin = searchParams.get("origin");
  const section = searchParams.get("section");
  return {
    section: section === "activity" || section === "finance" || section === "compare" ? section : "snapshot",
    scope,
    batchId: scope === "BATCH" ? searchParams.get("batchId") ?? "" : "",
    start: searchParams.get("start") ?? defaults.start,
    end: searchParams.get("end") ?? defaults.end,
    origin: origin === "SYNTHETIC" || origin === "ALL" ? origin : "REAL",
  };
}

function updateOverviewUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  current: ReturnType<typeof useSearchParams>,
  patch: Partial<OverviewFilters>,
) {
  const next = { ...readOverviewFilters(current), ...patch };
  const params = new URLSearchParams(current.toString());
  if (next.section === "snapshot") params.delete("section");
  else params.set("section", next.section);
  params.set("scope", next.scope);
  params.set("start", next.start);
  params.set("end", next.end);
  if (next.scope === "BATCH" && next.batchId) params.set("batchId", next.batchId);
  else params.delete("batchId");
  if (next.origin === "REAL") params.delete("origin");
  else params.set("origin", next.origin);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}

function OperationsPageContent() {
  const { display: displayText } = useDisplayLocale();
  const { data: batches = [] } = useBatches();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = readOverviewFilters(searchParams);
  const validation = process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "validation" || process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "local";
  const { section, scope, batchId, start, end, origin } = filters;
  const params = {
    scope,
    batchId: scope === "BATCH" && batchId ? Number(batchId) : undefined,
    start,
    end,
    origin,
  };
  const usesOverviewAnalytics = section === "snapshot" || section === "activity";
  const query = useOperationsAnalytics(params, usesOverviewAnalytics && (scope === "FARM" || Boolean(batchId)));

  return (
    <div className="operations-page ledger-page mx-auto w-full max-w-6xl space-y-7 sm:space-y-9">
      <PageHeader
        title={displayText("Farm overview")}
        titleClassName="ledger-heading text-3xl leading-none sm:text-5xl"
        description={displayText("Population, health, incubation, and recorded activity for manager review.")}
        descriptionClassName="max-w-2xl text-sm leading-6"
      />

      <nav aria-label={displayText("Farm overview sections")} className="grid grid-cols-2 gap-2 rounded-[1.5rem] bg-card/70 p-2 lg:grid-cols-4">
        {([
          { id: "snapshot", label: "Snapshot", detail: "Farm at a glance", icon: LayoutDashboard },
          { id: "activity", label: "Activity", detail: "Events over time", icon: Activity },
          { id: "finance", label: "Finance", detail: "Recorded cash", icon: WalletCards },
          { id: "compare", label: "Batches", detail: "Charts and comparison", icon: GitCompareArrows },
        ] as const).map(({ id, label, detail, icon: Icon }) => (
          <Button
            variant="outline"
            key={id}
            type="button"
            aria-current={section === id ? "page" : undefined}
            onClick={() => updateOverviewUrl(router, pathname, searchParams, { section: id })}
            className={cn(
              "flex h-auto min-h-16 min-w-0 cursor-pointer items-center justify-start gap-3 rounded-[1rem] px-3 py-2 text-left shadow-none transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:px-4",
              section === id
                ? "border-primary bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)] hover:text-primary-foreground"
                : "border-input bg-background text-foreground hover:border-primary/60 hover:bg-accent/70",
            )}
          >
            <Icon className={cn("size-5 shrink-0", section === id ? "text-primary-foreground" : "text-primary")} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className={cn("hidden whitespace-normal text-xs leading-4 sm:block", section === id ? "text-primary-foreground" : "text-foreground/75")}>{detail}</span>
            </span>
          </Button>
        ))}
      </nav>

      {usesOverviewAnalytics && <section aria-label={displayText("Review window")} className="rounded-[1.5rem] border border-border/70 bg-card p-3 sm:p-5">
        <Button variant="ghost" type="button" aria-expanded={filtersOpen} aria-controls="review-window-controls" onClick={() => setFiltersOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:hidden"><span className="min-w-0"><span className="block text-sm font-semibold">{displayText("Review window")}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{scope === "FARM" ? "Whole farm" : "One batch"} · {start} {displayText("to")}{" "}{end}</span></span><ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", filtersOpen && "rotate-180")} aria-hidden="true" /></Button>
        <div id="review-window-controls" className={cn("gap-6 lg:grid-cols-[minmax(12rem,0.72fr)_minmax(0,2.28fr)] lg:items-end sm:grid", filtersOpen ? "grid pt-4 sm:pt-0" : "hidden")}>
          <div className="hidden space-y-2 sm:block">
            <p id="review-window-heading" className="text-sm font-semibold text-foreground">{displayText("Review window")}</p>
            <p className="max-w-[19rem] text-sm leading-5 text-muted-foreground">{displayText("Choose the scope and period for the records you want to review.")}</p>
          </div>
          <div className={cn("grid gap-3 sm:grid-cols-2", validation ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              {displayText("View")}
              <NativeSelect className="w-full min-w-0" selectClassName="h-12 rounded-xl border-0 bg-muted/45 pl-3.5 pr-9 text-base font-medium shadow-none focus-visible:bg-card md:text-sm" value={scope} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { scope: event.target.value as AnalyticsScope, batchId: "" })}>
                <option value="FARM">{displayText("Whole farm")}</option>
                <option value="BATCH">{displayText("One batch")}</option>
              </NativeSelect>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              {displayText("Batch")}
              <NativeSelect className="w-full min-w-0" selectClassName="h-12 rounded-xl border-0 bg-muted/45 pl-3.5 pr-9 text-base font-medium shadow-none focus-visible:bg-card md:text-sm" value={batchId} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { batchId: event.target.value })} disabled={scope !== "BATCH"}>
                <option value="">{displayText("Choose a batch")}</option>
                {batches.filter((batch) => batch.status !== "ARCHIVED" && !batch.name.startsWith("[TEST COPY]")).map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.name}</option>
                ))}
              </NativeSelect>
            </label>
            {validation && <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              {displayText("Data")}
              <NativeSelect className="w-full min-w-0" selectClassName="h-12 rounded-xl border-0 bg-muted/45 pl-3.5 pr-9 text-base font-medium shadow-none focus-visible:bg-card md:text-sm" value={origin} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { origin: event.target.value as OverviewFilters["origin"] })}>
                <option value="REAL">{displayText("Real records")}</option>
                <option value="SYNTHETIC">{displayText("Test records")}</option>
                <option value="ALL">{displayText("All validation records")}</option>
              </NativeSelect>
            </label>}
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              {displayText("From")}<Input className="h-12 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" type="date" value={start} max={end} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { start: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              {displayText("To")}<Input className="h-12 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" type="date" value={end} min={start} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { end: event.target.value })} />
            </label>
          </div>
        </div>
      </section>}

      {usesOverviewAnalytics && query.isLoading && <OverviewSkeleton />}
      {usesOverviewAnalytics && query.isError && <p role="alert" className="rounded-[1.5rem] bg-destructive/8 px-4 py-3 text-sm text-destructive">{displayText("Summary is not available. Please try again.")}</p>}
      {usesOverviewAnalytics && scope === "BATCH" && !batchId && <p className="rounded-[1.5rem] bg-muted/45 px-4 py-3 text-sm text-muted-foreground">{displayText("Choose a batch to view its summary.")}</p>}
      {section === "snapshot" && query.data && <Summary data={query.data} scope={scope} />}
      {section === "activity" && query.data && <ActivityOverview data={query.data} />}
      {section === "finance" && <FinanceWorkspace />}
      {section === "compare" && <BatchChartsSection batches={batches} origin={origin} validation={validation} onOriginChange={(value) => updateOverviewUrl(router, pathname, searchParams, { origin: value })} />}
    </div>
  );
}

function BatchChartsSection({ batches, origin, validation, onOriginChange }: { batches: Array<{ id: number; name: string; status: string }>; origin: OverviewFilters["origin"]; validation: boolean; onOriginChange: (value: OverviewFilters["origin"]) => void }) {
  const { display: displayText } = useDisplayLocale();
  const query = useDashboardBatches();
  const matchesOrigin = (name: string) => origin === "ALL" || (origin === "REAL" ? !name.startsWith("[TEST COPY]") : name.startsWith("[TEST COPY]"));
  return <div className="space-y-6">
    {validation && <label className="grid max-w-52 gap-1.5 text-xs font-semibold text-muted-foreground">{displayText("Data")}<NativeSelect className="h-11 rounded-lg bg-card px-3 font-medium shadow-none" value={origin} onChange={(event) => onOriginChange(event.target.value as OverviewFilters["origin"])}><option value="REAL">{displayText("Real records")}</option><option value="SYNTHETIC">{displayText("Test records")}</option><option value="ALL">{displayText("All validation records")}</option></NativeSelect></label>}
    <FarmBatchCharts items={(query.data ?? []).filter(({ batch }) => matchesOrigin(batch.name))} isLoading={query.isLoading} isError={query.isError} />
    <details className="group rounded-2xl border border-border/70 bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 [&::-webkit-details-marker]:hidden">{displayText("Compare selected batches")}{" "}<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="border-t border-border/70 p-3 sm:p-4"><BatchComparisonPanel batches={batches.filter((batch) => batch.status !== "ARCHIVED" && matchesOrigin(batch.name))} origin={origin} validation={false} onOriginChange={onOriginChange} /></div>
    </details>
  </div>;
}

function OverviewSkeleton() {
  const { display: displayText } = useDisplayLocale();
  return <div className="space-y-5" aria-label={displayText("Loading farm overview")}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="h-40 animate-pulse rounded-[2rem] bg-muted/45" /><div className="h-40 animate-pulse rounded-[1.6rem] bg-muted/35" /><div className="h-40 animate-pulse rounded-[1.6rem] bg-muted/35" /><div className="h-40 animate-pulse rounded-[1.6rem] bg-muted/35" /></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.85fr)]"><div className="h-[28rem] animate-pulse rounded-[2rem] bg-muted/35" /><div className="space-y-5"><div className="h-56 animate-pulse rounded-[1.6rem] bg-muted/35" /><div className="h-64 animate-pulse rounded-[1.6rem] bg-muted/35" /></div></div>
  </div>;
}

function BatchComparisonPanel({ batches, origin, validation, onOriginChange }: { batches: Array<{ id: number; name: string; status: string }>; origin: "REAL" | "SYNTHETIC" | "ALL"; validation: boolean; onOriginChange: (value: OverviewFilters["origin"]) => void }) {
  const { display: displayText } = useDisplayLocale();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const params = useMemo(() => ({ batchIds: selectedIds, windowDays, origin }), [origin, selectedIds, windowDays]);
  const query = useBatchComparison(params);
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 3 ? [...current.slice(1), id] : [...current, id]);
  return <section aria-labelledby="compare-batches-heading" className="rounded-[1.5rem] border border-border/70 bg-card p-5 sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{displayText("Manager review")}</p>
        <h2 id="compare-batches-heading" className="ledger-card-title text-2xl sm:text-3xl">{displayText("Compare batches")}</h2>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">{displayText("Use the same first-days window to read recorded differences side by side. This view does not rank or score batches.")}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      {validation && <label className="grid w-full gap-1.5 text-xs font-semibold text-muted-foreground sm:w-44">{displayText("Data")}<NativeSelect className="h-11 rounded-lg bg-muted/45 px-3 font-medium shadow-none" value={origin} onChange={(event) => onOriginChange(event.target.value as OverviewFilters["origin"])}><option value="REAL">{displayText("Real records")}</option><option value="SYNTHETIC">{displayText("Test records")}</option><option value="ALL">{displayText("All validation records")}</option></NativeSelect></label>}
      <label className="grid w-full gap-1.5 text-xs font-semibold text-muted-foreground sm:w-48">
        {displayText("Common window")}<NativeSelect className="h-11 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" value={String(windowDays)} onChange={(event) => setWindowDays(Number(event.target.value))}>
          <option value="30">{displayText("First 30 days")}</option>
          <option value="60">{displayText("First 60 days")}</option>
          <option value="90">{displayText("First 90 days")}</option>
        </NativeSelect>
      </label>
      </div>
    </div>
    <div className="mt-6 flex flex-wrap gap-2">
      {batches.length === 0 ? <span className="text-sm text-muted-foreground">{displayText("No batches available in this view.")}</span> : batches.map((batch) => {
        const selected = selectedIds.includes(batch.id);
        return <Button variant="ghost" key={batch.id} type="button" aria-pressed={selected} onClick={() => toggle(batch.id)} className={cn("min-h-10 rounded-xl px-3 text-sm font-semibold transition-colors active:scale-[0.98]", selected ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/45 text-foreground hover:bg-muted")}>{selected ? "✓ " : ""}{batch.name}</Button>;
      })}
    </div>
    {selectedIds.length < 2 && <p className="mt-4 rounded-xl bg-muted/35 px-3 py-2.5 text-sm text-muted-foreground">{displayText("Choose two or three batches.")}</p>}
    {query.isLoading && <p className="mt-4 text-sm text-muted-foreground">{displayText("Preparing comparison…")}</p>}
    {query.isError && <p role="alert" className="mt-4 rounded-xl bg-destructive/8 px-3 py-2.5 text-sm text-destructive">{displayText("Comparison is not available for this selection.")}</p>}
    {query.data && <div className="mt-5"><ComparisonTable data={query.data} /></div>}
  </section>;
}

function ComparisonTable({ data }: { data: BatchComparison }) {
  const { display: displayText } = useDisplayLocale();
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="border-0 bg-muted/60">{displayText("First")}{" "}{data.effectiveWindowDays} {displayText("days from hatch")}</Badge><span>{displayText("Dates and recorded facts are shown for each batch.")}</span></div>
    <p className="text-xs leading-5 text-muted-foreground">{displayText("Health-related loss is health deaths divided by starting birds. Accidental deaths and other population changes are excluded. Differences in bloodline, conditions and recording practices limit comparisons.")}</p>
    {data.warnings.length > 0 && <div className="rounded-xl bg-warning-muted px-3 py-2.5 text-sm">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    <p className="text-xs text-muted-foreground sm:hidden">{displayText("Scroll sideways to see all comparison columns.")}</p>
    <div className="overflow-x-auto rounded-2xl bg-muted/25" tabIndex={0} role="region" aria-label={displayText("Batch comparison table; scroll horizontally to see all columns")}><Table className="min-w-[48rem] w-full text-left text-sm"><TableHeader className="bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground"><TableRow><TableHead className="px-3 py-2.5">{displayText("Batch and period")}</TableHead><TableHead className="px-3 py-2.5">{displayText("Population")}</TableHead><TableHead className="px-3 py-2.5">{displayText("Health deaths")}</TableHead><TableHead className="px-3 py-2.5">{displayText("Health concerns")}</TableHead><TableHead className="px-3 py-2.5">{displayText("Product records")}</TableHead><TableHead className="px-3 py-2.5">{displayText("Selection")}</TableHead></TableRow></TableHeader><TableBody>{data.batches.map((batch) => {
      const populationNeedsReview = batch.populationStatus === "RECONCILIATION_REQUIRED" || (batch.populationAtWindowEnd != null && batch.populationAtWindowEnd < 0);
      return <TableRow key={batch.batchId} className="border-t border-border/40 align-top"><TableHead className="px-3 py-3 font-semibold">{batch.batchName}<span className="mt-1 block text-xs font-normal text-muted-foreground">{batch.bloodline ?? "Bloodline not recorded"}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{formatDate(batch.windowStart)} – {formatDate(batch.windowEnd)}</span>{batch.limitations?.map((limitation) => <span className="mt-1 block text-xs font-normal text-muted-foreground" key={limitation}>{limitation}</span>)}</TableHead><TableCell className="px-3 py-3 tabular-nums">{populationNeedsReview ? <span className="block max-w-44 text-warning-ink"><span className="font-semibold">{displayText("Needs review")}</span><span className="block text-xs font-normal">{displayText("Initial:")}{" "}{batch.initialPopulation}</span><span className="mt-1 block text-xs font-normal leading-snug">{batch.populationWarning ?? "Population records need review."}</span><Link className="mt-2 inline-block font-semibold underline underline-offset-2" href={getEventLogHref(batch.batchId)}>{displayText("Review records →")}</Link></span> : `${batch.populationAtWindowEnd ?? "No record"} / ${batch.initialPopulation}`}</TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.healthRelatedDeaths}<span className="block text-xs text-muted-foreground">{populationNeedsReview || batch.initialPopulation <= 0 || batch.healthRelatedLossRatePercent == null ? "Rate unavailable" : `${batch.healthRelatedDeaths} / ${batch.initialPopulation} = ${batch.healthRelatedLossRatePercent}%`}</span></TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.healthConcerns}</TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.interventionRecords}</TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.selectionDataStatus === "AVAILABLE" ? `${batch.acceptedAtSelection} / ${batch.evaluatedAtSelection}` : displayText("No record")}</TableCell></TableRow>;
    })}</TableBody></Table></div>
  </div>;
}

function Summary({ data, scope }: { data: FarmSummaryAnalytics; scope: AnalyticsScope }) {
  const { display: displayText } = useDisplayLocale();
  const populationLabel = scope === "FARM" ? "Current birds" : "Birds in batch";
  const cards = [
    { label: populationLabel, value: data.population.available ? count(data.population.currentPopulation) : "No record", hint: data.population.available ? count(data.population.initialPopulation) + " at start" : "No batch record" },
    { label: scope === "FARM" ? "Active batches" : "Birds at start", value: data.population.available ? count(scope === "FARM" ? data.population.activeBatches : data.population.initialPopulation) : "No record", hint: scope === "FARM" ? "Currently in the farm" : "Initial population" },
    { label: "Health concerns", value: count(data.events.healthConcerns), hint: count(data.events.interventions) + " interventions" },
    { label: "Open tasks", value: data.tasks.available ? count(data.tasks.open) : "No record", hint: data.tasks.available ? count(data.tasks.overdue) + " overdue" : "Task records unavailable" },
  ];
  const primaryMetric = cards[0];

  return (
    <div className="space-y-9">
    <section aria-labelledby="review-snapshot-heading" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{displayText("Farm pulse / 01")}</p>
          <h2 id="review-snapshot-heading" className="ledger-card-title mt-1 text-2xl sm:text-3xl">{displayText("At a glance")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">{displayText("Population as of")}{" "}{data.population.asOfDate ?? data.endDate}{displayText("; activity covers the selected period.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-lg bg-muted/55 px-3 py-1.5 font-medium text-foreground">{data.startDate} – {data.endDate}{data.batchName ? " · " + data.batchName : ""}</span>
        </div>
      </div>
      <div className="relative grid gap-3 overflow-hidden rounded-[1.75rem] bg-[#19382d] p-4 text-white sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-5 lg:p-6">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full border border-white/10" aria-hidden="true" />
        <MetricAnchor label={primaryMetric.label} value={primaryMetric.value} hint={primaryMetric.hint} />
        <div className="relative grid gap-px overflow-hidden rounded-xl bg-white/15 sm:grid-cols-3 lg:grid-cols-1">
          {cards.slice(1).map((card) => <MetricTile key={card.label} {...card} />)}
        </div>
      </div>
    </section>
    <SignalsPanel events={data.events} incubation={data.incubation} />
    </div>
  );
}

function MetricAnchor({ label, value, hint }: { label: string; value: string; hint: string }) {
  const { display: displayText } = useDisplayLocale();
  return <article className="relative flex min-h-64 flex-col justify-between rounded-[1.25rem] bg-[#28513b] p-5 sm:p-7">
    <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">{label}</p><span className="text-[11px] font-medium text-[#e7d780]">{displayText("Live flock")}</span></div>
    <div><div className="flex flex-wrap items-baseline gap-2"><p className="break-all text-6xl font-semibold leading-none tracking-[-0.07em] tabular-nums sm:text-7xl">{value}</p>{value !== "No record" && <span className="text-sm text-white/65">{displayText("birds")}</span>}</div><p className="mt-4 border-t border-white/15 pt-3 text-sm text-white/70">{hint}</p></div>
  </article>;
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <article className="min-w-0 bg-[#214535] px-5 py-4 lg:flex lg:items-center lg:justify-between lg:gap-4">
    <div className="min-w-0"><p className="text-xs font-medium text-white/65">{label}</p><p className="mt-1 text-xs text-white/45">{hint}</p></div>
    <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-[#f3e8ad] lg:mt-0">{value}</p>
  </article>;
}

function ActivityOverview({ data }: { data: FarmSummaryAnalytics }) {
  const { display: displayText } = useDisplayLocale();
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{displayText("Farm activity / 02")}</p><h2 className="ledger-card-title mt-1 text-2xl sm:text-3xl">{displayText("Activity over time")}</h2><p className="mt-1 text-sm text-muted-foreground">{displayText("Events and interventions recorded from")}{" "}{data.startDate} {displayText("to")}{" "}{data.endDate}.</p></div><ActivityChart data={data.activity} /><div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3"><ActivityFact label={displayText("Recorded events")} value={count(data.events.totalEvents)} /><ActivityFact label={displayText("Health concerns")} value={count(data.events.healthConcerns)} /><ActivityFact label={displayText("Interventions")} value={count(data.events.interventions)} /></div></div>;
}

function ActivityFact({ label, value }: { label: string; value: string }) {
  return <div className="bg-card px-5 py-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div>;
}

function ActivityChart({ data }: { data: FarmSummaryAnalytics["activity"] }) {
  const { display: displayText } = useDisplayLocale();
  const max = Math.max(1, ...data.map((item) => item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents));
  const totals = data.map((item) => item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents);
  const hasActivity = totals.some((total) => total > 0);
  const totalEvents = totals.reduce((sum, total) => sum + total, 0);
  return <section className="min-h-[28rem] rounded-[1.75rem] bg-[#19382d] p-5 text-white sm:p-7" aria-labelledby="activity-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4c875]">{displayText("Timeline")}</p><h2 id="activity-heading" className="mt-1 text-2xl font-semibold tracking-tight">{displayText("Recorded activity")}</h2><p className="mt-1 text-sm text-white/60">{displayText("Events and interventions across the selected window.")}</p></div><span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">{hasActivity ? `${totalEvents} events` : "No events"}</span></div>
    <div className="relative mt-8 flex min-h-64 items-end gap-1 overflow-hidden rounded-[1rem] bg-white/[0.045] px-4 pb-3 pt-6" aria-label={displayText("Recorded activity chart")}>
      {hasActivity ? <><div className="pointer-events-none absolute inset-x-4 top-1/4 border-t border-white/10" /><div className="pointer-events-none absolute inset-x-4 top-1/2 border-t border-white/10" /><div className="pointer-events-none absolute inset-x-4 top-3/4 border-t border-white/10" />{data.map((item, index) => { const total = totals[index]; return <div key={item.periodStart} className="group relative z-[1] flex h-full min-w-2 flex-1 items-end justify-center" title={item.label + ": " + total + " events"}><div className="w-full rounded-t-md bg-[#e6d26d] transition-colors group-hover:bg-[#f7e789]" style={{ height: total === 0 ? "0%" : String(Math.max(6, total / max * 100)) + "%" }} /></div>; })}</> : <div className="absolute inset-0 flex items-center justify-center"><p className="text-sm text-white/65">{displayText("No activity recorded for this period.")}</p></div>}
    </div>
    <div className="mt-3 flex justify-between text-[11px] text-white/55"><span>{data[0]?.label ?? "No record"}</span><span>{data[data.length - 1]?.label ?? ""}</span></div>
    <details className="mt-5 text-xs"><summary className="w-fit cursor-pointer font-medium text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6d26d]">{displayText("View event totals")}</summary><div className="mt-3 max-h-48 overflow-auto rounded-xl bg-white/10 px-3 py-2"><ChartTable rows={data.map((item) => ({ label: item.label, value: item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents }))} /></div></details>
  </section>;
}

function ChartTable({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return <Table className="w-full text-left"><TableBody>{rows.map((row) => <TableRow key={row.label} className="border-b last:border-0"><TableHead className="py-1 font-normal">{row.label}</TableHead><TableCell className="py-1 text-right tabular-nums">{row.value}</TableCell></TableRow>)}</TableBody></Table>;
}

function SignalsPanel({ events, incubation }: { events: FarmSummaryAnalytics["events"]; incubation: FarmSummaryAnalytics["incubation"] }) {
  const { display: displayText } = useDisplayLocale();
  return <section className="border-t border-border pt-7" aria-labelledby="signals-heading">
    <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{displayText("Farm pulse / 02")}</p><h2 id="signals-heading" className="ledger-card-title mt-1 text-2xl sm:text-3xl">{displayText("Health and incubation")}</h2><p className="mt-1 text-sm text-muted-foreground">{displayText("Recorded care and hatch progress in this window.")}</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[1.25rem] border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2"><HeartPulse className="size-5 text-primary" aria-hidden="true" /><h3 className="text-base font-semibold">{displayText("Health records")}</h3></div><div className="mt-5 divide-y divide-border"><Fact label={displayText("Health concerns")} value={count(events.healthConcerns)} /><Fact label={displayText("Interventions")} value={count(events.interventions)} /><Fact label={displayText("Health-related deaths")} value={count(events.healthRelatedDeaths)} /><Fact label={displayText("Other losses")} value={count(events.otherLosses)} /></div></div>
      <div className="rounded-[1.25rem] border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" aria-hidden="true" /><h3 className="text-base font-semibold">{displayText("Incubation")}</h3></div>{incubation.available ? <div className="mt-5 divide-y divide-border"><Fact label={displayText("Finalized hatch rate")} value={incubation.finalizedHatchRatePercent == null ? "Pending" : incubation.finalizedHatchRatePercent + "%"} /><Fact label={displayText("Completed cycles")} value={count(incubation.completedCycles)} /><Fact label={displayText("In progress")} value={count(incubation.inProgressCycles)} /></div> : <div className="mt-5"><NoRecord /></div>}</div>
    </div>
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{value}</strong></div>;
}

function NoRecord() {
  const { display: displayText } = useDisplayLocale();
  return <p className="rounded-lg bg-warning-muted/60 px-3 py-2.5 text-sm text-warning-ink">{displayText("No record for this period.")}</p>;
}
