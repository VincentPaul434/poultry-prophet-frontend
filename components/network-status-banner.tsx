"use client";

import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useLocale } from "@/components/locale-provider";

export function NetworkStatusBanner() {
  const isOnline = useNetworkStatus();
  const { t } = useLocale();

  if (isOnline) return null;

  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning-ink"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span><strong>{t("status.offlineTitle")}</strong> {t("status.offlineHint")}</span>
    </div>
  );
}
