import Link from "next/link";
import { ArrowDown, ArrowRight, CheckCircle2, CloudOff, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RecordJourneyPreview } from "@/components/landing/record-journey-preview";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14 lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-success-border bg-success-muted px-3 py-1.5 text-xs font-semibold text-success">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Batch monitoring for gamefowl farms
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
            Isang malinaw na record para sa bawat batch.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            I-record ang nangyari sa farm. Poultry Prophet ang mag-aayos ng history para madaling ma-review ng manager.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
              Gumawa ng account
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href="#walkthrough" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
              Tingnan kung paano
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />Mabilis mag-record</span>
            <span className="inline-flex items-center gap-1.5"><CloudOff className="size-3.5 text-primary" aria-hidden="true" />Offline-ready</span>
            <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5 text-primary" aria-hidden="true" />Reviewable history</span>
          </div>
        </div>

        <div className="lg:pl-2">
          <RecordJourneyPreview />
          <p className="mt-4 text-center text-xs text-muted-foreground">Example flow using synthetic demo data.</p>
        </div>
      </div>
    </section>
  );
}
