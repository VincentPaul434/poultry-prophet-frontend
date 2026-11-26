"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getSessionScope } from "@/lib/auth-storage";
import { useAuth } from "@/lib/auth-context";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useLocale } from "@/components/locale-provider";
import { refreshActiveFarmQueries } from "@/lib/live-refresh";
import { Button } from "@/components/ui/button";

export function DataRefreshControl() {
  const client = useQueryClient();
  const { authRequired } = useAuth();
  const { syncNow } = useOfflineSync();
  const online = useNetworkStatus();
  const { t } = useLocale();
  const busy = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (busy.current || !online || authRequired) return;
    const scope = getSessionScope();
    busy.current = true;
    setRefreshing(true);
    try {
      await syncNow();
      if (getSessionScope() === scope) await refreshActiveFarmQueries(client);
    } catch {
      if (getSessionScope() === scope) toast.error(t("refresh.failed"));
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }

  return <Button type="button" variant="outline" title={t("refresh.interval")} className="min-h-12 shrink-0 gap-2 rounded-xl px-4" disabled={refreshing || !online || authRequired} aria-busy={refreshing} onClick={() => void refresh()}>
    <RefreshCw aria-hidden="true" className={refreshing ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />
    {t(refreshing ? "refresh.refreshing" : "refresh.action")}
  </Button>;
}
