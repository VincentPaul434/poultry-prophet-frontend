"use client";

import { AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { useReleaseVersion } from "@/hooks/use-version";
import { useLocale } from "@/components/locale-provider";

export function SyncReadinessBanner() {
  const { user, authRequired } = useAuth();
  const { snapshot } = useOfflineSync();
  const { data } = useReleaseVersion(Boolean(user) && !authRequired);
  const { t } = useLocale();
  const capability = data?.offlineCapabilities;
  if (!data || (capability?.commandReceipts && capability.schemaReady
    && capability.protocolVersions?.includes(2) && capability.receiptEntityTypes?.includes("BATCH_EVENT"))) return null;
  return <div role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2 text-xs leading-5 text-warning-ink">
    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <p><strong>{t("sync.unavailable")}</strong> {snapshot.pendingCount > 0 ? t("sync.recordsRetained") : t("sync.newRecordsRetained")}</p>
  </div>;
}
