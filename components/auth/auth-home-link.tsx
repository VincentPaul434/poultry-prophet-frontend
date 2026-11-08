import Link from "next/link"
import { ArrowLeft, Bird } from "lucide-react"
import { cn } from "@/lib/utils"

export function AuthBrandLink({ className, variant = "default" }: { className?: string; variant?: "default" | "hero" }) {
  const hero = variant === "hero"

  return (
    <Link
      href="/"
      aria-label="Go to Poultry Prophet home"
      className={cn(
        "group inline-flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#eeb541]/60",
        hero ? "text-white" : "text-[#173d2a]",
        className,
      )}
    >
      <span className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105",
        hero ? "size-12 bg-white/12 text-white" : "size-11 bg-[#173d2a] text-white",
      )}>
        <Bird className={hero ? "size-6" : "size-5"} aria-hidden="true" />
      </span>
      <span className={cn("font-black tracking-[-0.02em]", hero ? "text-lg" : "text-sm sm:text-base")}>Poultry Prophet</span>
    </Link>
  )
}

export function BackToHomeLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Bumalik sa home"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-[#617267] transition-colors hover:bg-white/70 hover:text-[#173d2a] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#eeb541]/60",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <span><span className="hidden min-[400px]:inline">Bumalik sa </span>home</span>
    </Link>
  )
}
