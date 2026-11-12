"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, CloudOff, Loader2, LockKeyhole, RefreshCw, Wifi } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const recordLabels: Record<string, string> = {
  BATCH_EVENT: "Event",
  DAILY_RECORD: "Daily measurement",
  FARM_INPUT: "Farm input",
  SELECTION_SESSION: "Selection record",
  SELECTION_SESSION_UPDATE: "Selection update",
  SEX_COMPOSITION: "Sex composition",
  TASK_STATUS: "Task update",
  VACCINATION_PLAN: "Vaccination plan",
  VACCINATION_SCHEDULE: "Vaccination schedule",
};

/**
 * A deliberately small field-friendly connection control.
 * The queue, retries, and conflict state remain in OfflineSyncProvider;
 * handlers only see the one action they can understand.
 */
export function SyncStatusIndicator({ compact = false }: { compact?: boolean }) {
  const { snapshot, syncNow } = useOfflineSync();
  const router = useRouter();
  const { language, t } = useLocale();
  const taglish = language === "taglish";
  const [issuesOpen, setIssuesOpen] = useState(false);
  const hasIssues = snapshot.issueCount > 0;
  const issues = snapshot.items.filter((item) => item.status === "CONFLICT" || item.status === "REJECTED");
  const storageUnavailable = !snapshot.storageAvailable;
  const isBusy = snapshot.connection === "CHECKING" || snapshot.connection === "SYNCING";
  const pending = snapshot.pendingCount;
  const canAct = !storageUnavailable && ((pending > 0 && snapshot.connection !== "OFFLINE") || hasIssues || snapshot.connection === "AUTH_REQUIRED");
  const lastSync = snapshot.lastSuccessfulSync
    ? new Date(snapshot.lastSuccessfulSync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  const label = storageUnavailable
    ? t("status.offlineStorageUnavailable")
    : snapshot.connection === "AUTH_REQUIRED"
      ? (taglish ? "Mag-sign in para maipadala ang " : "Sign in to send ") + pending
      : hasIssues
      ? snapshot.issueCount + (taglish ? " kailangang ayusin" : " needs help")
      : snapshot.connection === "SYNCING"
        ? (taglish ? "Ipinapadala…" : "Sending…")
        : snapshot.connection === "CHECKING"
          ? (taglish ? "Kumokonekta…" : "Connecting…")
          : snapshot.connection === "SERVER_UNREACHABLE"
            ? pending > 0
              ? pending + (taglish ? " naka-save; walang server" : " saved; server unavailable")
              : t("status.serverUnavailable")
            : snapshot.connection === "OFFLINE"
              ? pending > 0
                ? pending + (taglish ? " naka-save sa phone" : " saved on phone") + (lastSync ? ` · ${lastSync}` : "")
                : (taglish ? "Offline" : "Offline") + (lastSync ? ` · ${lastSync}` : "")
              : pending > 0
                ? (taglish ? "I-sync " : "Sync ") + pending
                : "Online";

  const Icon = storageUnavailable || hasIssues
    ? AlertCircle
    : snapshot.connection === "OFFLINE" || snapshot.connection === "SERVER_UNREACHABLE"
      ? CloudOff
      : snapshot.connection === "AUTH_REQUIRED"
        ? LockKeyhole
        : isBusy
          ? Loader2
          : pending > 0
            ? RefreshCw
            : snapshot.connection === "ONLINE"
              ? CheckCircle2
              : Wifi;
  const color = storageUnavailable || hasIssues
    ? "text-destructive"
    : snapshot.connection === "OFFLINE" || snapshot.connection === "SERVER_UNREACHABLE" || pending > 0 || snapshot.connection === "AUTH_REQUIRED"
      ? "text-warning-ink"
      : "text-success";

  async function handleAction() {
    if (snapshot.connection === "AUTH_REQUIRED") {
      router.push("/login");
      return;
    }
    if (hasIssues) {
      setIssuesOpen(true);
      return;
    }
    await syncNow();
  }

  const content = (
    <>
      <span className="relative flex size-4 items-center justify-center">
        <Icon className={cn("size-4", color, isBusy && "animate-spin")} aria-hidden="true" />
      </span>
      <span className={cn("max-w-[10rem] truncate", compact && "hidden min-[390px]:inline max-w-[7rem]")}>{label}</span>
    </>
  );

  return (
    <>
      {canAct ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleAction()}
          disabled={isBusy || snapshot.connection === "OFFLINE"}
          className={cn(
            "min-h-11 max-w-full gap-2 rounded-full bg-background/95 text-xs shadow-[var(--shadow-interactive-lift)]",
            compact ? "min-w-11 justify-center px-2 min-[390px]:px-3" : "px-3"
          )}
          aria-label={label}
        >
          {content}
        </Button>
      ) : (
        <div
          className={cn(
            "flex min-h-11 max-w-full items-center gap-2 rounded-full text-xs",
            compact ? "min-w-11 justify-center px-2 min-[390px]:px-3" : "px-3"
          )}
          role="status"
          aria-label={label}
        >
          {content}
        </div>
      )}
      <Dialog open={issuesOpen} onOpenChange={setIssuesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{taglish ? "Mga record na kailangang ayusin" : "Records needing attention"}</DialogTitle>
            <DialogDescription>
              {taglish ? "Naka-save pa rin ang mga record sa device na ito. Ipakita ang dahilan sa manager; hindi pa ito naipapadala." : "These records remain saved on this device and have not been sent. Share the reason with your manager."}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-3">
            {issues.map((item) => (
              <li key={item.operationId} className="rounded-md border p-3">
                <p className="font-medium">{recordLabels[item.entityType] ?? "Record"} · Batch {item.batchId}</p>
                <p className="mt-1 text-muted-foreground">{item.lastErrorMessage || (taglish ? "Kailangan ng review bago maipadala." : "This record needs review before it can be sent.")}</p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
