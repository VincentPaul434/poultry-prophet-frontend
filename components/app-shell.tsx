"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bird, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFarmAlerts } from "@/hooks/use-analytics";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
} from "@/components/ui/sidebar";

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
  const { data: activeAlerts } = useFarmAlerts(true, !!user);
  const unread = activeAlerts?.length ?? 0;

  return (
    <SidebarProvider className="md:h-screen md:min-h-0">
      <Sidebar>
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/20">
              <Bird className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                Poultry Prophet
              </p>
              <p className="truncate text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                {user?.role === "MANAGER" ? "Farm Manager" : "Handler"}
              </p>
            </div>
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
                {NAV.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const badge = href === "/alerts" ? unread : 0;

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
                onClick={logout}
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

      <SidebarInset className="min-h-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4 md:hidden">
          <SidebarTrigger />
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
              <Bird className="size-4 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight">Poultry Prophet</span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:pb-6 lg:p-8 xl:p-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
