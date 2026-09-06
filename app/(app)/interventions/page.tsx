"use client";

import { useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import { InterventionQueue } from "@/components/interventions/intervention-queue";
import { useInterventions } from "@/hooks/use-interventions";
import { useBatches } from "@/hooks/use-batches";
import { useHandlers } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { InterventionStatus } from "@/lib/types";

const ACTIVE: InterventionStatus[] = ["PENDING", "ACKNOWLEDGED", "IN_PROGRESS", "ESCALATED"];

export default function InterventionsPage() {
  const { isManager } = useAuth();
  const interventions = useInterventions();
  const batches = useBatches();
  const handlers = useHandlers(isManager);
  const active = useMemo(() => (interventions.data ?? []).filter((item) => ACTIVE.includes(item.status)), [interventions.data]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-1"><h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl"><ClipboardCheck className="size-7 text-primary" />Interventions</h1><p className="text-sm text-muted-foreground">Turn alerts into clear, accountable field work.</p></div>
      {interventions.isLoading && <div className="space-y-3"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-36 rounded-2xl" /></div>}
      {interventions.isError && <Alert variant="destructive"><AlertTitle>Could not load interventions</AlertTitle><AlertDescription>Try again in a moment.</AlertDescription></Alert>}
      {interventions.data && <InterventionQueue interventions={active} batches={batches.data} handlers={handlers.data} />}
    </div>
  );
}
