import { ShieldCheck } from "lucide-react";
import { BenefitStrip } from "@/components/landing/benefit-strip";
import { BackToTopButton } from "@/components/landing/back-to-top-button";
import { CapabilityGrid } from "@/components/landing/capability-grid";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { OfflineWorkflow } from "@/components/landing/offline-workflow";
import { ProblemOutcomeStrip } from "@/components/landing/problem-outcome-strip";
import { Reveal } from "@/components/landing/reveal";
import { RoleDemo } from "@/components/landing/role-demo";
import { SystemProcessDemo } from "@/components/landing/system-process-demo";
import { ValidationTrust } from "@/components/landing/validation-trust";

export default function Home() {
  return (
    <div id="page-top" className="min-h-svh overflow-x-hidden bg-[#f7f1e7] text-[#173d2a]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[#173d2a] focus:shadow-xl"
      >
        Lumaktaw sa nilalaman
      </a>
      <LandingHeader />

      <main id="main-content" lang="fil">
        <LandingHero />
        <BenefitStrip />
        <ProblemOutcomeStrip />
        <SystemProcessDemo />
        <OfflineWorkflow />
        <CapabilityGrid />
        <RoleDemo />
        <ValidationTrust />

        <section id="scope" className="px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="scope-heading">
          <Reveal className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-5 rounded-[2rem] border border-[#173d2a]/10 bg-white/70 p-6 sm:flex-row sm:items-center sm:p-8">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#dcebd8]">
                <ShieldCheck className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h2 id="scope-heading" className="text-xl font-black tracking-tight sm:text-2xl">Malinaw ang hangganan.</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#617267]">
                  Tinutulungan ng system ang farm na magtala at mag-review. Hindi ito diagnosis at hindi nito pinapalitan ang beterinaryo o desisyon ng farm.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        <LandingCta />
      </main>

      <LandingFooter />
      <BackToTopButton />
    </div>
  );
}
