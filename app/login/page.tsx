import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Mag-sign in"
      title="Balikan ang iyong farm."
      description="Ilagay ang account na ginagamit mo sa Poultry Prophet."
      footer={
        <>
          Wala pang account?{" "}
          <Link href="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
            Gumawa ng account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
