import Link from "next/link";
import { Bird } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bird className="size-4" aria-hidden="true" />
            </span>
            <span className="font-bold tracking-tight text-foreground">Poultry Prophet</span>
          </div>
          <p className="mt-3 max-w-sm text-xs leading-5 text-muted-foreground">
            Practical batch monitoring and review for gamefowl farm operations.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Research MVP · Based on recorded farm data.</p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
          <Link href="/login" className="rounded-md py-1 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Mag-sign in</Link>
          <Link href="/register" className="rounded-md py-1 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Gumawa ng account</Link>
        </nav>
      </div>
    </footer>
  );
}
