import { BenefitStrip } from "@/components/landing/benefit-strip";
import { BackToTopButton } from "@/components/landing/back-to-top-button";
import { CapabilityGrid } from "@/components/landing/capability-grid";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { OfflineWorkflow } from "@/components/landing/offline-workflow";
import { RoleDemo } from "@/components/landing/role-demo";
import { SystemProcessDemo } from "@/components/landing/system-process-demo";

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
        <SystemProcessDemo />
        <OfflineWorkflow />
        <CapabilityGrid />
        <RoleDemo />
        <LandingCta />
      </main>

      <LandingFooter />
      <BackToTopButton />
    </div>
  );
}
