import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingCta() {
  return (
    <section className="bg-primary py-16 text-primary-foreground sm:py-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/75">Start with the record</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Mas maayos na records, mula gawain hanggang review.</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-primary-foreground/80">Record what happened, review what is documented, and let experienced people make the final call.</p>
        <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "w-full bg-white text-primary hover:bg-white/90 sm:w-auto")}>
            Gumawa ng account
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto")}>
            May account na ako
          </Link>
        </div>
      </div>
    </section>
  );
}
