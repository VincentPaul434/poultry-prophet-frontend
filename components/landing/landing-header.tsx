import Link from "next/link";
import { Bird } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group inline-flex min-h-11 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Poultry Prophet home"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:-rotate-3">
            <Bird className="size-5" aria-hidden="true" />
          </span>
          <span className="hidden text-base font-bold tracking-tight text-foreground sm:inline">
            Poultry Prophet
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          <a
            href="#walkthrough"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Paano gumagana
          </a>
          <a
            href="#features"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Features
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-3"
          >
            Mag-sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
          >
            Gumawa ng account
          </Link>
        </div>
      </div>
    </header>
  );
}
