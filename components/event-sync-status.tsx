"use client";

import type { BatchEvent } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

export function EventSyncStatus({ status }: { status: BatchEvent["syncStatus"] }) {
  const { t } = useLocale();
  if (!status) return null;
  const key = status === "REJECTED" || status === "CONFLICT" ? "event.needsAttention"
    : status === "AUTH_REQUIRED" ? "event.signInToSync" : status === "SYNCING" ? "event.syncing" : "event.waitingToSync";
  return <p className="mt-1 text-xs font-medium text-warning-ink">{t(key)}</p>;
}
