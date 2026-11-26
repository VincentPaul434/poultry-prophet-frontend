"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { Suspense, use, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ClipboardList, Info } from "lucide-react";
import { useBatch } from "@/hooks/use-batches";
import { useBatchEvents, useBatchEventPage, useBatchEventReport } from "@/hooks/use-events";
import { useHandlers } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { LOGGING_ORIGINS, parseLoggingOrigin } from "@/lib/logging-navigation";
import { shiftCalendarDate, todayIso } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBackLink } from "@/components/page-back-link";
import { BatchLogSection, EventTimeline } from "@/components/batch-log-section";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { EventTypeChart } from "@/components/event-type-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    view: view === "records" || view === "history" ? "records" : "report",
  };
}

function eventDates(filters: EventFilterState) {
  if (filters.period === "custom") return { start: filters.start, end: filters.end };
  const end = todayIso();
  return { start: shiftCalendarDate(end, -(filters.period === "7d" ? 6 : filters.period === "90d" ? 89 : 29)), end };
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
  const { display: displayText } = useDisplayLocale();
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">{displayText("Loading event history…")}</div>}><EventHistoryPageContent params={params} searchParams={searchParams} /></Suspense>;
}

function EventHistoryPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ from?: string | string[]; view?: string | string[] }>;
}) {
  const { display: displayText } = useDisplayLocale();
  const { batchId } = use(params);
  const { from, view } = use(searchParams);
  const { isManager } = useAuth();
  const { t } = useLocale();
  const { data: batch } = useBatch(batchId);
  const { data: events, isLoading, isError, refetch } = useBatchEvents(batchId, 100, !isManager);
  const [helpOpen, setHelpOpen] = useState(false);
  const [managerRecording, setManagerRecording] = useState(false);

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
    <div className={isManager ? "mx-auto flex w-full max-w-[90rem] flex-col space-y-6" : "mx-auto max-w-3xl space-y-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"}>

      {/* Header */}
      <div>
        {destination === LOGGING_ORIGINS.batch ? (
          <PageBackLink destination="batch" batchId={batchId} className="mb-3 rounded-xl" />
        ) : (
          <PageBackLink destination={destination} className="mb-3 rounded-xl" />
        )}
        {isManager || isHistoryView ? (
          <>
            <h1 className="text-2xl font-bold">{displayText("Event Log")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{batch?.name ?? "Batch"} {displayText("— logged events")}</p>
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

      {isManager && batch && batch.status !== "ARCHIVED" && <Button type="button" variant="outline" className="min-h-11 w-fit" onClick={() => setManagerRecording((open) => !open)}>{managerRecording ? displayText("Close") : displayText("Record event")}</Button>}

      {/* Archived batches remain browseable, but never accept new records. */}
      {!isManager && batch?.status === "ARCHIVED" && (
        <div role="status" className="rounded-2xl border border-warning-border bg-warning-muted px-4 py-3 text-sm text-warning-ink">
          {displayText("This batch is archived and read-only. Restore it before adding a new record.")}</div>
      )}

      {/* Log section — handlers only, for active batches */}
      {((!isManager && !isHistoryView) || (isManager && managerRecording)) && batch != null && batch.status !== "ARCHIVED" && (
        <section id="record-event" data-testid="record-event-section" className="scroll-mt-6 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("record.recordEvent")}</h2>
          <BatchLogSection batchId={batchId} population={population} batchName={batch?.name} stageName={batch?.stageName} />
        </section>
      )}

      {/* Secondary guidance uses progressive disclosure to keep the task focused. */}
      {!isManager && !isHistoryView && (
        <div className="rounded-2xl border bg-card">
          <Button variant="ghost"
            type="button"
            aria-expanded={helpOpen}
            aria-controls="recording-help"
            onClick={() => setHelpOpen((open) => !open)}
            className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <span className="flex items-center gap-2"><Info className="size-4 text-primary" aria-hidden="true" />{t("record.howRecordsWork")}</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${helpOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </Button>
          {helpOpen && <p id="recording-help" className="border-t px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">{t("record.howRecordsWorkDescription")}</p>}
        </div>
      )}

      {/* Manager analytics and event list; handlers retain the offline field timeline. */}
      {isManager ? <ManagerEventReport batchId={batchId} /> : <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("record.recentActivity")}</h2>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{events ? `${events.length} ${t("record.recordsCount")}` : ""}</span>
        </div>
        {isLoading ? (
          <div role="status" aria-busy="true" className="space-y-2" aria-label={displayText("Loading activity history")}>
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
  const { display: displayText } = useDisplayLocale();
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
  const report = useBatchEventReport(batchId, { ...commonParams, type: undefined });
  const records = useBatchEventPage(batchId, { ...commonParams, page: filters.page, size: 20 });
  const data = report.data;
  const rows = records.data?.items ?? [];

  const summaryMetrics = [
    { label: "Records", value: data?.totalRecords ?? "—" },
    { label: "Birds lost", value: data?.birdsLost ?? "—" },
    { label: "Health", value: data?.healthConcerns ?? "—", fullWidthOnMobile: true },
  ];
  return <div className="flex min-h-0 flex-1 flex-col space-y-4">
    <div className="flex gap-2 border-b pb-2 lg:hidden"><Button type="button" variant={filters.view === "report" ? "default" : "outline"} onClick={() => updateEventUrl(router, pathname, searchParams, { view: "report" })}>{displayText("Report")}</Button><Button type="button" variant={filters.view === "records" ? "default" : "outline"} onClick={() => updateEventUrl(router, pathname, searchParams, { view: "records" })}>{displayText("Records")}</Button></div>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/30 p-3">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{displayText("Report filters")}</span>
      <NativeSelect aria-label={displayText("Filter event period")} value={filters.period} onChange={(event) => updateEventUrl(router, pathname, searchParams, { period: event.target.value as EventFilterState["period"], page: 0 })}>
        <option value="7d">{displayText("Last 7 days")}</option><option value="30d">{displayText("Last 30 days")}</option><option value="90d">{displayText("Last 90 days")}</option><option value="custom">{displayText("Custom range")}</option>
      </NativeSelect>
      {filters.period === "custom" && <><Input aria-label={displayText("Event report start date")} type="date" value={filters.start ?? ""} onChange={(event) => updateEventUrl(router, pathname, searchParams, { start: event.target.value, page: 0 })} className="min-h-10 w-auto" /><Input aria-label={displayText("Event report end date")} type="date" value={filters.end ?? ""} onChange={(event) => updateEventUrl(router, pathname, searchParams, { end: event.target.value, page: 0 })} className="min-h-10 w-auto" /></>}
      <NativeSelect aria-label={displayText("Filter event type")} value={filters.type} onChange={(event) => updateEventUrl(router, pathname, searchParams, { type: event.target.value as EventFilterState["type"], page: 0 })}><option value="ALL">{displayText("All event types")}</option>{EVENT_TYPES.map((type) => <option key={type} value={type}>{eventLabel(type)}</option>)}</NativeSelect>
      <NativeSelect aria-label={displayText("Filter event handler")} value={filters.handlerId} onChange={(event) => updateEventUrl(router, pathname, searchParams, { handlerId: event.target.value, page: 0 })}><option value="ALL">{displayText("All handlers")}</option>{(handlers ?? []).map((handler) => <option key={handler.id} value={handler.id}>{handler.fullName}</option>)}</NativeSelect>
      <NativeSelect aria-label={displayText("Filter concern level")} value={filters.concern} onChange={(event) => updateEventUrl(router, pathname, searchParams, { concern: event.target.value as EventFilterState["concern"], page: 0 })}><option value="ALL">{displayText("All concern levels")}</option><option value="LOW">{displayText("Low")}</option><option value="MEDIUM">{displayText("Medium")}</option><option value="HIGH">{displayText("High")}</option><option value="UNRATED">{displayText("Unrated")}</option></NativeSelect>
      <Input aria-label={displayText("Search events")} placeholder={displayText("Search title or notes")} value={filters.search} onChange={(event) => updateEventUrl(router, pathname, searchParams, { search: event.target.value, page: 0 })} className="min-w-48 flex-1" />
      <Button type="button" variant={filters.populationOnly ? "default" : "outline"} onClick={() => updateEventUrl(router, pathname, searchParams, { populationOnly: !filters.populationOnly, page: 0 })}>{displayText("Population only")}</Button>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
      <div className={filters.view === "records" ? "hidden lg:block" : "min-h-0 space-y-4 pr-1"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{summaryMetrics.map(({ label, value, fullWidthOnMobile }) => <Card key={label} className={fullWidthOnMobile ? "col-span-2 shadow-none sm:col-span-1" : "shadow-none"}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></CardContent></Card>)}</div>
        <EventTypeChart distribution={data?.categoryDistribution ?? {}} selected={filters.type} loading={report.isLoading} error={report.isError} onRetry={() => void report.refetch()} onSelect={(type) => updateEventUrl(router, pathname, searchParams, { type: type as EventFilterState["type"], page: 0, view: "records" })} />
      </div>
      <div className={filters.view === "report" ? "hidden lg:flex lg:min-h-0 lg:min-w-0 lg:flex-col" : "flex min-h-0 min-w-0 flex-col"}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{filters.type === "ALL" ? "Event records" : eventLabel(filters.type)}</h2>{filters.type !== "ALL" && <Button size="sm" variant="outline" onClick={() => updateEventUrl(router, pathname, searchParams, { type: "ALL", page: 0 })}>{displayText("Clear type filter")}</Button>}</div>
        {records.isLoading && !records.data ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">{displayText("Loading events…")}</p> : records.isError && !records.data ? <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-muted/50 p-4 text-sm text-warning-ink"><span>{displayText("Could not load events.")}</span><Button type="button" size="sm" variant="outline" onClick={() => void records.refetch()}>{displayText("Try again")}</Button></div> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{displayText("No events match these filters.")}</p> : <>
          <p className="mt-3 text-xs text-muted-foreground">{displayText("Select an event for details. Scroll sideways to see all columns.")}</p>
          <div role="region" aria-label={displayText("Event records table")} tabIndex={0} className="mt-2 min-h-64 max-h-[60dvh] min-w-0 flex-1 overflow-auto rounded-xl border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:max-h-none">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="sticky top-0 z-20 bg-muted text-xs text-muted-foreground"><tr><th scope="col" className="sticky left-0 z-30 w-44 min-w-44 bg-muted px-3 py-3 font-semibold">{displayText("Event")}</th><th scope="col" className="px-3 py-3 font-semibold">{displayText("Date")}</th><th scope="col" className="px-3 py-3 font-semibold">{displayText("Type")}</th><th scope="col" className="px-3 py-3 text-right font-semibold">{displayText("Affected")}</th><th scope="col" className="px-3 py-3 font-semibold">{displayText("Concern")}</th></tr></thead>
              <tbody className="divide-y">{rows.map((event) => <tr key={event.id} className="hover:bg-muted/30"><th scope="row" className="sticky left-0 z-10 w-44 min-w-44 bg-card px-3 py-3 align-top font-semibold"><button type="button" className="min-h-11 w-full break-words text-left text-primary underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60" onClick={() => setSelected(event)}>{event.title}</button></th><td className="whitespace-nowrap px-3 py-3 align-top tabular-nums">{event.eventDate}</td><td className="min-w-36 px-3 py-3 align-top">{eventLabel(event.eventType)}</td><td className="px-3 py-3 text-right align-top tabular-nums">{event.affectedCount}</td><td className="whitespace-nowrap px-3 py-3 align-top">{eventLabel(event.concernLevel ?? "UNRATED")}</td></tr>)}</tbody>
            </table>
          </div>
        </>}
        {records.data && <div className="mt-3 flex shrink-0 items-center justify-between border-t pt-3 text-sm text-muted-foreground"><span>{records.data.totalItems} {displayText("records")}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={!records.data.hasPrevious} onClick={() => updateEventUrl(router, pathname, searchParams, { page: Math.max(0, filters.page - 1) })}>{displayText("Previous")}</Button><span>{records.data.page + 1}/{Math.max(1, records.data.totalPages)}</span><Button size="sm" variant="outline" disabled={!records.data.hasNext} onClick={() => updateEventUrl(router, pathname, searchParams, { page: filters.page + 1 })}>{displayText("Next")}</Button></div></div>}
      </div>
    </div>
    <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.title ?? "Event details"}</DialogTitle><DialogDescription>{displayText("Details recorded for this batch event.")}</DialogDescription></DialogHeader>{selected && <div className="space-y-2 text-sm"><p><strong>{displayText("Type:")}</strong> {selected.eventType.replaceAll("_", " ")}</p><p><strong>{displayText("Date:")}</strong> {selected.eventDate}</p><p><strong>{displayText("Handler:")}</strong> {selected.handlerName}</p><p><strong>{displayText("Concern:")}</strong> {selected.concernLevel ?? "UNRATED"} {selected.severityLabel ? `(${selected.severityLabel})` : ""}</p><p><strong>{displayText("Affected:")}</strong> {selected.affectedCount}</p>{selected.details && <p><strong>{displayText("Notes:")}</strong> {selected.details}</p>}</div>}</DialogContent></Dialog>
  </div>;
}
