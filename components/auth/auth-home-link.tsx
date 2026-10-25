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
        "group inline-flex min-h-11 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        hero ? "text-primary-foreground" : "text-foreground",
        className,
      )}
    >
      <span className={cn(
        "flex shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:-rotate-3",
        hero ? "size-16 bg-white/15" : "size-12 bg-primary text-primary-foreground",
      )}>
        <Bird className={hero ? "size-9" : "size-6"} aria-hidden="true" />
      </span>
      <span className={cn("font-bold tracking-tight", hero ? "text-2xl" : "text-base")}>Poultry Prophet</span>
    </Link>
  )
}

export function BackToHomeLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to home
    </Link>
  )
}
