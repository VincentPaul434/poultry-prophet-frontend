import Link from "next/link";
import { Bird, ChevronDown } from "lucide-react";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#173d2a]/10 bg-[#f7f1e7] shadow-[0_4px_18px_rgb(23_61_42_/_0.06)]">
      <div className="mx-auto flex min-h-[4.5rem] w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group inline-flex min-h-11 items-center gap-2.5 rounded-xl text-[#173d2a] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#eeb541]/60"
          aria-label="Poultry Prophet home"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#173d2a] text-white shadow-[0_8px_20px_rgb(23_61_42_/_0.18)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
            <Bird className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-black tracking-[-0.02em] sm:text-base">Poultry Prophet</span>
        </Link>

        <nav aria-label="Pangunahing navigation" className="hidden items-center gap-1 rounded-full border border-[#173d2a]/10 bg-white/65 p-1 md:flex">
          <a href="#process" className="rounded-full px-4 py-2 text-sm font-semibold text-[#486251] transition-colors hover:bg-[#173d2a] hover:text-white">Paano</a>
          <a href="#offline" className="rounded-full px-4 py-2 text-sm font-semibold text-[#486251] transition-colors hover:bg-[#173d2a] hover:text-white">Kahit offline</a>
          <a href="#features" className="rounded-full px-4 py-2 text-sm font-semibold text-[#486251] transition-colors hover:bg-[#173d2a] hover:text-white">Mga gamit</a>
          <a href="#roles" className="rounded-full px-4 py-2 text-sm font-semibold text-[#486251] transition-colors hover:bg-[#173d2a] hover:text-white">Para kanino</a>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <details className="group relative md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-xl px-2.5 text-sm font-bold text-[#173d2a] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#eeb541]/60 [&::-webkit-details-marker]:hidden">
              Menu <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-[3.25rem] z-50 grid min-w-48 gap-1 rounded-2xl border border-[#173d2a]/10 bg-[#fffdf8] p-2 shadow-[0_20px_50px_rgb(23_61_42_/_0.18)]">
              <a href="#process" className="rounded-xl px-3 py-3 text-sm font-semibold text-[#173d2a] hover:bg-[#edf3e8]">Paano gumagana</a>
              <a href="#offline" className="rounded-xl px-3 py-3 text-sm font-semibold text-[#173d2a] hover:bg-[#edf3e8]">Kahit offline</a>
              <a href="#features" className="rounded-xl px-3 py-3 text-sm font-semibold text-[#173d2a] hover:bg-[#edf3e8]">Mga gamit</a>
              <a href="#roles" className="rounded-xl px-3 py-3 text-sm font-semibold text-[#173d2a] hover:bg-[#edf3e8]">Para kanino</a>
            </div>
          </details>
          <Link href="/login" className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#173d2a] hover:bg-white/70 sm:inline-flex">
            Mag-sign in
          </Link>
          <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl bg-[#eeb541] px-3.5 text-sm font-black text-[#173d2a] shadow-[0_8px_20px_rgb(166_106_8_/_0.18)] transition-transform hover:-translate-y-0.5 sm:px-4">
            Magsimula
          </Link>
        </div>
      </div>
    </header>
  );
}
