"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useBatch } from "@/hooks/use-batches";
import { useBatchEvents } from "@/hooks/use-events";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EventTimeline } from "@/components/batch-log-section";

export default function EventHistoryPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: qk.batches.detail(batchId) }) > 0;
  const { data: batch } = useBatch(batchId);
  const { data: events, isLoading } = useBatchEvents(batchId, 100);

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Events</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {batch?.name ?? "Batch"} — full history of logged events
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-muted-foreground hover:text-foreground"
            onClick={refreshAll}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Full event timeline — read-only display for all roles */}
      <section className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <EventTimeline events={events ?? []} />
        )}
      </section>

    </div>
  );
}
