"use client";

import { Suspense, use, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

export default function EventHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading event history…</div>}><EventHistoryPageContent params={params} searchParams={searchParams} /></Suspense>;
}

function EventHistoryPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { batchId } = use(params);
  const { from } = use(searchParams);
  const { isManager } = useAuth();
  const { t } = useLocale();
  const { data: batch } = useBatch(batchId);
  const { data: events, isLoading, isError } = useBatchEvents(batchId, 100, !isManager);

  const population = batch?.currentPopulation ?? 0;
  const origin = parseLoggingOrigin(from);
  const destination =
    origin === LOGGING_ORIGINS.dashboard
      ? LOGGING_ORIGINS.dashboard
      : origin === LOGGING_ORIGINS.batch
        ? LOGGING_ORIGINS.batch
        : isManager
          ? LOGGING_ORIGINS.batch
          : LOGGING_ORIGINS.dashboard;

  return (
    <div className={isManager ? "mx-auto flex h-full min-h-0 w-full max-w-[90rem] flex-col space-y-6" : "mx-auto max-w-xl space-y-6"}>

      {/* Header */}
      <div>
        {destination === LOGGING_ORIGINS.dashboard ? (
          <PageBackLink destination="dashboard" className="mb-3 rounded-xl" />
        ) : (
          <PageBackLink destination="batch" batchId={batchId} className="mb-3 rounded-xl" />
        )}
        <h1 className="text-2xl font-bold">{isManager ? "Event Log" : t("record.title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isManager
            ? `${batch?.name ?? "Batch"} — full history of logged events`
            : `${batch?.name ?? "Batch"} — choose what happened below`}
        </p>
      </div>

      {/* Log section — handlers only */}
      {!isManager && (
        <section id="log-event" className="scroll-mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <div><h2 className="text-base font-bold">{t("record.choose")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("record.optionalMeasurements")}</p></div>
          </div>
          <BatchLogSection batchId={batchId} population={population} batchName={batch?.name} stageName={batch?.stageName} />
        </section>
      )}

      {/* Secondary guidance uses progressive disclosure to keep the task focused. */}
      {!isManager && (
        <details className="group rounded-2xl bg-muted/50 p-4">
          <summary className="cursor-pointer list-none text-xs font-bold text-muted-foreground marker:content-none">
            <span className="flex items-center justify-between gap-3">
              How records work
              <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
            </span>
          </summary>
          <div className="mt-3 space-y-2 border-t pt-3 text-xs text-muted-foreground">
            {[
              { icon: "💀", text: "Population events → current / initial count and separate cause history" },
              { icon: "🤒", text: "Health concerns → factual health-event timeline; no diagnosis" },
              { icon: "💊", text: "Medicine and product use → recorded intervention history" },
              { icon: "👁️", text: "Behavior signs → observable notes that the manager can review" },
              { icon: "📋", text: "Optional readings → retained only when genuinely measured or estimated" },
            ].map((f) => (
              <div key={f.text} className="flex gap-2">
                <span className="shrink-0">{f.icon}</span>
                <span className="leading-snug">{f.text}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Manager analytics and event list; handlers retain the offline field timeline. */}
      {isManager ? <ManagerEventReport batchId={batchId} /> : <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">All events</h2>
        <div className="rounded-2xl border bg-card p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : isError && !events ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Event history could not be loaded. Reconnect and try again.</p>
          ) : (
            <EventTimeline events={events ?? []} />
          )}
        </div>
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
