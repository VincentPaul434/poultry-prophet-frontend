"use client";

// Shown to handlers who have unaccepted farm invites. Polls the
// /invites/pending endpoint and lets them accept inline; accepting re-saves the
// session (new farm scope) via the auth context.

import { useState } from "react";
import { Loader2, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { useDeclineInvite, usePendingInvites } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function PendingInvitesBanner() {
  const { isManager, acceptInvite } = useAuth();
  // Only handlers can be invited to a farm; skip the request for managers.
  const { data: invites } = usePendingInvites(!isManager);
  const declineInvite = useDeclineInvite();
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);

  if (isManager || !invites || invites.length === 0) return null;

  // One token may be mid-accept or mid-decline; lock all buttons until it settles.
  const busyToken = acceptingToken ?? declineInvite.variables ?? null;
  const busy = acceptingToken !== null || declineInvite.isPending;

  async function accept(token: string) {
    setAcceptingToken(token);
    try {
      await acceptInvite(token);
      toast.success("Invite accepted — welcome to the farm!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to accept invite");
    } finally {
      setAcceptingToken(null);
    }
  }

  async function decline(token: string) {
    try {
      await declineInvite.mutateAsync(token);
      toast.success("Invite declined");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to decline invite");
    }
  }

  return (
    <Alert className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-card to-card p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-400/20 blur-2xl" />
      <MailPlus />
      <AlertTitle className="text-base font-semibold">
        {invites.length === 1
          ? "You have a farm invite"
          : `You have ${invites.length} farm invites`}
      </AlertTitle>
      <AlertDescription className="text-sm">
        <p>Accept an invite to join the farm and start logging records.</p>
        <div className="mt-4 flex flex-col gap-3">
          {invites.map((invite) => (
            <div
              key={invite.token}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/80 px-4 py-3 shadow-sm"
            >
              <div className="text-sm">
                <span className="font-medium text-foreground">Farm #{invite.farmId}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · expires {new Date(invite.expiresAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full px-3"
                  onClick={() => decline(invite.token)}
                  disabled={busy}
                >
                  {declineInvite.isPending && busyToken === invite.token && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="rounded-full px-3"
                  onClick={() => accept(invite.token)}
                  disabled={busy}
                >
                  {acceptingToken === invite.token && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
