import Link from "next/link";
import { ArrowDown, ArrowRight, CloudOff, History, Sparkles, Zap } from "lucide-react";
import { HeroSystemIllustration } from "@/components/landing/hero-system-illustration";

export function LandingHero() {
  return (
    <section className="relative px-3 pt-3 sm:px-5 sm:pt-5" aria-labelledby="hero-title">
      <div className="relative mx-auto min-h-[calc(100svh-6rem)] max-w-7xl overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_72%_14%,rgb(71_130_88_/_0.55),transparent_34%),linear-gradient(135deg,#123522_0%,#1b4d32_58%,#245f3e_100%)] text-white shadow-[0_28px_80px_rgb(23_61_42_/_0.2)] sm:rounded-[2.75rem]">
        <div className="absolute -left-24 top-20 size-72 rounded-full bg-[#eeb541]/18 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 -top-24 size-96 rounded-full bg-[#8fc79d]/18 blur-3xl" aria-hidden="true" />
        <div className="landing-paper-grid absolute inset-0 opacity-20" aria-hidden="true" />

        <div className="relative mx-auto grid min-h-[calc(100svh-6rem)] w-full max-w-7xl items-center gap-9 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10 lg:px-14 xl:px-18">
          <div className="max-w-2xl">
            <div className="landing-enter inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-[#f8df9d] backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Digital record para sa poultry farm
            </div>

            <h1 id="hero-title" className="landing-enter landing-enter-delay-1 mt-6 text-[clamp(2.75rem,7vw,5.8rem)] font-black leading-[0.94] tracking-[-0.065em]">
              Mas madaling farm work.
              <span className="block text-[#f4bf55]">Mas malinaw na record.</span>
            </h1>
            <p className="landing-enter landing-enter-delay-2 mt-6 max-w-xl text-base leading-7 text-white/74 sm:text-lg">
              Mag-record kahit walang signal. Pagbalik online, magkakaugnay na ang batch, gastos, bakuna, at health history.
            </p>

            <div className="landing-enter landing-enter-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#f4bf55] px-6 text-sm font-black text-[#173d2a] shadow-[0_14px_30px_rgb(0_0_0_/_0.18)] transition-transform hover:-translate-y-1">
                Magsimula
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a href="#process" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/8 px-6 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/15">
                Tingnan kung paano
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>

            <div className="landing-enter landing-enter-delay-3 mt-8 flex flex-wrap gap-2 text-xs font-bold text-white/80">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/9 px-3 py-2"><Zap className="size-3.5 text-[#f4bf55]" aria-hidden="true" />Mabilis gamitin</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/9 px-3 py-2"><CloudOff className="size-3.5 text-[#f4bf55]" aria-hidden="true" />Offline-ready</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/9 px-3 py-2"><History className="size-3.5 text-[#f4bf55]" aria-hidden="true" />May audit history</span>
            </div>
          </div>

          <div className="landing-enter landing-enter-delay-2 lg:pl-2">
            <HeroSystemIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
