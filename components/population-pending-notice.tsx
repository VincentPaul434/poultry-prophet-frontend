"use client";

import { CloudUpload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { pendingPopulation } from "@/lib/pending-population";
import { useLocale } from "@/components/locale-provider";

export function PopulationPendingNotice({ batchId, compact = false }: { batchId: number; compact?: boolean }) {
  const { user } = useAuth();
  const { snapshot } = useOfflineSync();
  const { t } = useLocale();
  if (!user?.farmId) return null;
  const pending = pendingPopulation(snapshot.items, user.userId, user.farmId, batchId);
  if (!pending.pendingRecords && !pending.issues) return null;

  return <div role="status" className="mt-2 flex items-start gap-2 text-xs leading-5 text-warning-ink">
    <CloudUpload className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div>
      {pending.pendingRecords > 0 && <p>{pending.deaths > 0 ? `${pending.deaths} ${t("population.pendingDeaths")}` : `${pending.pendingRecords} ${t("population.pendingRecords")}`}</p>}
      {pending.issues > 0 && <p>{pending.issues} {t("population.recordsNeedAttention")}</p>}
      {!compact && <p>{t("population.confirmedTotals")}</p>}
    </div>
  </div>;
}
