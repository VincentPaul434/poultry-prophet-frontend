"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Save, UserPlus, Warehouse } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateInvite,
  useHandlers,
  useThresholds,
  useUpdateThreshold,
} from "@/hooks/use-reference";
import { useFarm, useUpdateFarm } from "@/hooks/use-farm";
import { useAuth } from "@/lib/auth-context";
import { accountApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Farm, InviteResponse, Threshold } from "@/lib/types";
import type { StoredUser } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

function initials(name: string | undefined) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

const THRESHOLD_LABELS: Record<string, { label: string; hint: string; icon: string }> = {
  BHI: { label: "Brooding Health", hint: "Overall health during brooding stage (0–100)", icon: "🌡️" },
  BSI: { label: "Behaviour Stress", hint: "Stress level from bird behavior signals (0–100)", icon: "😤" },
  WFR: { label: "Water vs. Feed", hint: "Ratio of water to feed intake", icon: "💧" },
  CRS: { label: "Readiness Score", hint: "Conditioning readiness for selection (0–100)", icon: "🏆" },
};

export default function SettingsPage() {
  const { isManager } = useAuth();
  const thresholds = useThresholds();
  const handlers = useHandlers(isManager);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isManager ? "Manage your farm alerts and handlers." : "View your farm's alert settings."}
        </p>
      </div>

      {/* Farm profile (manager only) */}
      {isManager && <FarmProfileSection />}

      {/* Handlers section (manager only) */}
      {isManager && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Farm Handlers</h2>
              <p className="text-xs text-muted-foreground">People who care for the birds</p>
            </div>
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
        </section>
      )}

      {/* Alert thresholds */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold">Alert Thresholds</h2>
          <p className="text-xs text-muted-foreground">
            {isManager
              ? "Set the ranges that trigger alerts. Outside these limits = alert sent."
              : "Alert ranges set by your manager."}
          </p>
        </div>

        {thresholds.isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        )}
        {thresholds.isError && (
          <p className="text-sm text-destructive">Failed to load thresholds.</p>
        )}
        {thresholds.data?.map((t) => (
          <ThresholdCard key={t.id} threshold={t} editable={isManager} />
        ))}
      </section>

      {/* Account section */}
      <AccountSection />
    </div>
  );
}

// ─── Farm profile setup ──────────────────────────────────────────────────────

function FarmProfileSection() {
  const farm = useFarm(true);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Warehouse className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold">Farm Profile</h2>
          <p className="text-xs text-muted-foreground">Your farm&apos;s name and details</p>
        </div>
      </div>

      {farm.isLoading ? (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}
        </div>
      ) : farm.isError ? (
        <p className="text-sm text-destructive">Failed to load farm profile.</p>
      ) : (
        farm.data && (
          // Keyed on the farm id so the form initialises from the loaded values
          // without syncing via an effect.
          <FarmProfileForm key={farm.data.id} farm={farm.data} />
        )
      )}
    </section>
  );
}

