"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { AuthBrandLink, BackToHomeLink } from "@/components/auth/auth-home-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordsMismatch = Boolean(confirmPassword) && password !== confirmPassword;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      confirmPasswordRef.current?.focus();
      toast.error("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await register({ fullName, email, password });
      toast.success("Account created! Welcome.");
      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to create account.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero banner */}
      <div className="flex flex-col items-center justify-center bg-primary px-6 py-8 text-primary-foreground">
        <div className="mb-4 w-full max-w-sm self-center">
          <BackToHomeLink className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground" />
        </div>
        <AuthBrandLink variant="hero" className="mb-1 flex-col gap-3 text-center" />
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
                <PasswordInput
                  id="password"
                  name="password"
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

            {/* Confirm password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm password</Label>
              <PasswordInput
                ref={confirmPasswordRef}
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                aria-invalid={passwordsMismatch}
                aria-describedby={passwordsMismatch ? "confirm-password-error" : undefined}
                placeholder="Re-enter your password"
                className="h-12 text-base rounded-xl"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordsMismatch && <p id="confirm-password-error" className="text-sm text-destructive">Passwords do not match.</p>}
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
