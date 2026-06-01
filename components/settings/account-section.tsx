"use client";

// Account Settings content: profile (full name + email) and change-password.
// The page-level title/breadcrumb live in the SettingsDetailShell.

import { useState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { accountApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { StoredUser } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "./sections";

export function AccountSection() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-4">
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
    </div>
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
        <Label htmlFor="acct-email" className="font-semibold">Email address</Label>
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
          Save changes
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
