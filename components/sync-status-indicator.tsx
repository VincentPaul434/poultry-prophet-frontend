"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, CloudOff, Loader2, LockKeyhole, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A deliberately small field-friendly connection control.
 * The queue, retries, and conflict state remain in OfflineSyncProvider;
 * handlers only see the one action they can understand.
 */
export function SyncStatusIndicator() {
  const { snapshot, syncNow } = useOfflineSync();
  const { language } = useLocale();
  const taglish = language === "taglish";
  const [announcement, setAnnouncement] = useState("");
  const hasIssues = snapshot.issueCount > 0;
  const isBusy = snapshot.connection === "CHECKING" || snapshot.connection === "SYNCING";
  const pending = snapshot.pendingCount;
  const canAct = (pending > 0 && snapshot.connection !== "OFFLINE") || hasIssues || snapshot.connection === "AUTH_REQUIRED";

  const label = hasIssues
    ? snapshot.issueCount + (taglish ? " kailangang ayusin" : " needs help")
    : snapshot.connection === "AUTH_REQUIRED"
      ? (taglish ? "Mag-sign in para maipadala ang " : "Sign in to send ") + pending
      : snapshot.connection === "SYNCING"
        ? (taglish ? "Ipinapadala…" : "Sending…")
        : snapshot.connection === "CHECKING" || snapshot.connection === "SERVER_UNREACHABLE"
          ? (taglish ? "Kumokonekta…" : "Connecting…")
          : snapshot.connection === "OFFLINE"
            ? pending > 0
              ? pending + (taglish ? " naka-save sa phone" : " saved on phone")
              : "Offline"
            : pending > 0
              ? (taglish ? "I-sync " : "Sync ") + pending
              : "Online";

  const Icon = hasIssues
    ? AlertCircle
    : snapshot.connection === "OFFLINE"
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
  const color = hasIssues
    ? "text-destructive"
    : snapshot.connection === "OFFLINE" || pending > 0 || snapshot.connection === "AUTH_REQUIRED"
      ? "text-warning-ink"
      : "text-success";

  async function handleAction() {
    if (hasIssues) {
      const message = taglish
        ? "May record na hindi naipadala. Sabihan ang manager para ma-review."
        : "One record was not sent. Please ask the manager to review it.";
      setAnnouncement(message);
      toast.warning(message);
      return;
    }
    if (snapshot.connection === "AUTH_REQUIRED") {
      const message = taglish
        ? "Ligtas ang record sa phone. Mag-sign in ulit para maipadala."
        : "Your records are safe on this phone. Sign in again to send them.";
      setAnnouncement(message);
      toast.info(message);
      return;
    }
    await syncNow();
  }

  const content = (
    <>
      <span className="relative flex size-4 items-center justify-center">
        <Icon className={cn("size-4", color, isBusy && "animate-spin")} aria-hidden="true" />
      </span>
      <span className="max-w-[10rem] truncate">{label}</span>
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
          className="min-h-11 max-w-full gap-2 rounded-full bg-background/95 px-3 text-xs shadow-[var(--shadow-interactive-lift)]"
          aria-label={label}
        >
          {content}
        </Button>
      ) : (
        <div
          className="flex min-h-11 max-w-full items-center gap-2 rounded-full px-3 text-xs"
          role="status"
          aria-label={label}
        >
          {content}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}
