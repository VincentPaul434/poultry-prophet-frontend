"use client";

// Farm Handlers content (manager only): the handler roster plus the create and
// invite dialogs. Route access is guarded by the SettingsDetailShell.

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useHandlers } from "@/hooks/use-reference";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { initials } from "./sections";

export function HandlersSection() {
  const handlers = useHandlers(true);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">People who care for the birds</p>
        <AddHandlerDialog />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        {handlers.isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        )}
        {handlers.data && handlers.data.length === 0 && (
          <div className="py-10 text-center space-y-2">
            <p className="text-3xl">🤲</p>
            <p className="text-sm font-semibold">No handlers yet</p>
            <p className="text-xs text-muted-foreground">Add a handler to assign them to batches.</p>
          </div>
        )}
        {handlers.data && handlers.data.length > 0 && (
          <div>
            {handlers.data.map((h, idx) => (
              <div
                key={h.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  idx !== 0 && "border-t"
                )}
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {initials(h.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{h.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{h.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary uppercase tracking-wide">
                  Handler
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add handler dialog (direct creation) ────────────────────────────────────

function AddHandlerDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Uses the POST /api/handlers endpoint we built earlier
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem("pp_auth_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api"}/handlers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, password, fullName }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? "Failed to add handler");
      }
      toast.success(`${fullName} added as handler!`);
      setOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      // Refresh the roster from cache instead of a full page reload.
      queryClient.invalidateQueries({ queryKey: qk.handlers });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add handler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-9 rounded-xl px-4 font-semibold">
            <UserPlus className="size-4" />
            Add Handler
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a handler</DialogTitle>
            <DialogDescription>
              Create a handler account for someone on your farm. Share their login details with them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="h-name" className="font-semibold">Full name</Label>
              <Input
                id="h-name"
                required
                placeholder="e.g. Pedro Santos"
                className="h-11 rounded-xl"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-email" className="font-semibold">Email</Label>
              <Input
                id="h-email"
                type="email"
                required
                placeholder="handler@example.com"
                className="h-11 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-pass" className="font-semibold">Password</Label>
              <Input
                id="h-pass"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="h-11 rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Share this password with the handler so they can sign in.</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="rounded-xl" />}>
              Cancel
            </DialogClose>
            <Button type="submit" className="rounded-xl px-5 font-semibold" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Add handler
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
