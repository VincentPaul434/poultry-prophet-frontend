"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      confirmPasswordRef.current?.focus();
      toast.error("Hindi magkapareho ang password.");
      return;
    }

    setSubmitting(true);
    try {
      await register({ fullName, email, password });
      toast.success("Nagawa na ang iyong farm account!");
      router.replace("/dashboard");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Hindi magawa ang account. Subukan muli.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Para sa farm manager"
      title="Simulan ang farm record."
      description="Gumawa ng manager account. Maaaring imbitahan ang handlers pagkatapos."
      footer={
        <>
          May account na?{" "}
          <Link href="/login" className="font-black text-[#28633f] underline-offset-4 hover:underline">
            Mag-sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-black text-[#294b37]">Buong pangalan</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#718077]" aria-hidden="true" />
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              autoFocus
              placeholder="Juan Dela Cruz"
              className={fieldClass}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-black text-[#294b37]">Email address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#718077]" aria-hidden="true" />
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
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
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="password-help"
              placeholder="Hindi bababa sa 8 characters"
              className={passwordFieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <p id="password-help" className="text-xs font-medium text-[#718077]">Gumamit ng password na mahirap hulaan.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-black text-[#294b37]">Ulitin ang password</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 size-4.5 -translate-y-1/2 text-[#718077]" aria-hidden="true" />
            <PasswordInput
              ref={confirmPasswordRef}
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={passwordsMismatch}
              aria-describedby={passwordsMismatch ? "confirm-password-error" : undefined}
              placeholder="Ilagay muli ang password"
              className={passwordFieldClass}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {passwordsMismatch && (
            <p id="confirm-password-error" className="text-sm font-bold text-[#b42318]" role="alert">
              Hindi magkapareho ang password.
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="mt-2 h-13 w-full rounded-2xl bg-[#173d2a] text-base font-black text-white shadow-[0_12px_25px_rgb(23_61_42_/_0.18)] hover:-translate-y-0.5 hover:bg-[#24583b]"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Ginagawa ang account…
            </>
          ) : (
            "Gumawa ng account"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
