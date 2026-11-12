"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { LayoutDashboard, LogIn, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/components/landing/brand-mark";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { id: "tungkol", label: "Tungkol" },
  { id: "mga-tala", label: "Mga tala" },
  { id: "para-kanino", label: "Para kanino" },
  { id: "faq", label: "FAQ" },
] as const;

type SectionId = (typeof NAV_LINKS)[number]["id"];

function initials(name: string | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PP";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Tracks which landing section sits under the reading line near the top of the viewport. */
function useActiveSection() {
  const [active, setActive] = useState<SectionId | null>(null);

  useEffect(() => {
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        setActive(NAV_LINKS.find((link) => visible.get(link.id))?.id ?? null);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    for (const link of NAV_LINKS) {
      const section = document.getElementById(link.id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

function AccountArea() {
  const { user, isAuthenticated, isLoading, authRequired, logout } = useAuth();

  if (isLoading) {
    return <Skeleton className="size-10 rounded-full bg-(--pp-mist)" aria-hidden="true" />;
  }

  if (isAuthenticated && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              className="size-11 rounded-full p-0 animate-in fade-in zoom-in-95 duration-300 hover:bg-(--pp-mist)"
              aria-label={`Account menu ni ${user.fullName}`}
            />
          }
        >
          <Avatar className="size-10 after:border-(--pp-green)/20">
            <AvatarFallback className="bg-(--pp-green) text-sm font-medium text-(--pp-lime)">
              {initials(user.fullName)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
              <span className="truncate text-sm font-medium text-foreground">{user.fullName}</span>
              <span className="truncate text-xs font-normal">{user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/dashboard" />}>
              <LayoutDashboard aria-hidden="true" />
              Pumunta sa dashboard
            </DropdownMenuItem>
            {authRequired && (
              <DropdownMenuItem render={<Link href="/login" />}>
                <LogIn aria-hidden="true" />
                Mag-sign in muli
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
            <LogOut aria-hidden="true" />
            Mag-sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-2 animate-in fade-in duration-300">
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "ghost" }), "hidden h-10 rounded-full px-4 text-[15px] text-(--pp-ink) hover:bg-(--pp-mist) sm:inline-flex")}
      >
        Mag-sign in
      </Link>
      <Link
        href="/register"
        className={cn(buttonVariants(), "h-10 rounded-full border border-(--pp-green) bg-(--pp-lime) px-5 text-[15px] font-medium text-(--pp-green) hover:bg-(--pp-lime-strong)")}
      >
        Magsimula
      </Link>
    </div>
  );
}

export function LandingNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const active = useActiveSection();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingTarget = useRef<SectionId | null>(null);
  const linkRefs = useRef(new Map<SectionId, HTMLAnchorElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const measure = useCallback(() => {
    const link = active ? linkRefs.current.get(active) : null;
    if (link) setIndicator({ left: link.offsetLeft, width: link.offsetWidth });
  }, [active]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const scrollToSection = (id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  const onDesktopNav = (event: MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    event.preventDefault();
    scrollToSection(id);
  };

  const onMobileNav = (event: MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    event.preventDefault();
    pendingTarget.current = id;
    setMenuOpen(false);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-(--pp-green)/10 bg-(--pp-paper)/85 shadow-[0_8px_24px_rgb(20_51_32/0.08)] backdrop-blur-md"
          : "border-transparent bg-(--pp-paper)",
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Poultry Prophet home" className="rounded-full text-(--pp-ink) outline-none focus-visible:ring-3 focus-visible:ring-(--pp-lime)">
          <BrandMark />
        </Link>

        <nav aria-label="Pangunahing navigation" className="relative hidden items-center gap-1 lg:flex">
          <span
            aria-hidden="true"
            className="absolute top-0 h-10 rounded-full bg-(--pp-mist) transition-[left,width,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            style={{ left: indicator.left, width: indicator.width, opacity: active ? 1 : 0 }}
          />
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              ref={(node) => {
                if (node) linkRefs.current.set(link.id, node);
                else linkRefs.current.delete(link.id);
              }}
              onClick={(event) => onDesktopNav(event, link.id)}
              aria-current={active === link.id ? "location" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "relative h-10 rounded-full px-4 text-[15px] font-normal transition-colors duration-300 hover:bg-transparent hover:text-(--pp-ink)",
                active === link.id ? "text-(--pp-green)" : "text-(--pp-ink)/70",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AccountArea />
          <Sheet
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onOpenChangeComplete={(open) => {
              if (open || !pendingTarget.current) return;
              scrollToSection(pendingTarget.current);
              pendingTarget.current = null;
            }}
          >
            <SheetTrigger
              render={<Button variant="ghost" size="icon-lg" className="rounded-full text-(--pp-ink) lg:hidden" aria-label="Buksan ang menu" />}
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="bg-background">
              <SheetHeader>
                <SheetTitle>Poultry Prophet</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="grid gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    onClick={(event) => onMobileNav(event, link.id)}
                    aria-current={active === link.id ? "location" : undefined}
                    className={cn(buttonVariants({ variant: "ghost" }), "h-12 justify-start rounded-xl px-3 text-base aria-[current=location]:bg-muted")}
                  >
                    {link.label}
                  </a>
                ))}
                {!isLoading && !isAuthenticated && (
                  <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-12 rounded-full text-base")}>
                    Mag-sign in
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

