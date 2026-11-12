import { Outfit } from "next/font/google";
import { AboutSection } from "@/components/landing/about-section";
import { FaqSection } from "@/components/landing/faq-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { RecordsSection } from "@/components/landing/records-section";
import { RolesSection } from "@/components/landing/roles-section";
import { SiteHeader } from "@/components/landing/site-header";
import { cn } from "@/lib/utils";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-landing" });

export default function Home() {
  return (
    <div className={cn(outfit.variable, "pp-landing min-h-svh overflow-x-clip bg-(--pp-paper) font-(family-name:--font-landing) text-(--pp-ink)")}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-(--pp-green) focus:shadow-lg"
      >
        Lumaktaw sa nilalaman
      </a>
      <SiteHeader />
      <main id="main-content" lang="fil">
        <LandingHero />
        <AboutSection />
        <RecordsSection />
        <RolesSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </div>
  );
}
