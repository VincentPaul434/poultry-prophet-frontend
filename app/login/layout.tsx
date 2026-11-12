import type { ReactNode } from "react";
import { GuestOnly } from "@/components/auth/guest-only";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
