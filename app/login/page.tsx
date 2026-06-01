"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bird, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      toast.success("Welcome back!");
      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to sign in. Check your email and password.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero banner */}
      <div className="flex flex-col items-center justify-center bg-primary px-6 py-14 text-primary-foreground">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-white/15 mb-4 shadow-lg">
          <Bird className="size-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Poultry Prophet</h1>
        <p className="mt-1.5 text-sm text-primary-foreground/70 text-center max-w-xs">
          Game fowl batch tracker for your farm
        </p>
      </div>

      {/* Form card */}
      <div className="flex flex-1 items-start justify-center px-5 pt-8 pb-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Sign in</h2>
            <p className="text-sm text-muted-foreground">Enter your account details below.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email address
              </Label>
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
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="h-12 pl-10 text-base rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary hover:underline underline-offset-4"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
