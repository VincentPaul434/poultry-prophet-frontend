"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Button } from "@/components/ui/button";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, CalendarDays, ChevronDown, GitCompareArrows, HeartPulse, LayoutDashboard, WalletCards } from "lucide-react";
import { useBatches } from "@/hooks/use-batches";
import { useBatchComparison, useOperationsAnalytics } from "@/hooks/use-operations";
import type { AnalyticsScope, BatchComparison, FarmSummaryAnalytics, FinanceCurrencySummary } from "@/lib/farm-summary-types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

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

function money(value: string, currency = "PHP") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "No record";
  const formatted = amount.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  return currency === "PHP" ? `₱${formatted}` : `${currency} ${formatted}`;
}

function count(value: number | null | undefined) {
  return value == null ? "No record" : value.toLocaleString();
}

export default function OperationsPage() {
  return <Suspense fallback={<div className="mx-auto w-full max-w-6xl p-6 text-sm text-muted-foreground">Loading farm overview…</div>}><OperationsPageContent /></Suspense>;
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

function financeHref(filters: OverviewFilters) {
  const params = new URLSearchParams({
    period: "custom",
    start: filters.start,
    end: filters.end,
    location: filters.scope === "BATCH" && filters.batchId ? `batch:${filters.batchId}` : "all",
    type: "ALL",
    category: "ALL",
    source: "ALL",
    status: "POSTED",
    view: "report",
  });
  return `/finance?${params.toString()}`;
}

function OperationsPageContent() {
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
  const query = useOperationsAnalytics(params, section !== "compare" && (scope === "FARM" || Boolean(batchId)));

  return (
    <div className="operations-page ledger-page mx-auto w-full max-w-6xl space-y-7 sm:space-y-9">
      <PageHeader
        title="Farm overview"
        titleClassName="ledger-heading text-3xl leading-none sm:text-5xl"
        description="Population, health, incubation, and recorded activity for manager review."
        descriptionClassName="max-w-2xl text-sm leading-6"
      />

      <nav aria-label="Farm overview sections" className="grid grid-cols-2 gap-2 rounded-[1.5rem] bg-card/70 p-2 sm:grid-cols-4">
        {([
          { id: "snapshot", label: "Snapshot", detail: "Farm at a glance", icon: LayoutDashboard },
          { id: "activity", label: "Activity", detail: "Events over time", icon: Activity },
          { id: "finance", label: "Finance", detail: "Recorded cash", icon: WalletCards },
          { id: "compare", label: "Compare", detail: "Batch differences", icon: GitCompareArrows },
        ] as const).map(({ id, label, detail, icon: Icon }) => <Button variant="ghost" key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => updateOverviewUrl(router, pathname, searchParams, { section: id })} className={cn("flex min-h-16 items-center gap-3 rounded-[1rem] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:px-4", section === id ? "bg-primary text-primary-foreground shadow-[0_8px_20px_rgb(40_99_63_/_0.16)]" : "text-foreground hover:bg-muted/70")}><Icon className={cn("size-5 shrink-0", section === id ? "text-primary-foreground" : "text-primary")} aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className={cn("hidden truncate text-xs sm:block", section === id ? "text-primary-foreground/70" : "text-muted-foreground")}>{detail}</span></span></Button>)}
      </nav>

      {section !== "compare" && <section aria-label="Review window" className="rounded-[1.5rem] border border-border/70 bg-card p-3 sm:p-5">
        <Button variant="ghost" type="button" aria-expanded={filtersOpen} aria-controls="review-window-controls" onClick={() => setFiltersOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:hidden"><span className="min-w-0"><span className="block text-sm font-semibold">Review window</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{scope === "FARM" ? "Whole farm" : "One batch"} · {start} to {end}</span></span><ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", filtersOpen && "rotate-180")} aria-hidden="true" /></Button>
        <div id="review-window-controls" className={cn("gap-6 lg:grid-cols-[minmax(12rem,0.72fr)_minmax(0,2.28fr)] lg:items-end sm:grid", filtersOpen ? "grid pt-4 sm:pt-0" : "hidden")}>
          <div className="hidden space-y-2 sm:block">
            <p id="review-window-heading" className="text-sm font-semibold text-foreground">Review window</p>
            <p className="max-w-[19rem] text-sm leading-5 text-muted-foreground">Choose the scope and period for the records you want to review.</p>
          </div>
          <div className={cn("grid gap-3 sm:grid-cols-2", validation ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              View
              <NativeSelect className="h-12 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" value={scope} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { scope: event.target.value as AnalyticsScope, batchId: "" })}>
                <option value="FARM">Whole farm</option>
                <option value="BATCH">One batch</option>
              </NativeSelect>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Batch
              <NativeSelect className="h-12 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" value={batchId} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { batchId: event.target.value })} disabled={scope !== "BATCH"}>
                <option value="">Choose a batch</option>
                {batches.filter((batch) => batch.status !== "ARCHIVED" && !batch.name.startsWith("[TEST COPY]")).map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.name}</option>
                ))}
              </NativeSelect>
            </label>
            {validation && <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Data
              <NativeSelect className="h-12 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" value={origin} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { origin: event.target.value as OverviewFilters["origin"] })}>
                <option value="REAL">Real records</option>
                <option value="SYNTHETIC">Test records</option>
                <option value="ALL">All validation records</option>
              </NativeSelect>
            </label>}
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              From
              <Input className="h-12 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" type="date" value={start} max={end} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { start: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              To
              <Input className="h-12 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" type="date" value={end} min={start} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { end: event.target.value })} />
            </label>
          </div>
        </div>
      </section>}

      {section !== "compare" && query.isLoading && <OverviewSkeleton />}
      {section !== "compare" && query.isError && <p role="alert" className="rounded-[1.5rem] bg-destructive/8 px-4 py-3 text-sm text-destructive">Summary is not available. Please try again.</p>}
      {section !== "compare" && scope === "BATCH" && !batchId && <p className="rounded-[1.5rem] bg-muted/45 px-4 py-3 text-sm text-muted-foreground">Choose a batch to view its summary.</p>}
      {section === "snapshot" && query.data && <Summary data={query.data} scope={scope} />}
      {section === "activity" && query.data && <ActivityOverview data={query.data} />}
      {section === "finance" && query.data && <FinancialSection data={query.data.finance} href={financeHref(filters)} />}
      {section === "compare" && <BatchComparisonPanel batches={batches.filter((batch) => batch.status !== "ARCHIVED" && (origin === "ALL" || origin === "REAL" && !batch.name.startsWith("[TEST COPY]") || origin === "SYNTHETIC" && batch.name.startsWith("[TEST COPY]")))} origin={origin} validation={validation} onOriginChange={(value) => updateOverviewUrl(router, pathname, searchParams, { origin: value })} />}
    </div>
  );
}

