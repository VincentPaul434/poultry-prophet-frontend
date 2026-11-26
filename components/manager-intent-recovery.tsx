"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { listManagerIntents, MANAGER_INTENTS_CHANGED, type ManagerIntent, type ManagerIntentKind } from "@/lib/manager-intents";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useResolveManagerIntent } from "@/hooks/use-operations";
import { toast } from "sonner";

export function useManagerIntentRecovery<T>(kind: ManagerIntentKind) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.userId;
  const farmId = user?.farmId;
  const queryKey = ["manager-intents", userId, farmId, kind] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => listManagerIntents<T>({ userId: userId!, farmId: farmId!, kind }),
    enabled: Boolean(userId && farmId),
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["manager-intents", userId, farmId, kind] }); };
    window.addEventListener(MANAGER_INTENTS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener(MANAGER_INTENTS_CHANGED, refresh); window.removeEventListener("focus", refresh); };
  }, [queryClient, userId, farmId, kind]);
  return { intents: query.data ?? [], ready: Boolean(userId && farmId) && query.isSuccess && !query.isError, isError: query.isError };
}

export function ManagerIntentRecovery<T>({ intents, ready, isError, describe, retry, busy }: {
  intents: ManagerIntent<T>[];
  ready: boolean;
  isError: boolean;
  describe: (intent: ManagerIntent<T>) => string;
  retry: (intent: ManagerIntent<T>) => Promise<unknown>;
  busy: boolean;
}) {
  const { display } = useLocale();
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState<ManagerIntent<T> | null>(null);
  const resolve = useResolveManagerIntent();
  if (!ready) return <p role={isError ? "alert" : "status"} className="text-sm text-muted-foreground">{display(isError ? "Could not read saved requests. Check device storage and try again." : "Checking saved requests…")}</p>;
  if (intents.length === 0) return null;
  return <div className="space-y-2 rounded-xl border border-warning-border bg-warning-muted/60 p-3 text-sm" role="status">
    <p className="font-semibold">{display("A previous request has an unknown outcome. Review and retry the original details.")}</p>
    {intents.map((intent) => <div key={intent.operationId} className="space-y-2 rounded-lg border bg-background p-3"><p className="break-words">{describe(intent)}</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || resolve.isPending} onClick={() => { setError(""); void retry(intent).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : display("Could not retry the request."))); }}>{display("Retry previous request")}</Button><Button type="button" size="sm" variant="outline" disabled={busy || resolve.isPending} onClick={() => { setError(""); setStopping(intent); }}>{display("Stop previous request")}</Button></div></div>)}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Dialog open={stopping != null} onOpenChange={(open) => { if (!open && !resolve.isPending) setStopping(null); }}><DialogContent><DialogHeader><DialogTitle>{display("Stop this request?")}</DialogTitle><DialogDescription>{display("The server will check the original request. If it was already saved, it stays saved. Otherwise, it will be stopped and cannot be saved later. This needs a connection.")}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" disabled={resolve.isPending} onClick={() => setStopping(null)}>{display("Go back")}</Button><Button type="button" disabled={resolve.isPending} onClick={() => { if (!stopping) return; setError(""); void resolve.mutateAsync(stopping).then((result) => { setStopping(null); toast.success(display(result.status === "APPLIED" ? "The original request was already saved." : "The original request was stopped.")); }).catch((failure: unknown) => { setStopping(null); setError(failure instanceof Error ? failure.message : display("Could not stop the request. It is still saved on this device.")); }); }}>{display("Confirm stop")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
