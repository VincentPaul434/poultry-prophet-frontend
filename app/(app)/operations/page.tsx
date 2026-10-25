"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, Bird, WalletCards } from "lucide-react";
import { useBatches } from "@/hooks/use-batches";
import { useBatchComparison, useOperationsAnalytics } from "@/hooks/use-operations";
import type { AnalyticsScope, BatchComparison, FarmSummaryAnalytics } from "@/lib/farm-summary-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

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
  return new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function count(value: number | null | undefined) {
  return value == null ? "No record" : value.toLocaleString();
}

export default function OperationsPage() {
  return <Suspense fallback={<div className="mx-auto w-full max-w-6xl p-6 text-sm text-muted-foreground">Loading farm overview…</div>}><OperationsPageContent /></Suspense>;
}

type OverviewFilters = {
  scope: AnalyticsScope;
  batchId: string;
  start: string;
  end: string;
  origin: "REAL" | "SYNTHETIC" | "ALL";
};

function defaultOverviewFilters(): OverviewFilters {
  return { scope: "FARM", batchId: "", start: daysAgo(29), end: today(), origin: "REAL" };
}

function readOverviewFilters(searchParams: ReturnType<typeof useSearchParams>): OverviewFilters {
  const defaults = defaultOverviewFilters();
  const scope = searchParams.get("scope") === "BATCH" ? "BATCH" : "FARM";
  const origin = searchParams.get("origin");
  return {
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = readOverviewFilters(searchParams);
  const validation = process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "validation" || process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "local";
  const { scope, batchId, start, end, origin } = filters;
  const params = {
    scope,
    batchId: scope === "BATCH" && batchId ? Number(batchId) : undefined,
    start,
    end,
    origin,
  };
  const query = useOperationsAnalytics(params, scope === "FARM" || Boolean(batchId));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Farm overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Population, health, incubation, and recorded activity for manager review.</p>
      </header>

      <Card className="shadow-none">
        <CardContent className="grid gap-3 p-3 sm:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium">
            View
            <NativeSelect value={scope} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { scope: event.target.value as AnalyticsScope, batchId: "" })}>
              <option value="FARM">Whole farm</option>
              <option value="BATCH">One batch</option>
            </NativeSelect>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Batch
            <NativeSelect value={batchId} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { batchId: event.target.value })} disabled={scope !== "BATCH"}>
              <option value="">Choose a batch</option>
              {batches.filter((batch) => batch.status !== "ARCHIVED" && !batch.name.startsWith("[TEST COPY]")).map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </NativeSelect>
          </label>
          {validation && <label className="grid gap-1.5 text-sm font-medium">
            Data
            <NativeSelect value={origin} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { origin: event.target.value as OverviewFilters["origin"] })}>
              <option value="REAL">Real records</option>
              <option value="SYNTHETIC">Test records</option>
              <option value="ALL">All validation records</option>
            </NativeSelect>
          </label>}
          <label className="grid gap-1.5 text-sm font-medium">
            From
            <Input type="date" value={start} max={end} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { start: event.target.value })} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            To
            <Input type="date" value={end} min={start} onChange={(event) => updateOverviewUrl(router, pathname, searchParams, { end: event.target.value })} />
          </label>
        </CardContent>
      </Card>

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading summary…</p>}
      {query.isError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Summary is not available. Please try again.</p>}
      {scope === "BATCH" && !batchId && <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">Choose a batch to view its summary.</p>}
      {query.data && <Summary data={query.data} scope={scope} financeHref={financeHref(filters)} />}
      <BatchComparisonPanel batches={batches.filter((batch) => batch.status !== "ARCHIVED" && (origin === "ALL" || origin === "REAL" && !batch.name.startsWith("[TEST COPY]") || origin === "SYNTHETIC" && batch.name.startsWith("[TEST COPY]")))} origin={origin} />
    </div>
  );
}

function BatchComparisonPanel({ batches, origin }: { batches: Array<{ id: number; name: string; status: string }>; origin: "REAL" | "SYNTHETIC" | "ALL" }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const params = useMemo(() => ({ batchIds: selectedIds, windowDays, origin }), [origin, selectedIds, windowDays]);
  const query = useBatchComparison(params);
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 3 ? [...current.slice(1), id] : [...current, id]);
  return <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Compare batches</CardTitle><p className="text-sm text-muted-foreground">Same first-N-days window; descriptive only, no winner or score.</p></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[1fr_10rem]"><div className="flex flex-wrap gap-2">{batches.length === 0 ? <span className="text-sm text-muted-foreground">No batches available in this view.</span> : batches.map((batch) => <button key={batch.id} type="button" aria-pressed={selectedIds.includes(batch.id)} onClick={() => toggle(batch.id)} className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${selectedIds.includes(batch.id) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>{selectedIds.includes(batch.id) ? "✓ " : ""}{batch.name}</button>)}</div><label className="grid gap-1.5 text-sm font-medium">Common window<NativeSelect value={String(windowDays)} onChange={(event) => setWindowDays(Number(event.target.value))}><option value="30">First 30 days</option><option value="60">First 60 days</option><option value="90">First 90 days</option></NativeSelect></label></div>
    {selectedIds.length < 2 && <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">Choose two or three batches.</p>}
    {query.isLoading && <p className="text-sm text-muted-foreground">Preparing comparison…</p>}
    {query.isError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Comparison is not available for this selection.</p>}
    {query.data && <ComparisonTable data={query.data} />}
  </CardContent></Card>;
}

