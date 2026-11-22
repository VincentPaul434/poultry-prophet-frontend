"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useReconcileBatchPopulation } from "@/hooks/use-batches";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { batchApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { getEventLogHref } from "@/lib/logging-navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/components/locale-provider";

export function PopulationReconciliationReview({ batchId }: { batchId: number }) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  const online = useNetworkStatus();
  const repair = useReconcileBatchPopulation();
  const diagnosis = useQuery({
    queryKey: ["batches", String(batchId), "population-diagnostics"],
    queryFn: () => batchApi.populationDiagnostics(batchId),
    enabled: open && online,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const data = diagnosis.data;

  async function confirmRepair() {
    if (!data?.canRepairStoredCount || !online || diagnosis.isFetching) return;
    try {
      await repair.mutateAsync({ batchId, expectedRevision: data.revision });
      setOpen(false);
      toast.success(t("population.repaired"));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("population.repairError");
      toast.error(message);
      await diagnosis.refetch();
    }
  }

  return <>
    <Button type="button" variant="outline" className="min-h-11 border-warning-border" onClick={() => setOpen(true)}>{t("population.review")}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("population.review")}</DialogTitle>
          <DialogDescription>{t("population.description")}</DialogDescription>
        </DialogHeader>
        {!online ? <p role="status">{t("population.offline")}</p>
          : diagnosis.isFetching ? <p role="status">{t("population.checking")}</p>
          : diagnosis.isError || !data ? <div role="alert" className="space-y-3"><p>{t("population.loadError")}</p><Button variant="outline" onClick={() => void diagnosis.refetch()}>{t("common.retry")}</Button></div>
          : <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <div><dt className="text-muted-foreground">{t("population.start")}</dt><dd className="font-semibold tabular-nums">{data.initialPopulation}</dd></div>
              <div><dt className="text-muted-foreground">{t("population.stored")}</dt><dd className="font-semibold tabular-nums">{data.storedPopulation}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">{t("population.calculated")}{!data.ledgerValid ? ` (${t("population.unverified")})` : ""}</dt><dd className="font-semibold tabular-nums">{data.calculatedPopulation ?? "—"}</dd></div>
            </dl>
            <div role="status" className="text-sm leading-relaxed">
              {data.status === "STORED_MISMATCH" ? <p>{t("population.mismatch")}</p>
                : data.status === "VALID" ? <p>{t("population.matches")}</p>
                : <p>{data.reason ?? t("population.invalid")}{data.firstInvalidEventDate ? ` ${t("population.firstIssue")}: ${formatDate(data.firstInvalidEventDate)}.` : ""}</p>}
            </div>
            <Link href={getEventLogHref(batchId)} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>{t("population.history")}</Link>
          </div>}
        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>{t("common.close")}</Button>
          {data?.canRepairStoredCount && <Button type="button" className="min-h-11" disabled={!online || diagnosis.isFetching || diagnosis.isError || repair.isPending} onClick={() => void confirmRepair()}>{repair.isPending ? t("population.updating") : t("population.repair")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
