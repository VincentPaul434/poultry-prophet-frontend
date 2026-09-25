"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bird, ClipboardList, Egg, LayoutDashboard, LineChart, LogOut, MoreHorizontal, Package, Plus, Settings, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useBatches } from "@/hooks/use-batches";
import { useFarmAlerts } from "@/hooks/use-analytics";
import { useFarmRealtime } from "@/hooks/use-farm-realtime";
import { useFarm } from "@/hooks/use-farm";
import { useReleaseVersion } from "@/hooks/use-version";
import { getFarmDisplayName } from "@/lib/farm-display";
import { getLoggingHref, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import type { TranslationKey } from "@/lib/i18n";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NavItem = { href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; managerOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.home", icon: LayoutDashboard },
  { href: "/alerts", labelKey: "nav.alerts", icon: Bell },
  { href: "/incubation", labelKey: "nav.incubation", icon: Egg },
  { href: "/tasks", labelKey: "nav.tasks", icon: ClipboardList },
  { href: "/inputs", labelKey: "nav.products", icon: Package },
  { href: "/operations", labelKey: "nav.analytics", icon: LineChart, managerOnly: true },
  { href: "/finance", labelKey: "nav.finance", icon: WalletCards, managerOnly: true },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

function initials(name: string | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function greeting(name: string | undefined) {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name?.split(" ")[0] ?? "";
  return first ? `${salutation}, ${first}!` : salutation;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLocale();
  useFarmRealtime();
  const { data: activeAlerts } = useFarmAlerts(true, !!user);
  const previousAlerts = useRef<{ farmId: number | null; ids: Set<number> } | null>(null);
  const farm = useFarm(!!user && user.farmId != null);
  const release = useReleaseVersion(!!user);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const unread = activeAlerts?.length ?? 0;

  useEffect(() => {
    if (!activeAlerts || user?.farmId == null) return;

    const farmId = user.farmId;
    const previous = previousAlerts.current;
    const currentIds = new Set(activeAlerts.map((alert) => alert.id));
    previousAlerts.current = { farmId, ids: currentIds };

    if (!previous || previous.farmId !== farmId || user.role !== "MANAGER") return;

    for (const alert of activeAlerts) {
      if (
        previous.ids.has(alert.id) ||
        (alert.indicatorType !== "HEALTH_DEATH" && alert.indicatorType !== "MORTALITY")
      ) {
        continue;
      }

      const count = alert.deathCount ?? 0;
      const label = `${count} bird${count === 1 ? "" : "s"} died`;
      const description = [alert.batchName, alert.handlerName, alert.cause]
        .filter(Boolean)
        .join(" · ");
      const notify = alert.severity === "CRITICAL" ? toast.error : toast.warning;
      notify(description ? `${label} · ${description}` : label, { id: `alert-${alert.id}` });
    }
  }, [activeAlerts, user?.farmId, user?.role]);

  const farmName = getFarmDisplayName({
    farm: farm.data,
    farmId: user?.farmId,
    isError: farm.isError,
  });
  const frontendVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-validation";
  const frontendEnvironment = process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "local";
  const backendEnvironment = release.data?.environment ?? frontendEnvironment;
  const isValidation = backendEnvironment !== "production";
  const compatibilityMismatch = Boolean(
    release.data?.compatibleFrontendVersion &&
      release.data.compatibleFrontendVersion !== frontendVersion
  );

  return (
    <SidebarProvider className="md:h-screen md:min-h-0">
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border px-5 py-5">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/20">
              <Bird className="size-6 text-primary" />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/60">
              Poultry Prophet
            </p>
            <p className="mt-2 w-full truncate text-xl font-bold tracking-tight text-sidebar-foreground">
              {farmName}
            </p>
            <p className="mt-1 truncate text-xs uppercase tracking-widest text-sidebar-foreground/50">
              {user?.role === "MANAGER" ? t("role.manager") : t("role.handler")}
            </p>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <div className="px-4 pb-2 pt-5">
            <p className="text-xs font-medium leading-snug text-sidebar-foreground/60">
              {greeting(user?.fullName)}
            </p>
          </div>

          <SidebarGroup className="p-3 pt-0">
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((item) => item.managerOnly !== true || user?.role === "MANAGER").map(({ href, labelKey, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const badge = href === "/alerts" ? unread : 0;
                  const label = t(labelKey);

                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        render={<Link href={href} />}
                        isActive={active}
                        size="lg"
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {badge > 0 && (
                        <SidebarMenuBadge>
                          {badge > 99 ? "99+" : badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <Avatar className="size-9 ring-2 ring-sidebar-primary/30">
              <AvatarFallback className="bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
                {initials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {user?.fullName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/50">
                {user?.email}
              </p>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setLogoutDialogOpen(true)}
                size="lg"
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
                tooltip="Sign out"
              >
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          initialFocus={() => document.getElementById("logout-cancel")}
        >
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You will need to sign in again to access your farm data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button id="logout-cancel" variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={logout}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SidebarInset className="min-h-0 min-w-0">
        <header className="relative flex min-h-16 shrink-0 items-center justify-center border-b bg-card px-4 py-2 md:hidden">
          <SidebarTrigger className="absolute left-4 top-1/2 size-11 -translate-y-1/2" />
          <div className="flex flex-col items-center text-center leading-none">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15">
              <Bird className="size-5 text-primary" />
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Poultry Prophet
            </p>
            <p className="mt-1.5 max-w-[calc(100vw-5rem)] truncate text-base font-bold tracking-tight">
              {farmName}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
              {user?.role === "MANAGER" ? t("role.manager") : t("role.handler")}
            </p>
          </div>
        </header>

        <main className="safe-pb min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:pb-6 lg:p-8 xl:p-10">
          <NetworkStatusBanner />
          {isValidation && (
            <div
              className="mb-6 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              role="status"
            >
              <p className="font-semibold">{t("status.validation")} — {t("status.synthetic")}</p>
              <p className="mt-1 text-xs opacity-80">
                This workspace is for controlled stakeholder validation. Do not enter production
                records.
              </p>
            </div>
          )}
          {compatibilityMismatch && (
            <div
              className="mb-6 rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100"
              role="alert"
            >
              Frontend/backend version mismatch. Frontend {frontendVersion}; backend expects
              {" "}{release.data?.compatibleFrontendVersion}.
            </div>
          )}
          {children}
          <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
            Poultry Prophet {release.data?.version ?? frontendVersion} · {backendEnvironment}
            {release.data?.commitSha && release.data.commitSha !== "unknown"
              ? ` · ${release.data.commitSha.slice(0, 7)}`
              : ""}
          </footer>
        </main>
        <MobileBottomNav isManager={user?.role === "MANAGER"} unread={unread} />
      </SidebarInset>
    </SidebarProvider>
  );
}

type MobileNavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
};

function MobileBottomNav({ isManager, unread }: { isManager: boolean; unread: number }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { t } = useLocale();
  const { data: batches } = useBatches();
  const [recordOpen, setRecordOpen] = useState(false);

  const items: MobileNavItem[] = isManager
    ? [
        { href: "/dashboard", labelKey: "nav.home", icon: LayoutDashboard },
        { href: "/alerts", labelKey: "nav.alerts", icon: Bell },
        { href: "/finance", labelKey: "nav.finance", icon: WalletCards },
        { href: "/operations", labelKey: "nav.analytics", icon: LineChart },
      ]
    : [
        { href: "/dashboard", labelKey: "nav.home", icon: LayoutDashboard },
        { href: "/tasks", labelKey: "nav.tasks", icon: ClipboardList },
        { href: "/incubation", labelKey: "nav.incubation", icon: Egg },
      ];

  const activeBatches = (batches ?? []).filter((batch) => batch.status === "ACTIVE");

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 shadow-[0_-8px_24px_rgba(42,36,32,0.12)] backdrop-blur md:hidden"
      >
        <div className="safe-nav-pb mx-auto grid max-w-lg grid-cols-5 items-center gap-1 px-2 pt-2">
          {items.slice(0, 2).map((item) => <MobileNavLink key={item.href} item={item} pathname={pathname} unread={item.href === "/alerts" ? unread : 0} />)}

          {!isManager && (
            <button
              type="button"
              onClick={() => setRecordOpen(true)}
              className="-mt-6 flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-primary px-1 text-primary-foreground shadow-lg shadow-primary/25 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              aria-label={t("record.title")}
            >
              <Plus className="size-6" aria-hidden="true" />
              <span className="max-w-full truncate text-[11px] font-bold">{t("nav.record")}</span>
            </button>
          )}

          {items.slice(2).map((item) => <MobileNavLink key={item.href} item={item} pathname={pathname} />)}

          <button
            type="button"
            onClick={toggleSidebar}
            className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            aria-label="Open more navigation options"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            <span className="text-xs font-semibold">{t("nav.more")}</span>
          </button>
        </div>
      </nav>

      {!isManager && (
        <Sheet open={recordOpen} onOpenChange={setRecordOpen}>
          <SheetContent side="bottom" className="max-h-[82vh] rounded-t-3xl p-0">
            <SheetHeader className="border-b px-5 py-5">
              <SheetTitle>{t("record.title")}</SheetTitle>
              <SheetDescription>{t("record.choose")}</SheetDescription>
            </SheetHeader>
            <div className="safe-nav-pb space-y-3 overflow-y-auto p-5">
              {activeBatches.length === 0 && (
                <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  {t("common.noRecords")}
                </p>
              )}
              {activeBatches.map((batch) => (
                <SheetClose
                  key={batch.id}
                  render={
                    <Link
                      href={getLoggingHref(batch.id, LOGGING_ORIGINS.dashboard, true)}
                      className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                    />
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{batch.name}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{batch.currentPopulation} of {batch.initialPopulation} birds alive · {batch.stageName.replaceAll("-", " ")}</span>
                  </span>
                  <ClipboardList className="size-5 shrink-0 text-primary" aria-hidden="true" />
                </SheetClose>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function MobileNavLink({ item, pathname, unread = 0 }: { item: MobileNavItem; pathname: string; unread?: number }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const { t } = useLocale();
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        active ? "bg-primary/10 text-primary" : "hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className="max-w-full truncate text-[11px] font-semibold">{t(item.labelKey)}</span>
      {unread > 0 && <span className="absolute right-2 top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