function ComparisonTable({ data }: { data: BatchComparison }) {
  return <div className="space-y-3"><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">First {data.effectiveWindowDays} days</Badge><span>All values are recorded facts; rates show their numerator and denominator.</span></div>{data.warnings.length > 0 && <div className="rounded-lg border border-warning/30 bg-warning-muted px-3 py-2 text-sm">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}<div className="overflow-x-auto rounded-xl border"><table className="min-w-[48rem] w-full text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Population</th><th className="px-3 py-2">Health deaths</th><th className="px-3 py-2">Health concerns</th><th className="px-3 py-2">Product records</th><th className="px-3 py-2">Selection</th></tr></thead><tbody>{data.batches.map((batch) => { const populationNeedsReview = batch.populationStatus === "RECONCILIATION_REQUIRED" || (batch.populationAtWindowEnd != null && batch.populationAtWindowEnd < 0); return <tr key={batch.batchId} className="border-t align-top"><th className="px-3 py-3 font-semibold">{batch.batchName}<span className="mt-1 block text-xs font-normal text-muted-foreground">{batch.bloodline ?? "Bloodline not recorded"}</span></th><td className="px-3 py-3 tabular-nums">{populationNeedsReview ? <span className="block max-w-44 text-warning-ink"><span className="font-semibold">Needs review</span><span className="block text-xs font-normal">Initial: {batch.initialPopulation}</span><span className="mt-1 block text-xs font-normal leading-snug">{batch.populationWarning ?? "Population records need review."}</span><Link className="mt-2 inline-block font-semibold underline underline-offset-2" href={`/batches/${batch.batchId}/data-entry?from=operations`}>Review records →</Link></span> : `${batch.populationAtWindowEnd ?? "No record"} / ${batch.initialPopulation}`}</td><td className="px-3 py-3 tabular-nums">{batch.healthRelatedDeaths}<span className="block text-xs text-muted-foreground">{batch.healthRelatedLossRatePercent == null ? "Rate unavailable" : `${batch.healthRelatedLossRatePercent}% of start`}</span></td><td className="px-3 py-3 tabular-nums">{batch.healthConcerns}</td><td className="px-3 py-3 tabular-nums">{batch.interventionRecords}</td><td className="px-3 py-3 tabular-nums">{batch.selectionDataStatus === "AVAILABLE" ? `${batch.acceptedAtSelection} / ${batch.evaluatedAtSelection}` : "No record"}</td></tr>; })}</tbody></table></div></div>;
}

function Summary({ data, scope, financeHref }: { data: FarmSummaryAnalytics; scope: AnalyticsScope; financeHref: string }) {
  const populationLabel = scope === "FARM" ? "Current birds" : "Birds in batch";
  const cards = [
    { icon: Bird, label: populationLabel, value: data.population.available ? count(data.population.currentPopulation) : "No record", hint: data.population.available ? count(data.population.initialPopulation) + " at start" : "No batch record" },
    { icon: Activity, label: "Health-related deaths", value: count(data.events.healthRelatedDeaths), hint: count(data.events.otherLosses) + " other losses" },
    { icon: Activity, label: "Health concerns", value: count(data.events.healthConcerns), hint: count(data.events.interventions) + " interventions" },
    { icon: Activity, label: "Recorded events", value: count(data.events.totalEvents), hint: count(data.events.healthConcerns) + " health concerns" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{data.startDate} – {data.endDate}{data.batchName ? " · " + data.batchName : ""}</span>
        <Badge variant="outline">{data.timeZone}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">Population is as of {data.population.asOfDate ?? data.endDate}; events and finance cover the selected period.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, hint }) => (
          <Card key={label} className="shadow-none"><CardContent className="p-4">
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><Icon className="size-4 text-primary" aria-hidden="true" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </CardContent></Card>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]"><ActivityChart data={data.activity} /><FinancialSnapshot data={data.finance} href={financeHref} /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <CompactCard title="Health and records"><Fact label="Health concerns" value={count(data.events.healthConcerns)} /><Fact label="Interventions" value={count(data.events.interventions)} /><Fact label="Recorded events" value={count(data.events.totalEvents)} /></CompactCard>
        <CompactCard title="Incubation">{data.incubation.available ? <><Fact label="Finalized hatch rate" value={data.incubation.finalizedHatchRatePercent == null ? "Pending" : data.incubation.finalizedHatchRatePercent + "%"} /><Fact label="Completed cycles" value={count(data.incubation.completedCycles)} /><Fact label="In progress" value={count(data.incubation.inProgressCycles)} /></> : <NoRecord />}</CompactCard>
      </div>
      {data.limitations.length > 0 && <details className="rounded-xl border bg-card px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Data notes</summary><ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">{data.limitations.map((note) => <li key={note}>{note}</li>)}</ul></details>}
    </>
  );
}

