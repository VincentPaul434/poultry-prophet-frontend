"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api-client";
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
          <Button type="submit" className="h-11" disabled={submitting}>
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
      </FieldGroup>
    </form>
  );
}
