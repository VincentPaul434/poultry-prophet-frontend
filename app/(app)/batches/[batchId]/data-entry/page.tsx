"use client";

import { use } from "react";
import { useBatch } from "@/hooks/use-batches";
import { useBatchEvents } from "@/hooks/use-events";
import { useAuth } from "@/lib/auth-context";
import { LOGGING_ORIGINS, parseLoggingOrigin } from "@/lib/logging-navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBackLink } from "@/components/page-back-link";
import { BatchLogSection, EventTimeline } from "@/components/batch-log-section";
import { useLocale } from "@/components/locale-provider";

export default function EventHistoryPage({
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
  const { data: events, isLoading } = useBatchEvents(batchId, 100);

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
    <div className="mx-auto max-w-xl space-y-6">

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
          <BatchLogSection batchId={batchId} population={population} />
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

      {/* Full event timeline — visible to all roles */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">All events</h2>
        <div className="rounded-2xl border bg-card p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            <EventTimeline events={events ?? []} />
          )}
        </div>
      </section>

    </div>
  );
}
