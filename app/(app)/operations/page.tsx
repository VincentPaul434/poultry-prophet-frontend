"use client";

import { useMemo, useState } from "react";
import { Activity, Bird, ClipboardList, WalletCards } from "lucide-react";
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
  const { data: batches = [] } = useBatches();
  const [scope, setScope] = useState<AnalyticsScope>("FARM");
  const [batchId, setBatchId] = useState("");
  const [start, setStart] = useState(daysAgo(29));
  const [end, setEnd] = useState(today());
  const validation = process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "validation" || process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "local";
  const [origin, setOrigin] = useState<"REAL" | "SYNTHETIC" | "ALL">("REAL");
  const params = useMemo(() => ({
    scope,
    batchId: scope === "BATCH" && batchId ? Number(batchId) : undefined,
    start,
    end,
    origin,
  }), [batchId, end, origin, scope, start]);
  const query = useOperationsAnalytics(params, scope === "FARM" || Boolean(batchId));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Farm summary</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recorded facts for a quick manager review.</p>
      </header>

      <Card className="shadow-none">
        <CardContent className="grid gap-3 p-3 sm:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium">
            View
            <NativeSelect value={scope} onChange={(event) => setScope(event.target.value as AnalyticsScope)}>
              <option value="FARM">Whole farm</option>
              <option value="BATCH">One batch</option>
            </NativeSelect>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Batch
            <NativeSelect value={batchId} onChange={(event) => setBatchId(event.target.value)} disabled={scope !== "BATCH"}>
              <option value="">Choose a batch</option>
              {batches.filter((batch) => batch.status !== "ARCHIVED" && !batch.name.startsWith("[TEST COPY]")).map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </NativeSelect>
          </label>
          {validation && <label className="grid gap-1.5 text-sm font-medium">
            Data
            <NativeSelect value={origin} onChange={(event) => setOrigin(event.target.value as "REAL" | "SYNTHETIC" | "ALL")}>
              <option value="REAL">Real records</option>
              <option value="SYNTHETIC">Test records</option>
              <option value="ALL">All validation records</option>
            </NativeSelect>
          </label>}
          <label className="grid gap-1.5 text-sm font-medium">
            From
            <Input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            To
            <Input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </CardContent>
      </Card>

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading summary…</p>}
      {query.isError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Summary is not available. Please try again.</p>}
      {scope === "BATCH" && !batchId && <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">Choose a batch to view its summary.</p>}
      {query.data && <Summary data={query.data} scope={scope} />}
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
  return <div className="space-y-3"><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">First {data.effectiveWindowDays} days</Badge><span>All values are recorded facts; rates show their numerator and denominator.</span></div>{data.warnings.length > 0 && <div className="rounded-lg border border-warning/30 bg-warning-muted px-3 py-2 text-sm">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}<div className="overflow-x-auto rounded-xl border"><table className="min-w-[48rem] w-full text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Population</th><th className="px-3 py-2">Health deaths</th><th className="px-3 py-2">Health concerns</th><th className="px-3 py-2">Product records</th><th className="px-3 py-2">Selection</th></tr></thead><tbody>{data.batches.map((batch) => <tr key={batch.batchId} className="border-t align-top"><th className="px-3 py-3 font-semibold">{batch.batchName}<span className="mt-1 block text-xs font-normal text-muted-foreground">{batch.bloodline ?? "Bloodline not recorded"}</span></th><td className="px-3 py-3 tabular-nums">{batch.populationAtWindowEnd} / {batch.initialPopulation}</td><td className="px-3 py-3 tabular-nums">{batch.healthRelatedDeaths}<span className="block text-xs text-muted-foreground">{batch.healthRelatedLossRatePercent == null ? "Rate unavailable" : `${batch.healthRelatedLossRatePercent}% of start`}</span></td><td className="px-3 py-3 tabular-nums">{batch.healthConcerns}</td><td className="px-3 py-3 tabular-nums">{batch.interventionRecords}</td><td className="px-3 py-3 tabular-nums">{batch.selectionDataStatus === "AVAILABLE" ? `${batch.acceptedAtSelection} / ${batch.evaluatedAtSelection}` : "No record"}</td></tr>)}</tbody></table></div></div>;
}

