"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateInvite,
  useHandlers,
  useThresholds,
  useUpdateThreshold,
} from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import type { InviteResponse, Threshold } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SettingsPage() {
  const { isManager } = useAuth();
  const thresholds = useThresholds();
  const handlers = useHandlers(isManager);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Alert thresholds and farm handlers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert thresholds</CardTitle>
          <CardDescription>
            Indicator bands that drive alerting. {isManager ? "Editable." : "Read-only."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {thresholds.isLoading && <Skeleton className="h-32 w-full rounded-lg" />}
          {thresholds.isError && (
            <p className="text-sm text-destructive">Failed to load thresholds.</p>
          )}
          {thresholds.data?.map((t) => (
            <ThresholdRow key={t.id} threshold={t} editable={isManager} />
          ))}
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Handlers</CardTitle>
              <CardDescription>Handlers assigned to your farm.</CardDescription>
            </div>
            <InviteHandlerDialog />
          </CardHeader>
          <CardContent>
            {handlers.isLoading && <Skeleton className="h-24 w-full rounded-lg" />}
            {handlers.data && handlers.data.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No handlers yet. Invite one to get started.
              </p>
            )}
            {handlers.data && handlers.data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {handlers.data.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.fullName}</TableCell>
                      <TableCell className="text-muted-foreground">{h.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InviteHandlerDialog() {
  const createInvite = useCreateInvite();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [invite, setInvite] = useState<InviteResponse | null>(null);

  // Reset transient form/result state whenever the dialog is reopened.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEmail("");
      setExpiresInDays("7");
      setInvite(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const days = Number(expiresInDays);
    if (!Number.isFinite(days) || days < 1) {
      toast.error("Expiry must be at least 1 day.");
      return;
    }
    try {
      const result = await createInvite.mutateAsync({
        email: email.trim(),
        expiresInDays: days,
      });
      setInvite(result);
      toast.success(`Invite created for ${result.email}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create invite");
    }
  }

  async function copyToken() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.token);
      toast.success("Invite token copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <UserPlus className="size-4" />
            Invite
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a handler</DialogTitle>
          <DialogDescription>
            Send an invite to join your farm. Share the generated token with the
            handler so they can accept it.
          </DialogDescription>
        </DialogHeader>

        {invite ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Invite token</Label>
              <div className="flex gap-2">
                <Input readOnly value={invite.token} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyToken}>
                  <Copy className="size-4" />
                  <span className="sr-only">Copy token</span>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {new Date(invite.expiresAt).toLocaleString()}.
            </p>
            <DialogFooter showCloseButton />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="handler@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-expiry">Expires in (days)</Label>
              <Input
                id="invite-expiry"
                type="number"
                min={1}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={createInvite.isPending}>
                {createInvite.isPending && <Loader2 className="size-4 animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ThresholdRow({
  threshold,
  editable,
}: {
  threshold: Threshold;
  editable: boolean;
}) {
  const update = useUpdateThreshold();
  const [min, setMin] = useState(String(threshold.minValue));
  const [max, setMax] = useState(String(threshold.maxValue));

  // Keep local inputs in sync if the cached threshold changes elsewhere.
  useEffect(() => {
    setMin(String(threshold.minValue));
    setMax(String(threshold.maxValue));
  }, [threshold.minValue, threshold.maxValue]);

  const dirty = min !== String(threshold.minValue) || max !== String(threshold.maxValue);

  async function save() {
    if (Number(min) > Number(max)) {
      toast.error("Min must not exceed max.");
      return;
    }
    try {
      await update.mutateAsync({
        id: threshold.id,
        body: { minValue: Number(min), maxValue: Number(max) },
      });
      toast.success(`${threshold.indicator} threshold saved`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="w-20">
        <p className="text-sm font-semibold">{threshold.indicator}</p>
        <p className="text-xs text-muted-foreground">
          {threshold.farmId == null ? "Global" : "Farm"}
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Min</label>
        <Input
          type="number"
          step="0.1"
          className="w-28"
          value={min}
          disabled={!editable}
          onChange={(e) => setMin(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Max</label>
        <Input
          type="number"
          step="0.1"
          className="w-28"
          value={max}
          disabled={!editable}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>
      {editable && (
        <Button size="sm" variant="outline" onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save
        </Button>
      )}
    </div>
  );
}
