import { RouteGuard } from "@/components/route-guard";
import { AppShell } from "@/components/app-shell";

// Layout for the authenticated area: every page under (app) is gated by the
// auth guard and rendered inside the nav shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
