"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, AuthCoordinationError, resetAbandonedAuthLock } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export function LoginForm({
  className,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit">) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [abandonedLock, setAbandonedLock] = useState(false);
  const [otherTabsClosed, setOtherTabsClosed] = useState(false);
  const [resettingLock, setResettingLock] = useState(false);
  const [lockMessage, setLockMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      toast.success("Maligayang pagbabalik!");
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof AuthCoordinationError && error.reason === "abandoned") {
        setAbandonedLock(true);
        setOtherTabsClosed(false);
        setLockMessage("");
      } else {
        const message = error instanceof AuthCoordinationError
          ? "Sign-in coordination is unavailable. Close other app tabs, check that browser storage is enabled, and try again."
          : error instanceof ApiError ? error.message : "Hindi makapag-sign in. Suriin ang email at password.";
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resetLock() {
    if (!otherTabsClosed) return;
    setResettingLock(true);
    try {
      const reset = await resetAbandonedAuthLock();
      if (reset) {
        setAbandonedLock(false);
        setOtherTabsClosed(false);
        setLockMessage("Sign-in lock reset. You can try signing in again.");
      } else setLockMessage("The lock is still in use. Close other app tabs, wait for sign-in requests to finish, then try again.");
    } catch {
      setLockMessage("The sign-in lock could not be reset. Check that browser storage is available and try again.");
    } finally { setResettingLock(false); }
  }

  return (
    <form {...props} onSubmit={onSubmit} className={cn("flex flex-col gap-6", className)}>
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="pangalan@email.com"
            className="h-11"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="Ilagay ang password"
            className="h-11"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field>
          <Button type="submit" className="h-11" disabled={submitting || resettingLock}>
            {submitting ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Nag-sign in…
              </>
            ) : (
              "Mag-sign in"
            )}
          </Button>
        </Field>
        {abandonedLock && <div role="alert" className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-5">
          <p className="font-semibold">Sign-in was interrupted</p>
          <p>Close all other Poultry Prophet tabs and wait for any sign-in requests to finish before resetting the sign-in lock. Your offline records will be kept.</p>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={otherTabsClosed} onChange={(event) => setOtherTabsClosed(event.target.checked)} />I closed the other Poultry Prophet tabs and sign-in requests have finished</label>
          <Button type="button" variant="outline" disabled={!otherTabsClosed || resettingLock} onClick={resetLock}>Reset sign-in lock</Button>
        </div>}
        {lockMessage && <p role="status" className="text-sm leading-5">{lockMessage}</p>}
      </FieldGroup>
    </form>
  );
}
