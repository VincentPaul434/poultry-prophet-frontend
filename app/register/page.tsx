"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

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
      compact
      eyebrow="Para sa farm manager"
      title="Simulan ang farm record."
      description="Gumawa ng manager account. Maaaring imbitahan ang handlers pagkatapos."
      footer={
        <>
          May account na?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            Mag-sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <FieldGroup className="gap-2.5 [@media(max-height:600px)]:gap-1.5">
          <Field className="gap-1.5 [@media(max-height:600px)]:gap-1">
            <FieldLabel htmlFor="fullName">Buong pangalan</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              autoFocus
              placeholder="Juan Dela Cruz"
              className="h-11"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </Field>

          <Field className="gap-1.5 [@media(max-height:600px)]:gap-1">
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="pangalan@email.com"
              className="h-11"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field className="gap-1.5 [@media(max-height:600px)]:gap-1">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="password-help"
              placeholder="Hindi bababa sa 8 characters"
              className="h-11"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FieldDescription id="password-help" className="text-xs [@media(max-height:600px)]:sr-only">Gumamit ng password na mahirap hulaan.</FieldDescription>
          </Field>

          <Field className="gap-1.5 [@media(max-height:600px)]:gap-1" data-invalid={passwordsMismatch || undefined}>
            <FieldLabel htmlFor="confirmPassword">Ulitin ang password</FieldLabel>
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
              className="h-11"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {passwordsMismatch && (
              <FieldError id="confirm-password-error">Hindi magkapareho ang password.</FieldError>
            )}
          </Field>

          <Field>
            <Button type="submit" className="h-11" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Ginagawa ang account…
                </>
              ) : (
                "Gumawa ng account"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
