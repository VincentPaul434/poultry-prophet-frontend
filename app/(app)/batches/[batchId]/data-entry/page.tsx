"use client";

import { Suspense, use, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ClipboardList, Info } from "lucide-react";
import { useBatch } from "@/hooks/use-batches";
import { useBatchEvents, useBatchEventPage, useBatchEventReport } from "@/hooks/use-events";
import { useHandlers } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { LOGGING_ORIGINS, parseLoggingOrigin } from "@/lib/logging-navigation";
import { todayIso } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBackLink } from "@/components/page-back-link";
import { BatchLogSection, EventTimeline } from "@/components/batch-log-section";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { BatchEvent, EventType } from "@/lib/types";

const EVENT_TYPES: EventType[] = [
  "MORTALITY", "HEALTH_DEATH", "ACCIDENTAL_DEATH", "SUSPECTED_PREDATION", "CONFIRMED_PREDATION",
  "MISSING", "FOUND_RETURNED", "TRANSFER_OUT", "TRANSFER_IN", "SALE", "CULLING", "COUNT_CORRECTION",
  "HEALTH_CONCERN", "VACCINE_MEDICINE", "BEHAVIOR_OBSERVATION",
];

type EventFilterState = {
  period: "7d" | "30d" | "90d" | "custom";
  start?: string;
  end?: string;
  type: "ALL" | EventType;
  handlerId: string;
  concern: "ALL" | "LOW" | "MEDIUM" | "HIGH" | "UNRATED";
  search: string;
  populationOnly: boolean;
  page: number;
  view: "report" | "records";
};

function readEventFilters(searchParams: ReturnType<typeof useSearchParams>): EventFilterState {
  const period = searchParams.get("period");
  const type = searchParams.get("type");
  const concern = searchParams.get("concern");
  const view = searchParams.get("view");
  return {
    period: period === "7d" || period === "90d" || period === "custom" ? period : "30d",
    start: searchParams.get("start") ?? undefined,
    end: searchParams.get("end") ?? undefined,
    type: type && EVENT_TYPES.includes(type as EventType) ? type as EventType : "ALL",
    handlerId: searchParams.get("handlerId") ?? "ALL",
    concern: concern === "LOW" || concern === "MEDIUM" || concern === "HIGH" || concern === "UNRATED" ? concern : "ALL",
    search: searchParams.get("q") ?? "",
    populationOnly: searchParams.get("populationOnly") === "true",
    page: Math.max(0, Number(searchParams.get("page") ?? 0) || 0),
    view: view === "records" ? "records" : "report",
  };
}

function eventDates(filters: EventFilterState) {
  if (filters.period === "custom") return { start: filters.start, end: filters.end };
  const end = todayIso();
  const startDate = new Date(`${end}T00:00:00`);
  startDate.setDate(startDate.getDate() - (filters.period === "7d" ? 6 : filters.period === "90d" ? 89 : 29));
  return { start: startDate.toISOString().slice(0, 10), end };
}

function updateEventUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  current: ReturnType<typeof useSearchParams>,
  patch: Partial<EventFilterState>,
) {
  const next = { ...readEventFilters(current), ...patch };
  const params = new URLSearchParams(current.toString());
  const values: Record<string, string | undefined> = {
    period: next.period === "30d" ? undefined : next.period,
    start: next.period === "custom" ? next.start : undefined,
    end: next.period === "custom" ? next.end : undefined,
    type: next.type === "ALL" ? undefined : next.type,
    handlerId: next.handlerId === "ALL" ? undefined : next.handlerId,
    concern: next.concern === "ALL" ? undefined : next.concern,
    q: next.search.trim() || undefined,
    populationOnly: next.populationOnly ? "true" : undefined,
    page: next.page > 0 ? String(next.page) : undefined,
    view: next.view === "report" ? undefined : next.view,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
}

function eventLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function daysElapsed(startDate: string) {
  return Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000));
}

function stageLabel(stageName?: string) {
  const value = stageName?.replaceAll("-", " ").trim();
  return value ? value.replace(/(^|\s)\S/g, (character) => character.toUpperCase()) : null;
}

export default function EventHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ from?: string | string[]; view?: string | string[] }>;
}) {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading event history…</div>}><EventHistoryPageContent params={params} searchParams={searchParams} /></Suspense>;
}

function EventHistoryPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ from?: string | string[]; view?: string | string[] }>;
}) {
  const { batchId } = use(params);
  const { from, view } = use(searchParams);
  const { isManager } = useAuth();
  const { t } = useLocale();
  const { data: batch } = useBatch(batchId);
  const { data: events, isLoading, isError, refetch } = useBatchEvents(batchId, 100, !isManager);
  const [helpOpen, setHelpOpen] = useState(false);

  const population = batch?.currentPopulation ?? 0;
  const origin = parseLoggingOrigin(from);
  const isHistoryView = (Array.isArray(view) ? view[0] : view) === "history";
  const destination =
    isManager || origin === LOGGING_ORIGINS.batch
      ? LOGGING_ORIGINS.batch
      : origin ?? LOGGING_ORIGINS.dashboard;

  const batchStage = stageLabel(batch?.stageName);
  const batchDay = batch ? daysElapsed(batch.hatchDate ?? batch.startDate) : null;

  return (
    <div className={isManager ? "mx-auto flex h-full min-h-0 w-full max-w-[90rem] flex-col space-y-6" : "mx-auto max-w-3xl space-y-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"}>

      {/* Header */}
      <div>
        {destination === LOGGING_ORIGINS.batch ? (
          <PageBackLink destination="batch" batchId={batchId} className="mb-3 rounded-xl" />
        ) : (
          <PageBackLink destination={destination} className="mb-3 rounded-xl" />
        )}
        {isManager || isHistoryView ? (
          <>
            <h1 className="text-2xl font-bold">Event Log</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{batch?.name ?? "Batch"} — full history of logged events</p>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
              <ClipboardList className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold leading-tight">{t("record.title")}</h1>
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground" title={batch?.name ?? "Batch"}>
                {batch?.name ?? "Batch"}{batchStage ? ` · ${batchStage}` : ""}{batchDay !== null ? ` · Day ${batchDay}` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Archived batches remain browseable, but never accept new records. */}
      {!isManager && batch?.status === "ARCHIVED" && (
        <div role="status" className="rounded-2xl border border-warning-border bg-warning-muted px-4 py-3 text-sm text-warning-ink">
          This batch is archived and read-only. Restore it before adding a new record.
        </div>
      )}

      {/* Log section — handlers only, for active batches */}
      {!isManager && !isHistoryView && batch != null && batch.status !== "ARCHIVED" && (
        <section id="record-event" data-testid="record-event-section" className="scroll-mt-6 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("record.recordEvent")}</h2>
          <BatchLogSection batchId={batchId} population={population} batchName={batch?.name} stageName={batch?.stageName} />
        </section>
      )}

      {/* Secondary guidance uses progressive disclosure to keep the task focused. */}
      {!isManager && !isHistoryView && (
        <div className="rounded-2xl border bg-card">
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-controls="recording-help"
            onClick={() => setHelpOpen((open) => !open)}
            className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <span className="flex items-center gap-2"><Info className="size-4 text-primary" aria-hidden="true" />{t("record.howRecordsWork")}</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${helpOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {helpOpen && <p id="recording-help" className="border-t px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">{t("record.howRecordsWorkDescription")}</p>}
        </div>
      )}

      {/* Manager analytics and event list; handlers retain the offline field timeline. */}
      {isManager ? <ManagerEventReport batchId={batchId} /> : <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("record.activityHistory")}</h2>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{events ? `${events.length} ${t("record.recordsCount")}` : ""}</span>
        </div>
        {isLoading ? (
          <div className="space-y-2" aria-label="Loading activity history">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : isError && !events ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning-border bg-warning-muted/50 px-3.5 py-3 text-sm">
            <p className="text-warning-ink">{t("record.historyLoadError")}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>{t("record.tryAgain")}</Button>
          </div>
        ) : (
          <EventTimeline events={events ?? []} />
        )}
      </section>}

    </div>
  );
}

function ManagerEventReport({ batchId }: { batchId: string }) {
  const [selected, setSelected] = useState<BatchEvent | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = readEventFilters(searchParams);
  const dates = eventDates(filters);
  const { data: handlers } = useHandlers(true);
  const commonParams = {
    start: dates.start,
    end: dates.end,
    type: filters.type === "ALL" ? undefined : filters.type,
    handlerId: filters.handlerId === "ALL" ? undefined : Number(filters.handlerId),
    concernLevel: filters.concern === "ALL" ? undefined : filters.concern,
    search: filters.search.trim() || undefined,
    populationOnly: filters.populationOnly,
  };
  const report = useBatchEventReport(batchId, commonParams);
  const records = useBatchEventPage(batchId, { ...commonParams, page: filters.page, size: 20 });
  const data = report.data;
  const rows = records.data?.items ?? [];
  const max = Math.max(1, ...(data?.overTime ?? []).map((item) => item.count));
  return <div className="flex min-h-0 flex-1 flex-col space-y-4">
    <div className="flex gap-2 border-b pb-2 lg:hidden"><Button type="button" variant={filters.view === "report" ? "default" : "outline"} onClick={() => updateEventUrl(router, pathname, searchParams, { view: "report" })}>Report</Button><Button type="button" variant={filters.view === "records" ? "default" : "outline"} onClick={() => updateEventUrl(router, pathname, searchParams, { view: "records" })}>Records</Button></div>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/30 p-3">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Report filters</span>
      <NativeSelect aria-label="Filter event period" value={filters.period} onChange={(event) => updateEventUrl(router, pathname, searchParams, { period: event.target.value as EventFilterState["period"], page: 0 })}>
        <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="custom">Custom range</option>
      </NativeSelect>
      {filters.period === "custom" && <><Input aria-label="Event report start date" type="date" value={filters.start ?? ""} onChange={(event) => updateEventUrl(router, pathname, searchParams, { start: event.target.value, page: 0 })} className="min-h-10 w-auto" /><Input aria-label="Event report end date" type="date" value={filters.end ?? ""} onChange={(event) => updateEventUrl(router, pathname, searchParams, { end: event.target.value, page: 0 })} className="min-h-10 w-auto" /></>}
      <NativeSelect aria-label="Filter event type" value={filters.type} onChange={(event) => updateEventUrl(router, pathname, searchParams, { type: event.target.value as EventFilterState["type"], page: 0 })}><option value="ALL">All event types</option>{EVENT_TYPES.map((type) => <option key={type} value={type}>{eventLabel(type)}</option>)}</NativeSelect>
      <NativeSelect aria-label="Filter event handler" value={filters.handlerId} onChange={(event) => updateEventUrl(router, pathname, searchParams, { handlerId: event.target.value, page: 0 })}><option value="ALL">All handlers</option>{(handlers ?? []).map((handler) => <option key={handler.id} value={handler.id}>{handler.fullName}</option>)}</NativeSelect>
      <NativeSelect aria-label="Filter concern level" value={filters.concern} onChange={(event) => updateEventUrl(router, pathname, searchParams, { concern: event.target.value as EventFilterState["concern"], page: 0 })}><option value="ALL">All concern levels</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="UNRATED">Unrated</option></NativeSelect>
      <Input aria-label="Search events" placeholder="Search title or notes" value={filters.search} onChange={(event) => updateEventUrl(router, pathname, searchParams, { search: event.target.value, page: 0 })} className="min-w-48 flex-1" />
      <Button type="button" variant={filters.populationOnly ? "default" : "outline"} onClick={() => updateEventUrl(router, pathname, searchParams, { populationOnly: !filters.populationOnly, page: 0 })}>Population only</Button>
    </div>
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,1fr)]">
      <div className={filters.view === "records" ? "hidden lg:block" : "min-h-0 space-y-4 pr-1"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
          ["Records", data?.totalRecords ?? "—"], ["Birds lost", data?.birdsLost ?? "—"], ["Health", data?.healthConcerns ?? "—"], ["Movement", data?.populationMovements ?? "—"],
        ].map(([label, value]) => <Card key={label} className="shadow-none"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></CardContent></Card>)}</div>
        <Card className="shadow-none"><CardContent className="space-y-3 p-4"><div className="flex items-end justify-between"><div><p className="font-semibold">Events over time</p><p className="text-xs text-muted-foreground">All filtered records, not just the visible page.</p></div><Badge variant="outline">Deaths: {data?.deathRecords ?? "—"}</Badge></div><div className="flex h-36 items-end gap-1 border-b">{(data?.overTime ?? []).map((item) => <div key={item.date} title={`${item.date}: ${item.count}`} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(item.count > 0 ? 8 : 1, item.count / max * 100)}%` }} />)}</div><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Concern: {Object.entries(data?.concernDistribution ?? {}).map(([key, value]) => `${key} ${value}`).join(" · ") || "No data"}</span><span>Categories: {Object.keys(data?.categoryDistribution ?? {}).length}</span></div></CardContent></Card>
      </div>
      <div className={filters.view === "report" ? "hidden lg:flex lg:min-h-0 lg:flex-col" : "flex min-h-0 flex-col"}>
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{rows.map((event) => <button type="button" key={event.id} onClick={() => setSelected(event)} className="w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/50"><div className="flex items-start justify-between gap-2"><span className="font-semibold">{event.title}</span><span className="text-xs text-muted-foreground">{event.eventDate}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.eventType.replaceAll("_", " ")} · {event.affectedCount} affected · {event.concernLevel ?? "UNRATED"}</p></button>)}{rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No events match these filters.</p>}</div>
        {records.data && <div className="mt-3 flex shrink-0 items-center justify-between border-t pt-3 text-sm text-muted-foreground"><span>{records.data.totalItems} records</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={!records.data.hasPrevious} onClick={() => updateEventUrl(router, pathname, searchParams, { page: Math.max(0, filters.page - 1) })}>Previous</Button><span>{records.data.page + 1}/{Math.max(1, records.data.totalPages)}</span><Button size="sm" variant="outline" disabled={!records.data.hasNext} onClick={() => updateEventUrl(router, pathname, searchParams, { page: filters.page + 1 })}>Next</Button></div></div>}
      </div>
    </div>
    <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.title ?? "Event details"}</DialogTitle></DialogHeader>{selected && <div className="space-y-2 text-sm"><p><strong>Type:</strong> {selected.eventType.replaceAll("_", " ")}</p><p><strong>Date:</strong> {selected.eventDate}</p><p><strong>Handler:</strong> {selected.handlerName}</p><p><strong>Concern:</strong> {selected.concernLevel ?? "UNRATED"} {selected.severityLabel ? `(${selected.severityLabel})` : ""}</p><p><strong>Affected:</strong> {selected.affectedCount}</p>{selected.details && <p><strong>Notes:</strong> {selected.details}</p>}</div>}</DialogContent></Dialog>
  </div>;
}
