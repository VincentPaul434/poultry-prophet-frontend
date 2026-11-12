import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BrandMark } from "@/components/landing/brand-mark";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

const COLUMNS = [
  {
    title: "Produkto",
    links: [
      { href: "#tungkol", label: "Tungkol" },
      { href: "#mga-tala", label: "Mga tala" },
      { href: "#para-kanino", label: "Para kanino" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Mag-sign in" },
      { href: "/register", label: "Gumawa ng account" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-(--pp-green-deep) text-white">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center">
          <h2 className="max-w-xl text-balance text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
            Simulan ang malinaw na tala ng iyong farm ngayon
          </h2>
          <Link
            href="/register"
            className={cn(buttonVariants(), "h-12 shrink-0 rounded-full border border-(--pp-lime) bg-(--pp-lime) px-7 text-base font-medium text-(--pp-green) hover:bg-(--pp-lime-strong)")}
          >
            Magsimula
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Reveal>

        <Separator className="bg-white/15" />

        <div className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <BrandMark tone="light" />
            <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/70">
              Farm records para sa mga gamefowl breeder, manager, at handler sa Pilipinas. Ginawa para sa trabahong
              nangyayari sa farm, may signal man o wala.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-base font-medium">{column.title}</h3>
              <ul className="mt-4 grid gap-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(buttonVariants({ variant: "link" }), "h-9 px-0 text-[15px] font-normal text-white/70 hover:text-(--pp-lime)")}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator className="bg-white/15" />

        <div className="flex flex-col justify-between gap-2 py-6 text-sm text-white/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Poultry Prophet. Lahat ng karapatan ay nakalaan.</p>
          <p>Ginawa para sa mga Pilipinong gamefowl farm.</p>
        </div>
      </div>
    </footer>
  );
}