function FinancialSnapshot({ data, href }: { data: FarmSummaryAnalytics["finance"]; href: string }) {
  const netState = cashFlowState(data.net);
  const scopeNote = financeScopeNote(data.limitation);

  return <Card className="self-start shadow-none"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="size-4 text-primary" />Financial snapshot</CardTitle><p className="text-xs text-muted-foreground">Recorded cash for the selected period.</p></CardHeader><CardContent className="space-y-4">
    {data.available ? <>
      <div className="rounded-lg border bg-muted/20 px-3 py-3" aria-label={`Net cash flow ${money(data.net, data.currency)}. ${netState.label}.`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Net cash flow</p>
        <p className={`mt-1 whitespace-nowrap text-2xl font-bold tabular-nums ${netState.valueClassName}`}>{money(data.net, data.currency)}</p>
        <p className={`mt-1 text-xs font-medium ${netState.valueClassName}`}>{netState.label}</p>
      </div>
      <dl className="divide-y rounded-lg border">
        <FinanceMetric label="Income" value={money(data.income, data.currency)} valueClassName="text-success" />
        <FinanceMetric label="Cash expenses" value={money(data.expense, data.currency)} valueClassName="text-warning-ink" />
      </dl>
      <p className="text-[11px] leading-snug text-muted-foreground">{scopeNote}</p>
    </> : <NoRecord />}
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-3 text-xs text-muted-foreground"><span>{data.transactionCount} posted transaction{data.transactionCount === 1 ? "" : "s"} included</span><Link href={href} className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline">View Finance →</Link></div>
  </CardContent></Card>;
}

function FinanceMetric({ label, value, valueClassName }: { label: string; value: string; valueClassName: string }) {
  return <div className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"><dt className="min-w-0 text-muted-foreground">{label}</dt><dd className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${valueClassName}`}>{value}</dd></div>;
}

function cashFlowState(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return { label: "Status unavailable", valueClassName: "text-muted-foreground" };
  if (amount > 0) return { label: "Positive cash flow", valueClassName: "text-success" };
  if (amount < 0) return { label: "Negative cash flow", valueClassName: "text-destructive" };
  return { label: "Cash flow balanced", valueClassName: "text-muted-foreground" };
}

function financeScopeNote(limitation: string) {
  if (limitation.startsWith("Batch view")) return "Batch view excludes farm-wide costs not linked to this batch.";
  if (limitation.startsWith("Farm view")) return "Farm view includes batch-linked and general farm records.";
  return limitation;
}

function ActivityChart({ data }: { data: FarmSummaryAnalytics["activity"] }) {
  const max = Math.max(1, ...data.map((item) => item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents));
  return <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary" />Recorded activity</CardTitle></CardHeader><CardContent className="space-y-3">
    <div className="flex h-40 items-end gap-1 overflow-hidden border-b px-1 pt-4" aria-label="Recorded activity chart">{data.map((item) => { const total = item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents; return <div key={item.periodStart} className="group flex h-full min-w-2 flex-1 items-end justify-center" title={item.label + ": " + total + " events"}><div className="w-full rounded-t bg-primary/70 transition-[height] group-hover:bg-primary" style={{ height: String(Math.max(total > 0 ? 6 : 1, total / max * 100)) + "%" }} /></div>; })}</div>
    <div className="flex justify-between text-[11px] text-muted-foreground"><span>{data[0]?.label ?? "No record"}</span><span>{data[data.length - 1]?.label ?? ""}</span></div>
    <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">View event totals</summary><div className="mt-2 max-h-36 overflow-auto"><ChartTable rows={data.map((item) => ({ label: item.label, value: item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents }))} /></div></details>
  </CardContent></Card>;
}

function ChartTable({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return <table className="w-full text-left"><tbody>{rows.map((row) => <tr key={row.label} className="border-b last:border-0"><th className="py-1 font-normal">{row.label}</th><td className="py-1 text-right tabular-nums">{row.value}</td></tr>)}</tbody></table>;
}

function CompactCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="shadow-none"><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="space-y-2">{children}</CardContent></Card>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{value}</strong></div>;
}

function NoRecord() {
  return <p className="text-sm text-muted-foreground">No record for this period.</p>;
}
