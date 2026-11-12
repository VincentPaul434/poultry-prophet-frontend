"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bird, ChevronDown, ChevronUp, ChevronsUpDown, ClipboardList, Egg, LayoutDashboard, LineChart, LogOut, MoreHorizontal, Package, Plus, Settings, UserCircle2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useFarmAlerts, useFarmAlertSummary } from "@/hooks/use-analytics";
import { useFarmRealtime } from "@/hooks/use-farm-realtime";
import { useFarm } from "@/hooks/use-farm";
import { useReleaseVersion } from "@/hooks/use-version";
import { getFarmDisplayName } from "@/lib/farm-display";
import { getBatchIdFromPathname, getLoggingHref, getLoggingOriginForPathname, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import type { TranslationKey } from "@/lib/i18n";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { MobileAppHeader } from "@/components/mobile-app-header";
import { RecordBatchPicker } from "@/components/record-batch-picker";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Sheet,
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
  { href: "/inputs", labelKey: "nav.products", icon: Package, managerOnly: true },
  { href: "/operations", labelKey: "nav.analytics", icon: LineChart, managerOnly: true },
  { href: "/finance", labelKey: "nav.finance", icon: WalletCards, managerOnly: true },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLocale();
  useFarmRealtime();
  const { data: activeAlerts } = useFarmAlerts(true, !!user);
  const { data: alertSummary } = useFarmAlertSummary(!!user);
  const previousAlerts = useRef<{ farmId: number | null; ids: Set<number> } | null>(null);
  const farm = useFarm(!!user && user.farmId != null);
  const release = useReleaseVersion(!!user);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const unread = alertSummary?.activeTotal ?? activeAlerts?.length ?? 0;
  const isDashboardRoute = pathname === "/dashboard";

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
        (alert.indicatorType !== "HEALTH_DEATH" && alert.indicatorType !== "ACCIDENTAL_DEATH" && alert.indicatorType !== "MORTALITY")
      ) {
        continue;
      }

      const count = alert.deathCount ?? 0;
      const label = alert.indicatorType === "ACCIDENTAL_DEATH"
        ? `${count} accidental death${count === 1 ? "" : "s"}`
        : `${count} bird${count === 1 ? "" : "s"} died`;
      const description = [alert.batchName, alert.handlerName, alert.cause]
        .filter(Boolean)
        .join(" · ");
      const notify = alert.severity === "CRITICAL" ? toast.error : toast.warning;
      notify(description ? `${label} · ${description}` : label, { id: `alert-${alert.id}` });
    }
  }, [activeAlerts, user?.farmId, user?.role]);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [pathname]);

  const farmName = getFarmDisplayName({
    farm: farm.data,
    farmId: user?.farmId,
    isError: farm.isError,
  });
  const frontendVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-validation";
  const frontendEnvironment = process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "local";
  const backendEnvironment = release.data?.environment ?? frontendEnvironment;
  const compatibilityMismatch = Boolean(
    release.data?.compatibleFrontendVersion &&
      release.data.compatibleFrontendVersion !== frontendVersion
  );

  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden md:h-screen">
      <Sidebar className="border-0">
        <SidebarHeader className="gap-0 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-foreground text-sidebar">
              <Bird className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {farmName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {user?.role === "MANAGER" ? t("role.manager") : t("role.handler")}
              </p>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/70" aria-hidden="true" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-3 py-3">
            <SidebarGroupLabel className="h-7 px-2 text-xs font-medium text-sidebar-foreground/60">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {NAV.filter((item) => item.managerOnly !== true || user?.role === "MANAGER").map(({ href, labelKey, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const badge = href === "/alerts" ? unread : 0;
                  const label = t(labelKey);

                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        render={<Link href={href} />}
                        isActive={active}
                        size="default"
                        className="rounded-lg px-2.5"
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

        <SidebarFooter className="gap-1 px-3 py-3">
          <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" aria-label="Open account menu" />}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <Avatar className="size-9 shrink-0 ring-2 ring-sidebar-primary/30">
                <AvatarFallback className="bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
                  {initials(user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-sidebar-foreground">
                  {user?.fullName}
                </span>
                <span className="block truncate text-xs text-sidebar-foreground/50">
                  {user?.email}
                </span>
              </span>
              {profileOpen ? (
                <ChevronUp className="size-4 shrink-0 text-sidebar-foreground/60" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-sidebar-foreground/60" aria-hidden="true" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings className="size-4" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setLogoutDialogOpen(true)}>
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      <HandlerProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        onSignOut={() => {
          setProfileOpen(false);
          setLogoutDialogOpen(true);
        }}
      />

      <SidebarInset className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
        <MobileAppHeader
          farmName={farmName}
          roleLabel={user?.role === "MANAGER" ? t("role.manager") : t("role.handler")}
          isManager={user?.role === "MANAGER"}
          fullName={user?.fullName}
          onProfileClick={() => setProfileOpen(true)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className={cn("shrink-0 px-4 sm:px-6 lg:px-8 xl:px-10", pathname === "/tasks" ? "pt-0" : "pt-3")}>
            <NetworkStatusBanner />
            <div className="mb-4 hidden justify-end md:flex"><SyncStatusIndicator /></div>
            {compatibilityMismatch && (
              <div className="mt-3 mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive md:mt-0" role="alert">
                Frontend/backend version mismatch. Frontend {frontendVersion}; backend expects {" "}{release.data?.compatibleFrontendVersion}.
              </div>
            )}
          </div>
          <div
            ref={contentScrollRef}
            data-testid={isDashboardRoute ? "dashboard-scroll-container" : undefined}
            className={cn(
              "safe-pb min-h-0 min-w-0 flex-1 overflow-y-auto",
              isDashboardRoute
                ? "px-4 pb-4 pt-0 sm:px-6 sm:pb-6 md:p-6 lg:p-8 xl:p-10"
                : "p-4 sm:p-6 md:pb-6 lg:p-8 xl:p-10",
            )}
          >
            {children}
            {pathname !== "/tasks" && <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
              Poultry Prophet {release.data?.version ?? frontendVersion} · {backendEnvironment}
              {release.data?.commitSha && release.data.commitSha !== "unknown" ? ` · ${release.data.commitSha.slice(0, 7)}` : ""}
            </footer>}
          </div>
        </div>
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
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const { t } = useLocale();
  const [recordOpen, setRecordOpen] = useState(false);
  const currentBatchId = getBatchIdFromPathname(pathname);
  const loggingOrigin = getLoggingOriginForPathname(pathname);
  const isLoggingPage = currentBatchId != null && pathname.startsWith(`/batches/${currentBatchId}/data-entry`);
  // Managers do not use the handler quick-log sheet. For handlers, fetch the
  // batch list only when the sheet is open instead of polling it globally from
  // every mounted application shell.

  function openRecord() {
    if (currentBatchId != null) {
      if (isLoggingPage) {
        const recordSection = document.getElementById("record-event") ?? document.getElementById("log-event");
        recordSection?.scrollIntoView({ behavior: "smooth", block: "start" });
        (recordSection?.querySelector("button") as HTMLButtonElement | null)?.focus({ preventScroll: true });
      } else {
        router.push(getLoggingHref(currentBatchId, LOGGING_ORIGINS.batch, true));
      }
      return;
    }
    setRecordOpen(true);
  }

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
        { href: "/alerts", labelKey: "nav.alerts", icon: Bell },
      ];

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 bg-card/95 shadow-[var(--shadow-mobile-dock)] backdrop-blur md:hidden"
      >
        <div className="safe-nav-pb mx-auto grid max-w-lg grid-cols-5 items-center gap-1 px-2 pt-2">
          {items.slice(0, 2).map((item) => <MobileNavLink key={item.href} item={item} pathname={pathname} unread={item.href === "/alerts" ? unread : 0} />)}

          {!isManager && (
            <Button
              type="button"
              size="lg"
              onClick={openRecord}
              className="-mt-6 flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-primary px-1 text-primary-foreground shadow-lg shadow-primary/25 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              aria-label={t("record.title")}
            >
              <Plus className="size-6" aria-hidden="true" />
              <span className="max-w-full truncate text-[11px] font-bold">{t("nav.record")}</span>
            </Button>
          )}

          {items.slice(2).map((item) => <MobileNavLink key={item.href} item={item} pathname={pathname} unread={item.href === "/alerts" ? unread : 0} />)}

          {isManager ? (
            <Button
              type="button"
              variant="ghost"
              onClick={toggleSidebar}
              className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              aria-label="Open more navigation options"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              <span className="text-xs font-semibold">{t("nav.more")}</span>
            </Button>
          ) : null}
        </div>
      </nav>

      {!isManager && <RecordBatchPicker open={recordOpen} onOpenChange={setRecordOpen} origin={loggingOrigin} />}
    </>
  );
}

function HandlerProfileSheet({
  open,
  onOpenChange,
  user,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ReturnType<typeof useAuth>["user"];
  onSignOut: () => void;
}) {
  if (!user || user.role !== "HANDLER") return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(88vw,22rem)] p-0">
        <SheetHeader className="px-5 py-6 pr-12">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/15 font-bold text-primary">{initials(user.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate">{user.fullName}</SheetTitle>
              <SheetDescription>Handler · {user.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="space-y-2 p-4">
          <Link
            href="/settings/account"
            onClick={() => onOpenChange(false)}
            className="flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <UserCircle2 className="size-5 text-primary" aria-hidden="true" />
            <span>My profile</span>
          </Link>
          <Link
            href="/settings"
            onClick={() => onOpenChange(false)}
            className="flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <Settings className="size-5 text-primary" aria-hidden="true" />
            <span>Settings</span>
          </Link>
          <Button type="button" variant="destructive" className="mt-4 min-h-12 w-full" onClick={onSignOut}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
