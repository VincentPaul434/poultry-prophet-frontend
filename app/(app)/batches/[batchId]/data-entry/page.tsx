"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useBatch } from "@/hooks/use-batches";
import { useBatchEvents } from "@/hooks/use-events";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BatchLogSection, EventTimeline, VitalsStatus } from "@/components/batch-log-section";

export default function EventHistoryPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  const { isManager } = useAuth();
  const { data: batch } = useBatch(batchId);
  const { data: events, isLoading } = useBatchEvents(batchId, 100);

  const population = batch?.currentPopulation ?? 0;

  return (
    <div className="mx-auto max-w-xl space-y-6">

      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-3 gap-1.5 text-muted-foreground rounded-xl"
          nativeButton={false}
          render={<Link href={`/batches/${batchId}`} />}
        >
          <ArrowLeft className="size-4" /> Back to batch
        </Button>
        <h1 className="text-2xl font-bold">Event Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {batch?.name ?? "Batch"} — full history of logged events
        </p>
      </div>

      {/* Log section — handlers only */}
      {!isManager && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Log an event</h2>
            <VitalsStatus batchId={batchId} />
          </div>
          <BatchLogSection batchId={batchId} population={population} />
        </section>
      )}

      {/* How logs affect scores — handler context panel */}
      {!isManager && (
        <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How your logs affect health scores</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            {[
              { icon: "💀", text: "Deaths → Brooding Health (BHI) — most critical factor" },
              { icon: "🌡️", text: "Temperature → BHI — check daily during brooding" },
              { icon: "🍽️", text: "Feed & Water → BHI + Intake ratio" },
              { icon: "🤒", text: "Sickness events → Health History score" },
              { icon: "👁️", text: "Behavior signs → Behaviour Stress Index (BSI)" },
            ].map((f) => (
              <div key={f.text} className="flex gap-2">
                <span className="shrink-0">{f.icon}</span>
                <span className="leading-snug">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
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
