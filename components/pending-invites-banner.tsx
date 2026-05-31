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
    <Alert>
      <MailPlus />
      <AlertTitle>
        {invites.length === 1
          ? "You have a farm invite"
          : `You have ${invites.length} farm invites`}
      </AlertTitle>
      <AlertDescription>
        <p>Accept an invite to join the farm and start logging records.</p>
        <div className="flex flex-col gap-2">
          {invites.map((invite) => (
            <div
              key={invite.token}
              className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-medium text-foreground">Farm #{invite.farmId}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · expires {new Date(invite.expiresAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
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
