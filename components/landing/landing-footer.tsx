import Link from "next/link";
import { Bird } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-[#f7f1e7] px-4 py-9 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#173d2a] text-white">
            <Bird className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black">Poultry Prophet</p>
            <p className="text-xs font-semibold text-[#617267]">Mas malinaw na records sa bawat batch.</p>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap gap-4 text-xs font-black text-[#617267]">
          <Link href="/login" className="rounded-md py-2 hover:text-[#173d2a]">Mag-sign in</Link>
          <Link href="/register" className="rounded-md py-2 hover:text-[#173d2a]">Gumawa ng account</Link>
        </nav>
      </div>
    </footer>
  );
}
