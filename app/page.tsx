import { ShieldCheck } from "lucide-react";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingHero } from "@/components/landing/landing-hero";
import { BenefitStrip } from "@/components/landing/benefit-strip";
import { InteractiveWalkthrough } from "@/components/landing/interactive-walkthrough";
import { ConnectedRecordsFlow } from "@/components/landing/connected-records-flow";
import { RoleDemo } from "@/components/landing/role-demo";

export default function Home() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-[var(--shadow-overlay)]">
        Skip to content
      </a>
      <LandingHeader />

      <main id="main-content" lang="fil">
        <LandingHero />
        <BenefitStrip />
        <InteractiveWalkthrough />
        <ConnectedRecordsFlow />
        <RoleDemo />

        <section className="border-b border-border bg-card/60 py-10 sm:py-12">
          <div className="mx-auto flex w-full max-w-4xl items-start gap-3 px-4 sm:px-6 lg:px-8">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-6 text-muted-foreground">Ang Poultry Prophet ay decision-support tool lamang. Hindi ito nagdi-diagnose ng disease, pumipili ng individual bird, o nagpo-predict ng future performance.</p>
          </div>
        </section>
        <LandingCta />
      </main>

      <LandingFooter />
    </div>
  );
}
