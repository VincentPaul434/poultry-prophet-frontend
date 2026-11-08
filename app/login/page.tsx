"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const fieldClass =
  "h-13 rounded-2xl border-[#173d2a]/15 bg-white pl-11 text-[0.95rem] text-[#173d2a] shadow-none placeholder:text-[#7b897f] focus-visible:border-[#28633f] focus-visible:ring-[#28633f]/18 dark:bg-white dark:text-[#173d2a]";
const passwordFieldClass = `${fieldClass} pr-12`;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      toast.success("Maligayang pagbabalik!");
      router.replace("/dashboard");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Hindi makapag-sign in. Suriin ang email at password.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Mag-sign in"
      title="Balikan ang iyong farm."
      description="Ilagay ang account na ginagamit mo sa Poultry Prophet."
      footer={
        <>
          Wala pang account?{" "}
          <Link href="/register" className="font-black text-[#28633f] underline-offset-4 hover:underline">
            Gumawa ng account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-black text-[#294b37]">Email address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#718077]" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="pangalan@email.com"
              className={fieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-black text-[#294b37]">Password</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 size-4.5 -translate-y-1/2 text-[#718077]" aria-hidden="true" />
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Ilagay ang password"
              className={passwordFieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="h-13 w-full rounded-2xl bg-[#173d2a] text-base font-black text-white shadow-[0_12px_25px_rgb(23_61_42_/_0.18)] hover:-translate-y-0.5 hover:bg-[#24583b]"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Nag-sign in…
            </>
          ) : (
            "Mag-sign in"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