function FarmProfileForm({ farm }: { farm: Farm }) {
  const update = useUpdateFarm();
  const [name, setName] = useState(farm.name ?? "");
  const [location, setLocation] = useState(farm.location ?? "");
  const [description, setDescription] = useState(farm.description ?? "");

  const needsSetup = !farm.name?.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Farm name is required.");
      return;
    }
    try {
      await update.mutateAsync({
        name: name.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
      });
      toast.success("Farm profile configured successfully.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save farm profile");
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border bg-card p-4 space-y-4">
      {needsSetup && (
        <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          Finish setting up your farm to unlock the full dashboard.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="farm-name" className="font-semibold">
          Farm name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="farm-name"
          required
          placeholder="e.g. Sunrise Game Fowl Farm"
          className="h-11 rounded-xl"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="farm-location" className="font-semibold">Location</Label>
        <Input
          id="farm-location"
          placeholder="e.g. Batangas, Philippines"
          className="h-11 rounded-xl"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="farm-description" className="font-semibold">Description</Label>
        <Textarea
          id="farm-description"
          placeholder="A short description of your farm (optional)"
          className="rounded-xl"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          className="h-11 rounded-xl px-5 font-semibold"
          disabled={update.isPending || !name.trim()}
        >
          {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save farm profile
        </Button>
      </div>
    </form>
  );
}

// ─── Add handler dialog (direct creation) ────────────────────────────────────

function AddHandlerDialog() {
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
      // Trigger re-fetch of handlers list
      window.location.reload();
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

// ─── Invite handler dialog (token flow) ──────────────────────────────────────

function InviteHandlerDialog() {
  const createInvite = useCreateInvite();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [invite, setInvite] = useState<InviteResponse | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) { setEmail(""); setExpiresInDays("7"); setInvite(null); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const days = Number(expiresInDays);
    if (!Number.isFinite(days) || days < 1) {
      toast.error("Expiry must be at least 1 day.");
      return;
    }
    try {
      const result = await createInvite.mutateAsync({ email: email.trim(), expiresInDays: days });
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
      toast.success("Token copied!");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-9 rounded-xl"><UserPlus className="size-4" /> Invite</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite a handler</DialogTitle>
          <DialogDescription>Send a join invite to an existing handler account.</DialogDescription>
        </DialogHeader>
        {invite ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">Invite token — share this</Label>
              <div className="flex gap-2">
                <Input readOnly value={invite.token} className="font-mono text-xs h-11 rounded-xl" />
                <Button size="icon" variant="outline" className="size-11 rounded-xl shrink-0" onClick={copyToken}>
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(invite.expiresAt).toLocaleDateString()}.
              </p>
            </div>
            <DialogFooter showCloseButton />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-email" className="font-semibold">Handler email</Label>
              <Input id="inv-email" type="email" required placeholder="handler@example.com" className="h-11 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-exp" className="font-semibold">Expires after (days)</Label>
              <Input id="inv-exp" type="number" min={1} className="h-11 rounded-xl" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" className="rounded-xl" />}>Cancel</DialogClose>
              <Button type="submit" className="rounded-xl font-semibold" disabled={createInvite.isPending}>
                {createInvite.isPending && <Loader2 className="size-4 animate-spin" />}
                Create invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Threshold card ───────────────────────────────────────────────────────────

function ThresholdCard({ threshold, editable }: { threshold: Threshold; editable: boolean }) {
  const update = useUpdateThreshold();
  const [min, setMin] = useState(String(threshold.minValue));
  const [max, setMax] = useState(String(threshold.maxValue));

  useEffect(() => {
    setMin(String(threshold.minValue));
    setMax(String(threshold.maxValue));
  }, [threshold.minValue, threshold.maxValue]);

  const dirty = min !== String(threshold.minValue) || max !== String(threshold.maxValue);
  const meta = THRESHOLD_LABELS[threshold.indicator] ?? {
    label: threshold.indicator,
    hint: "",
    icon: "📊",
  };

  async function save() {
    if (Number(min) > Number(max)) { toast.error("Min cannot be greater than max."); return; }
    try {
      await update.mutateAsync({ id: threshold.id, body: { minValue: Number(min), maxValue: Number(max) } });
      toast.success(`${meta.label} threshold saved`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <p className="text-sm font-bold">{meta.label}</p>
            <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
          </div>
        </div>
        {threshold.farmId == null && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
            Global
          </span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Min</label>
          <Input
            type="number"
            step="0.1"
            className="h-11 rounded-xl text-center font-bold"
            value={min}
            disabled={!editable}
            onChange={(e) => setMin(e.target.value)}
          />
        </div>
        <div className="pb-3 text-muted-foreground font-bold">–</div>
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Max</label>
          <Input
            type="number"
            step="0.1"
            className="h-11 rounded-xl text-center font-bold"
            value={max}
            disabled={!editable}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
        {editable && (
          <Button
            size="sm"
            className="h-11 rounded-xl px-4 font-semibold"
            onClick={save}
            disabled={!dirty || update.isPending}
          >
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Account settings ────────────────────────────────────────────────────────

function AccountSection() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold">My Account</h2>
        <p className="text-xs text-muted-foreground">Your personal profile and password</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {initials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold truncate">{user.fullName}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {user.role === "MANAGER" ? "🏡 Farm Manager" : "🤲 Handler"}
            </p>
          </div>
        </div>

        {/* Keyed on user id so the form initialises from the loaded values. */}
        <ProfileForm key={user.userId} user={user} />
      </div>

      <PasswordForm />
    </section>
  );
}

function ProfileForm({ user }: { user: StoredUser }) {
  const { updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);

  const dirty = fullName !== user.fullName || email !== user.email;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ fullName: fullName.trim(), email: email.trim() });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <Label htmlFor="acct-name" className="font-semibold">Full name</Label>
        <Input
          id="acct-name"
          required
          className="h-11 rounded-xl"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="acct-email" className="font-semibold">Email</Label>
        <Input
          id="acct-email"
          type="email"
          required
          className="h-11 rounded-xl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Used to sign in. Changing it keeps you logged in.</p>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          className="h-11 rounded-xl px-5 font-semibold"
          disabled={!dirty || saving}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await accountApi.changePassword({ currentPassword: current, newPassword: next });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-bold">Change password</h3>
          <p className="text-xs text-muted-foreground">Use at least 8 characters</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-current" className="font-semibold">Current password</Label>
        <Input
          id="pw-current"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 rounded-xl"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-new" className="font-semibold">New password</Label>
        <Input
          id="pw-new"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-11 rounded-xl"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-confirm" className="font-semibold">Confirm new password</Label>
        <Input
          id="pw-confirm"
          type="password"
          required
          autoComplete="new-password"
          className="h-11 rounded-xl"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          className="h-11 rounded-xl px-5 font-semibold"
          disabled={saving || !current || !next || !confirm}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Change password
        </Button>
      </div>
    </form>
  );
}