function OverviewSkeleton() {
  return <div className="space-y-5" aria-label="Loading farm overview">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="h-40 animate-pulse rounded-[2rem] bg-muted/45" /><div className="h-40 animate-pulse rounded-[1.6rem] bg-muted/35" /><div className="h-40 animate-pulse rounded-[1.6rem] bg-muted/35" /><div className="h-40 animate-pulse rounded-[1.6rem] bg-muted/35" /></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.85fr)]"><div className="h-[28rem] animate-pulse rounded-[2rem] bg-muted/35" /><div className="space-y-5"><div className="h-56 animate-pulse rounded-[1.6rem] bg-muted/35" /><div className="h-64 animate-pulse rounded-[1.6rem] bg-muted/35" /></div></div>
  </div>;
}

function BatchComparisonPanel({ batches, origin, validation, onOriginChange }: { batches: Array<{ id: number; name: string; status: string }>; origin: "REAL" | "SYNTHETIC" | "ALL"; validation: boolean; onOriginChange: (value: OverviewFilters["origin"]) => void }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const params = useMemo(() => ({ batchIds: selectedIds, windowDays, origin }), [origin, selectedIds, windowDays]);
  const query = useBatchComparison(params);
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 3 ? [...current.slice(1), id] : [...current, id]);
  return <section aria-labelledby="compare-batches-heading" className="rounded-[1.5rem] border border-border/70 bg-card p-5 sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Manager review</p>
        <h2 id="compare-batches-heading" className="ledger-card-title text-2xl sm:text-3xl">Compare batches</h2>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">Use the same first-days window to read recorded differences side by side. This view does not rank or score batches.</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      {validation && <label className="grid w-full gap-1.5 text-xs font-semibold text-muted-foreground sm:w-44">Data<NativeSelect className="h-11 rounded-lg bg-muted/45 px-3 font-medium shadow-none" value={origin} onChange={(event) => onOriginChange(event.target.value as OverviewFilters["origin"])}><option value="REAL">Real records</option><option value="SYNTHETIC">Test records</option><option value="ALL">All validation records</option></NativeSelect></label>}
      <label className="grid w-full gap-1.5 text-xs font-semibold text-muted-foreground sm:w-48">
        Common window
        <NativeSelect className="h-11 rounded-xl border-0 bg-muted/45 px-3.5 font-medium shadow-none focus-visible:bg-card" value={String(windowDays)} onChange={(event) => setWindowDays(Number(event.target.value))}>
          <option value="30">First 30 days</option>
          <option value="60">First 60 days</option>
          <option value="90">First 90 days</option>
        </NativeSelect>
      </label>
      </div>
    </div>
    <div className="mt-6 flex flex-wrap gap-2">
      {batches.length === 0 ? <span className="text-sm text-muted-foreground">No batches available in this view.</span> : batches.map((batch) => {
        const selected = selectedIds.includes(batch.id);
        return <Button variant="ghost" key={batch.id} type="button" aria-pressed={selected} onClick={() => toggle(batch.id)} className={cn("min-h-10 rounded-xl px-3 text-sm font-semibold transition-colors active:scale-[0.98]", selected ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/45 text-foreground hover:bg-muted")}>{selected ? "✓ " : ""}{batch.name}</Button>;
      })}
    </div>
    {selectedIds.length < 2 && <p className="mt-4 rounded-xl bg-muted/35 px-3 py-2.5 text-sm text-muted-foreground">Choose two or three batches.</p>}
    {query.isLoading && <p className="mt-4 text-sm text-muted-foreground">Preparing comparison…</p>}
    {query.isError && <p role="alert" className="mt-4 rounded-xl bg-destructive/8 px-3 py-2.5 text-sm text-destructive">Comparison is not available for this selection.</p>}
    {query.data && <div className="mt-5"><ComparisonTable data={query.data} /></div>}
  </section>;
}

function ComparisonTable({ data }: { data: BatchComparison }) {
  return <div className="space-y-3"><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="border-0 bg-muted/60">First {data.effectiveWindowDays} days</Badge><span>All values are recorded facts; rates show their numerator and denominator.</span></div>{data.warnings.length > 0 && <div className="rounded-xl bg-warning-muted px-3 py-2.5 text-sm">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}<div className="overflow-x-auto rounded-2xl bg-muted/25"><Table className="min-w-[48rem] w-full text-left text-sm"><TableHeader className="bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground"><TableRow><TableHead className="px-3 py-2.5">Batch</TableHead><TableHead className="px-3 py-2.5">Population</TableHead><TableHead className="px-3 py-2.5">Health deaths</TableHead><TableHead className="px-3 py-2.5">Health concerns</TableHead><TableHead className="px-3 py-2.5">Product records</TableHead><TableHead className="px-3 py-2.5">Selection</TableHead></TableRow></TableHeader><TableBody>{data.batches.map((batch) => { const populationNeedsReview = batch.populationStatus === "RECONCILIATION_REQUIRED" || (batch.populationAtWindowEnd != null && batch.populationAtWindowEnd < 0); return <TableRow key={batch.batchId} className="border-t border-border/40 align-top"><TableHead className="px-3 py-3 font-semibold">{batch.batchName}<span className="mt-1 block text-xs font-normal text-muted-foreground">{batch.bloodline ?? "Bloodline not recorded"}</span></TableHead><TableCell className="px-3 py-3 tabular-nums">{populationNeedsReview ? <span className="block max-w-44 text-warning-ink"><span className="font-semibold">Needs review</span><span className="block text-xs font-normal">Initial: {batch.initialPopulation}</span><span className="mt-1 block text-xs font-normal leading-snug">{batch.populationWarning ?? "Population records need review."}</span><Link className="mt-2 inline-block font-semibold underline underline-offset-2" href={`/batches/${batch.batchId}/data-entry?from=operations`}>Review records →</Link></span> : `${batch.populationAtWindowEnd ?? "No record"} / ${batch.initialPopulation}`}</TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.healthRelatedDeaths}<span className="block text-xs text-muted-foreground">{batch.healthRelatedLossRatePercent == null ? "Rate unavailable" : `${batch.healthRelatedLossRatePercent}% of start`}</span></TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.healthConcerns}</TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.interventionRecords}</TableCell><TableCell className="px-3 py-3 tabular-nums">{batch.selectionDataStatus === "AVAILABLE" ? `${batch.acceptedAtSelection} / ${batch.evaluatedAtSelection}` : "No record"}</TableCell></TableRow>; })}</TableBody></Table></div></div>;
}

