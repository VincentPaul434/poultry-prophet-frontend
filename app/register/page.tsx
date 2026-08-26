"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bird, Loader2, Lock, Mail, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { inviteApi } from "@/lib/api";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  // Registration form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [role, setRole] = useState<Role>("MANAGER");
  const [submitting, setSubmitting] = useState(false);

  // Farm setup modal state (manager only)
  const [farmSetupOpen, setFarmSetupOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordError("");
    setSubmitting(true);
    try {
      await register({ fullName, email, password, role });
      toast.success("Account created! Welcome.");
      if (role === "MANAGER") {
        setFarmSetupOpen(true);
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to create account.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteApi.create({ email: inviteEmail.trim(), expiresInDays: 7 });
      toast.success(`Invite sent to ${inviteEmail.trim()}.`);
      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not send invite.";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  }

  function skipSetup() {
    setFarmSetupOpen(false);
    router.replace("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Farm setup modal — shown only for MANAGER after successful registration */}
      <Dialog open={farmSetupOpen} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 mb-1">
              <span className="text-2xl">🏡</span>
            </div>
            <DialogTitle className="text-lg font-bold">Set up your farm</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Your farm has been created automatically. Invite your first handler now so they can start logging daily records — or skip and do it later from Settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <Label htmlFor="inviteEmail" className="text-sm font-semibold">
              Handler&apos;s email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="inviteEmail"
                type="email"
                placeholder="handler@example.com"
                className="h-11 pl-10 rounded-xl"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                disabled={inviting}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              They will receive an invite link valid for 7 days. You can invite more handlers later.
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full h-11 rounded-xl font-semibold"
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="size-4 mr-2" />
                  Send invite &amp; continue
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full h-10 rounded-xl text-muted-foreground"
              onClick={skipSetup}
              disabled={inviting}
            >
              Skip for now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hero banner */}
      <div className="flex flex-col items-center justify-center bg-primary px-6 py-12 text-primary-foreground">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-white/15 mb-4 shadow-lg">
          <Bird className="size-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Poultry Prophet</h1>
        <p className="mt-1.5 text-sm text-primary-foreground/70 text-center max-w-xs">
          Create your account to start tracking
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-start justify-center px-5 pt-8 pb-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Create account</h2>
            <p className="text-sm text-muted-foreground">Fill in your details to get started.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Full name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-semibold">Full name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="fullName"
                  required
                  placeholder="Juan dela Cruz"
                  className="h-12 pl-10 text-base rounded-xl"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="h-12 pl-10 text-base rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="h-12 pl-10 text-base rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter your password"
                  className={cn("h-12 pl-10 text-base rounded-xl", passwordError && "border-destructive focus-visible:ring-destructive")}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                />
              </div>
              {passwordError && (
                <p className="text-xs text-destructive">{passwordError}</p>
              )}
            </div>

            {/* Role — visual card picker */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Your role</Label>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      value: "MANAGER" as Role,
                      emoji: "🏡",
                      title: "Manager",
                      desc: "Owns the farm, manages batches",
                    },
                    {
                      value: "HANDLER" as Role,
                      emoji: "🤲",
                      title: "Handler",
                      desc: "Cares for the birds daily",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={cn(
                      "rounded-xl border-2 p-4 text-left transition-all",
                      role === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted"
                    )}
                  >
                    <div className="text-2xl mb-1">{opt.emoji}</div>
                    <p className="text-sm font-semibold">{opt.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base rounded-xl font-semibold"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