function Summary({ data, scope }: { data: FarmSummaryAnalytics; scope: AnalyticsScope }) {
  const populationLabel = scope === "FARM" ? "Current birds" : "Birds in batch";
  const net = data.finance.available ? money(data.finance.net, data.finance.currency) : "No record";
  const cards = [
    { icon: Bird, label: populationLabel, value: data.population.available ? count(data.population.currentPopulation) : "No record", hint: data.population.available ? count(data.population.initialPopulation) + " at start" : "No batch record" },
    { icon: Activity, label: "Health-related deaths", value: count(data.events.healthRelatedDeaths), hint: count(data.events.otherLosses) + " other losses" },
    { icon: WalletCards, label: "Net cash recorded", value: net, hint: data.finance.available ? money(data.finance.expense, data.finance.currency) + " expenses" : "No finance record" },
    { icon: ClipboardList, label: "Open tasks", value: count(data.tasks.open), hint: data.tasks.overdue > 0 ? data.tasks.overdue + " overdue" : "Nothing overdue" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{data.startDate} – {data.endDate}{data.batchName ? " · " + data.batchName : ""}</span>
        <Badge variant="outline">{data.timeZone}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, hint }) => (
          <Card key={label} className="shadow-none"><CardContent className="p-4">
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><Icon className="size-4 text-primary" aria-hidden="true" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2"><ActivityChart data={data.activity} /><CashFlowChart data={data.finance} /></div>
      <div className="grid gap-4 md:grid-cols-3">
        <CompactCard title="Health and records"><Fact label="Health concerns" value={count(data.events.healthConcerns)} /><Fact label="Interventions" value={count(data.events.interventions)} /><Fact label="Recorded events" value={count(data.events.totalEvents)} /></CompactCard>
        <CompactCard title="Incubation">{data.incubation.available ? <><Fact label="Finalized hatch rate" value={data.incubation.finalizedHatchRatePercent + "%"} /><Fact label="Completed cycles" value={count(data.incubation.completedCycles)} /><Fact label="In progress" value={count(data.incubation.inProgressCycles)} /></> : <NoRecord />}</CompactCard>
        <CompactCard title="Tasks and products"><Fact label="Completion" value={data.tasks.available ? data.tasks.completionRatePercent + "%" : "No record"} /><Fact label="Products recorded" value={count(Object.values(data.inputTypes).reduce((sum, value) => sum + value, 0))} /><Fact label="Active batches" value={count(data.population.activeBatches)} /></CompactCard>
      </div>
      {data.limitations.length > 0 && <details className="rounded-xl border bg-card px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Data notes</summary><ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">{data.limitations.map((note) => <li key={note}>{note}</li>)}</ul></details>}
    </>
  );
}

function ActivityChart({ data }: { data: FarmSummaryAnalytics["activity"] }) {
  const max = Math.max(1, ...data.map((item) => item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents));
  return <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary" />Recorded activity</CardTitle></CardHeader><CardContent className="space-y-3">
    <div className="flex h-40 items-end gap-1 overflow-hidden border-b px-1 pt-4" aria-label="Recorded activity chart">{data.map((item) => { const total = item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents; return <div key={item.periodStart} className="group flex h-full min-w-2 flex-1 items-end justify-center" title={item.label + ": " + total + " events"}><div className="w-full rounded-t bg-primary/70 transition-[height] group-hover:bg-primary" style={{ height: String(Math.max(total > 0 ? 6 : 1, total / max * 100)) + "%" }} /></div>; })}</div>
    <div className="flex justify-between text-[11px] text-muted-foreground"><span>{data[0]?.label ?? "No record"}</span><span>{data[data.length - 1]?.label ?? ""}</span></div>
    <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">View event totals</summary><div className="mt-2 max-h-36 overflow-auto"><ChartTable rows={data.map((item) => ({ label: item.label, value: item.healthConcerns + item.healthRelatedDeaths + item.otherLosses + item.interventions + item.otherEvents }))} /></div></details>
  </CardContent></Card>;
}

function CashFlowChart({ data }: { data: FarmSummaryAnalytics["finance"] }) {
  const max = Math.max(1, ...data.series.flatMap((item) => [Number(item.income), Number(item.expense)]));
  return <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="size-4 text-primary" />Cash flow</CardTitle></CardHeader><CardContent className="space-y-3">
    {data.available ? <div className="space-y-2" aria-label="Income and expense chart">{data.series.map((item) => <div key={item.periodStart} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 text-xs"><span className="text-muted-foreground">{item.label}</span><div className="space-y-1"><div className="h-2 rounded-full bg-success/70" style={{ width: String(Math.max(Number(item.income) > 0 ? 3 : 0, Number(item.income) / max * 100)) + "%" }} /><div className="h-2 rounded-full bg-warning/70" style={{ width: String(Math.max(Number(item.expense) > 0 ? 3 : 0, Number(item.expense) / max * 100)) + "%" }} /></div><span className="tabular-nums">{money(item.net, data.currency)}</span></div>)}</div> : <NoRecord />}
    <p className="text-xs text-muted-foreground">{data.limitation}</p>
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
