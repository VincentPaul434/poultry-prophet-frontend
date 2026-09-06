"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bird, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Bird className="size-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl">Login to your account</CardTitle>
            <CardDescription>
              Enter your email below to login to Poultry Prophet
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "Login"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-2 border-t-0 bg-transparent p-4 pt-0 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </p>
            <p className="w-full border-t border-border pt-3 text-xs text-muted-foreground">
              Manage your farm, batches, and bird health in one place.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
