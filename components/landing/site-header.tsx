import Link from "next/link";
import { CloudOff, Smartphone } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";

/** The top info bar scrolls away; the navigation row below it stays pinned. */
export function SiteHeader() {
  return (
    <>
      <div className="bg-(--pp-green) text-white/85">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-2.5 text-[13px] sm:px-8">
          <p>
            Handa ka na bang ayusin ang records ng farm?{" "}
            <Link href="/register" className="font-medium text-(--pp-lime) underline underline-offset-4 hover:text-white">
              Gumawa ng account
            </Link>
          </p>
          <div className="hidden items-center gap-5 md:flex">
            <span className="inline-flex items-center gap-1.5">
              <CloudOff className="size-3.5" aria-hidden="true" /> Gumagana kahit offline
            </span>
            <span className="h-3.5 w-px bg-white/25" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-3.5" aria-hidden="true" /> Sa phone at computer
            </span>
          </div>
        </div>
      </div>
      <LandingNav />
    </>
  );
}