function Summary({ data, scope }: { data: FarmSummaryAnalytics; scope: AnalyticsScope }) {
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
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Farm pulse / 01</p>
          <h2 id="review-snapshot-heading" className="ledger-card-title mt-1 text-2xl sm:text-3xl">At a glance</h2>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">Population as of {data.population.asOfDate ?? data.endDate}; activity covers the selected period.</p>
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
  return <article className="relative flex min-h-64 flex-col justify-between rounded-[1.25rem] bg-[#28513b] p-5 sm:p-7">
    <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">{label}</p><span className="text-[11px] font-medium text-[#e7d780]">Live flock</span></div>
    <div><div className="flex flex-wrap items-baseline gap-2"><p className="break-all text-6xl font-semibold leading-none tracking-[-0.07em] tabular-nums sm:text-7xl">{value}</p>{value !== "No record" && <span className="text-sm text-white/65">birds</span>}</div><p className="mt-4 border-t border-white/15 pt-3 text-sm text-white/70">{hint}</p></div>
  </article>;
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <article className="min-w-0 bg-[#214535] px-5 py-4 lg:flex lg:items-center lg:justify-between lg:gap-4">
    <div className="min-w-0"><p className="text-xs font-medium text-white/65">{label}</p><p className="mt-1 text-xs text-white/45">{hint}</p></div>
    <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-[#f3e8ad] lg:mt-0">{value}</p>
  </article>;
}

function ActivityOverview({ data }: { data: FarmSummaryAnalytics }) {
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Farm activity / 02</p><h2 className="ledger-card-title mt-1 text-2xl sm:text-3xl">Activity over time</h2><p className="mt-1 text-sm text-muted-foreground">Events and interventions recorded from {data.startDate} to {data.endDate}.</p></div><ActivityChart data={data.activity} /><div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3"><ActivityFact label="Recorded events" value={count(data.events.totalEvents)} /><ActivityFact label="Health concerns" value={count(data.events.healthConcerns)} /><ActivityFact label="Interventions" value={count(data.events.interventions)} /></div></div>;
}

function ActivityFact({ label, value }: { label: string; value: string }) {
  return <div className="bg-card px-5 py-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div>;
}

function FinancialSection({ data, href }: { data: FarmSummaryAnalytics["finance"]; href: string }) {
  const reports = data.byCurrency ?? (data.currency && data.income != null && data.expense != null && data.net != null
    ? [{ ...data, currency: data.currency, income: data.income, saleIncome: data.saleIncome ?? "0", expense: data.expense, net: data.net }]
    : []);
  return <div className="space-y-6">{reports.length > 1 && <p className="text-sm text-muted-foreground">Currencies are shown separately; no conversion is applied.</p>}{reports.map((report) => <FinancialCurrencySection key={report.currency} data={report} limitation={data.limitation} href={href} />)}</div>;
}

function FinancialCurrencySection({ data, limitation, href }: { data: FinanceCurrencySummary; limitation: string; href: string }) {
  const scopeNote = financeScopeNote(limitation);
  const netValue = data.available ? money(data.net, data.currency) : "No record";
  const incomeValue = data.available ? money(data.income, data.currency) : "No record";
  const expenseValue = data.available ? money(data.expense, data.currency) : "No record";
  const largest = Math.max(Number(data.income) || 0, Number(data.expense) || 0, 1);
  const incomeWidth = data.available ? Math.max(Number(data.income) > 0 ? 2 : 0, Number(data.income) / largest * 100) : 0;
  const expenseWidth = data.available ? Math.max(Number(data.expense) > 0 ? 2 : 0, Number(data.expense) / largest * 100) : 0;

  return <section className="space-y-5" aria-labelledby={`financial-snapshot-${data.currency}`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 id={`financial-snapshot-${data.currency}`} className="ledger-card-title text-2xl sm:text-3xl">Financial snapshot</h2><p className="mt-1 text-sm font-medium">{data.currency}</p><p className="mt-1 text-sm text-muted-foreground">Recorded cash for the selected period.</p></div>
      <span className="text-sm text-muted-foreground">{data.transactionCount} posted transaction{data.transactionCount === 1 ? "" : "s"}</span>
    </div>
    <div className="grid overflow-hidden rounded-[1.75rem] bg-[#194b37] text-white shadow-xl shadow-[#194b37]/10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]">
      <article className="flex min-h-64 flex-col justify-between gap-8 p-6 sm:p-8" aria-label={`Net cash flow ${netValue}.`}>
        <div><h3 className="text-lg font-medium text-white/85">Net cash flow</h3><p className="mt-1 text-sm text-white/60">Income less cash expenses</p></div>
        <p className="break-words text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-none tracking-[-0.06em] tabular-nums">{netValue}</p>
      </article>
      <div className="grid bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-1">
        <div className="flex flex-col justify-center gap-3 p-6 sm:p-8"><h3 className="text-sm font-medium text-white/75">Income</h3><p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{incomeValue}</p><div className="h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#c6e5b4]" style={{ width: `${incomeWidth}%` }} /></div></div>
        <div className="flex flex-col justify-center gap-3 border-t border-white/10 p-6 sm:border-l sm:border-t-0 sm:p-8 lg:border-l-0 lg:border-t"><h3 className="text-sm font-medium text-white/75">Cash expenses</h3><p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{expenseValue}</p><div className="h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#e5b679]" style={{ width: `${expenseWidth}%` }} /></div></div>
      </div>
    </div>
    <div className="flex flex-col gap-4 rounded-[1.5rem] bg-muted/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{data.available ? scopeNote : "No financial record is available for this period."}</p>
      <Link href={href} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">View finance</Link>
    </div>
  </section>;
}

function financeScopeNote(limitation: string) {
  if (limitation.startsWith("Batch view")) return "Batch view excludes farm-wide costs not linked to this batch.";
  if (limitation.startsWith("Farm view")) return "Farm view includes batch-linked and general farm records.";
  return limitation;
}

function ActivityChart({ data }: { data: FarmSummaryAnalytics["activity"] }) {
  const max = Math.max(1, ...data.map((item) => item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents));
  const totals = data.map((item) => item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents);
  const hasActivity = totals.some((total) => total > 0);
  const totalEvents = totals.reduce((sum, total) => sum + total, 0);
  return <section className="min-h-[28rem] rounded-[1.75rem] bg-[#19382d] p-5 text-white sm:p-7" aria-labelledby="activity-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4c875]">Timeline</p><h2 id="activity-heading" className="mt-1 text-2xl font-semibold tracking-tight">Recorded activity</h2><p className="mt-1 text-sm text-white/60">Events and interventions across the selected window.</p></div><span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">{hasActivity ? `${totalEvents} events` : "No events"}</span></div>
    <div className="relative mt-8 flex min-h-64 items-end gap-1 overflow-hidden rounded-[1rem] bg-white/[0.045] px-4 pb-3 pt-6" aria-label="Recorded activity chart">
      {hasActivity ? <><div className="pointer-events-none absolute inset-x-4 top-1/4 border-t border-white/10" /><div className="pointer-events-none absolute inset-x-4 top-1/2 border-t border-white/10" /><div className="pointer-events-none absolute inset-x-4 top-3/4 border-t border-white/10" />{data.map((item, index) => { const total = totals[index]; return <div key={item.periodStart} className="group relative z-[1] flex h-full min-w-2 flex-1 items-end justify-center" title={item.label + ": " + total + " events"}><div className="w-full rounded-t-md bg-[#e6d26d] transition-colors group-hover:bg-[#f7e789]" style={{ height: total === 0 ? "0%" : String(Math.max(6, total / max * 100)) + "%" }} /></div>; })}</> : <div className="absolute inset-0 flex items-center justify-center"><p className="text-sm text-white/65">No activity recorded for this period.</p></div>}
    </div>
    <div className="mt-3 flex justify-between text-[11px] text-white/55"><span>{data[0]?.label ?? "No record"}</span><span>{data[data.length - 1]?.label ?? ""}</span></div>
    <details className="mt-5 text-xs"><summary className="w-fit cursor-pointer font-medium text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6d26d]">View event totals</summary><div className="mt-3 max-h-48 overflow-auto rounded-xl bg-white/10 px-3 py-2"><ChartTable rows={data.map((item) => ({ label: item.label, value: item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents }))} /></div></details>
  </section>;
}

function ChartTable({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return <Table className="w-full text-left"><TableBody>{rows.map((row) => <TableRow key={row.label} className="border-b last:border-0"><TableHead className="py-1 font-normal">{row.label}</TableHead><TableCell className="py-1 text-right tabular-nums">{row.value}</TableCell></TableRow>)}</TableBody></Table>;
}

function SignalsPanel({ events, incubation }: { events: FarmSummaryAnalytics["events"]; incubation: FarmSummaryAnalytics["incubation"] }) {
  return <section className="border-t border-border pt-7" aria-labelledby="signals-heading">
    <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Farm pulse / 02</p><h2 id="signals-heading" className="ledger-card-title mt-1 text-2xl sm:text-3xl">Health and incubation</h2><p className="mt-1 text-sm text-muted-foreground">Recorded care and hatch progress in this window.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[1.25rem] border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2"><HeartPulse className="size-5 text-primary" aria-hidden="true" /><h3 className="text-base font-semibold">Health records</h3></div><div className="mt-5 divide-y divide-border"><Fact label="Health concerns" value={count(events.healthConcerns)} /><Fact label="Interventions" value={count(events.interventions)} /><Fact label="Health-related deaths" value={count(events.healthRelatedDeaths)} /><Fact label="Other losses" value={count(events.otherLosses)} /></div></div>
      <div className="rounded-[1.25rem] border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" aria-hidden="true" /><h3 className="text-base font-semibold">Incubation</h3></div>{incubation.available ? <div className="mt-5 divide-y divide-border"><Fact label="Finalized hatch rate" value={incubation.finalizedHatchRatePercent == null ? "Pending" : incubation.finalizedHatchRatePercent + "%"} /><Fact label="Completed cycles" value={count(incubation.completedCycles)} /><Fact label="In progress" value={count(incubation.inProgressCycles)} /></div> : <div className="mt-5"><NoRecord /></div>}</div>
    </div>
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{value}</strong></div>;
}

function NoRecord() {
  return <p className="rounded-lg bg-warning-muted/60 px-3 py-2.5 text-sm text-warning-ink">No record for this period.</p>;
}
