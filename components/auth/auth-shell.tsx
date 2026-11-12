import Image from "next/image";
import type { ReactNode } from "react";
import { AuthBrandLink, BackToHomeLink } from "@/components/auth/auth-home-link";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  compact?: boolean;
}

/** The shared two-column layout from the shadcn login-02 block. */
const ENTER = "animate-in fade-in fill-mode-both duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none";

export function AuthShell({ eyebrow, title, description, children, footer, compact = false }: AuthShellProps) {
  return (
    <div lang="fil" className="grid min-h-svh bg-background text-foreground lg:grid-cols-2">
      <div className={cn("flex min-w-0 flex-col", compact ? "gap-2 px-4 py-3 sm:px-8 lg:px-10 [@media(max-height:600px)]:py-2" : "gap-6 p-6 md:p-10")}>
        <header className={cn("flex items-center justify-between gap-4", ENTER, "duration-500")}>
          <AuthBrandLink />
          <BackToHomeLink />
        </header>

        <main className={cn("flex flex-1 items-center justify-center", compact ? "py-2 [@media(max-height:700px)]:py-0" : "py-8")}>
          <div className="w-full max-w-sm">
            <div className={cn("flex flex-col text-center", compact ? "gap-1" : "gap-2", ENTER, "slide-in-from-bottom-4 delay-75")}>
              <p className={cn("text-xs font-semibold uppercase tracking-widest text-primary", compact && "[@media(max-height:600px)]:hidden")}>{eyebrow}</p>
              <h1 className={cn("text-2xl font-semibold tracking-tight", !compact && "sm:text-3xl")}>{title}</h1>
              <p className={cn("text-sm text-muted-foreground", compact ? "leading-5" : "leading-6")}>{description}</p>
            </div>

            <div className={cn(compact ? "mt-4" : "mt-7", ENTER, "slide-in-from-bottom-4 delay-150")}>{children}</div>
            <div className={cn("text-center text-sm text-muted-foreground", compact ? "mt-4 [@media(max-height:600px)]:mt-2" : "mt-6", ENTER, "delay-300")}>{footer}</div>
          </div>
        </main>

        <p className={cn("text-center text-xs text-muted-foreground lg:text-left", compact && "hidden")}>
          Poultry Prophet · Malinaw na records sa bawat batch
        </p>
      </div>

      <aside className="relative hidden min-h-svh overflow-hidden bg-muted lg:block" aria-label="Poultry Prophet farm">
        <Image
          src="/auth-farm-cover.webp"
          alt=""
          fill
          sizes="50vw"
          className="object-cover animate-in fade-in zoom-in-105 duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/5" />
        <div className={cn("absolute inset-x-0 bottom-0 flex max-w-2xl flex-col gap-3 p-10 text-white xl:p-14", ENTER, "slide-in-from-bottom-6 delay-300 duration-1000")}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Para sa bawat araw sa bukid</p>
          <p className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Mas malinaw na tala, mas maalagang farm.
          </p>
          <p className="max-w-md text-sm leading-6 text-white/85">
            Lahat ng mahalagang record ng iyong mga batch, magkakasama sa isang lugar.
          </p>
        </div>
      </aside>
    </div>
  );
}
