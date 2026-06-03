"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bird, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFarmAlerts } from "@/hooks/use-analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
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
  // Unacknowledged alerts across the farm, driving the nav bell badge.
  const { data: activeAlerts } = useFarmAlerts(true, !!user);
  const unread = activeAlerts?.length ?? 0;
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You will be returned to the login screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={() => { setLogoutOpen(false); logout(); }}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/20">
            <Bird className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-foreground tracking-tight">
              Poultry Prophet
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
              {user?.role === "MANAGER" ? "Farm Manager" : "Handler"}
            </p>
          </div>
        </div>

        {/* Greeting */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-xs font-medium text-sidebar-foreground/60 leading-snug">
            {greeting(user?.fullName)}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const badge = href === "/alerts" ? unread : 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary/20 text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-5" />
                {label}
                {badge > 0 && (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile + logout */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar className="size-9 ring-2 ring-sidebar-primary/30">
              <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold">
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
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
              <Bird className="size-4 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight">Poultry Prophet</span>
          </div>
          <div className="flex items-center gap-1">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page content — extra bottom padding for the mobile nav */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </main>

        {/* ── Mobile bottom navigation ──────────────────────────── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t bg-card shadow-lg md:hidden"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const badge = href === "/alerts" ? unread : 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative">
                  <Icon
                    className={cn(
                      "size-5 transition-transform",
                      active && "scale-110"
                    )}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
                {active && (
                  <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
          {/* Sign out */}
          <button
            onClick={() => setLogoutOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="size-5" />
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}
