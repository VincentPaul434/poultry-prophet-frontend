import type { ReactNode } from "react";
import { Check, CloudOff, History, RefreshCw } from "lucide-react";
import { AuthBrandLink, BackToHomeLink } from "@/components/auth/auth-home-link";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

const benefits = [
  { icon: CloudOff, label: "Tala kahit offline" },
  { icon: RefreshCw, label: "Auto-sync pag online" },
  { icon: History, label: "Isang batch history" },
];

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <div lang="fil" className="relative min-h-svh overflow-hidden bg-[#f5efe5] text-[#173d2a]">
      <div className="absolute -left-32 top-1/3 size-80 rounded-full bg-[#eeb541]/16 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-28 -top-24 size-96 rounded-full bg-[#9dc9a5]/20 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto grid min-h-svh w-full max-w-[1500px] lg:grid-cols-[1.04fr_0.96fr]">
        <aside className="relative m-4 hidden overflow-hidden rounded-[2.5rem] bg-[linear-gradient(145deg,#123522_0%,#1d5436_56%,#2d7049_100%)] p-10 text-white shadow-[0_30px_90px_rgb(23_61_42_/_0.2)] lg:flex lg:flex-col xl:p-14">
          <div className="landing-paper-grid absolute inset-0 opacity-15" aria-hidden="true" />
          <div className="absolute -right-28 -top-28 size-96 rounded-full bg-[#eeb541]/16 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-36 -left-24 size-96 rounded-full bg-[#a9d6b1]/12 blur-3xl" aria-hidden="true" />

          <div className="relative flex h-full flex-col">
            <AuthBrandLink variant="hero" />

            <div className="my-auto max-w-xl py-12">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4bf55]">Farm records, mas simple</p>
              <h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-[-0.055em] xl:text-6xl">
                Mula sa bukid,
                <span className="block text-[#f4bf55]">hanggang malinaw na report.</span>
              </h1>
              <p className="mt-6 max-w-lg text-base font-medium leading-7 text-white/68">
                Mag-record sa tamang batch. Ang system na ang mag-uugnay sa history, gastos, bakuna, at health records.
              </p>

              <div className="mt-9 rounded-[2rem] border border-white/12 bg-white/[0.07] p-4 shadow-[0_24px_60px_rgb(0_0_0_/_0.18)] backdrop-blur-sm">
                <div className="rounded-[1.4rem] bg-[#fffdf8] p-4 text-[#173d2a]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#617267]">Handler • Batch 012</p>
                      <p className="mt-1 text-sm font-black">Naitala ang bakuna</p>
                    </div>
                    <span className="flex size-9 items-center justify-center rounded-xl bg-[#dcebd8]">
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 py-3 text-xs font-black text-[#f8df9d]">
                  <RefreshCw className="size-4 animate-spin [animation-duration:3s] motion-reduce:animate-none" aria-hidden="true" />
                  Ligtas na naka-sync
                </div>

                <div className="rounded-[1.4rem] bg-[#f4bf55] p-4 text-[#173d2a]">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#71500e]">Manager view</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <p className="text-sm font-black">Updated ang batch timeline</p>
                    <span className="rounded-full bg-white/55 px-3 py-1 text-[10px] font-black">Ngayon</span>
                  </div>
                </div>
              </div>
            </div>

            <ul className="relative flex flex-wrap gap-2" aria-label="Pangunahing benepisyo">
              {benefits.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-3 text-xs font-bold text-white/78">
                  <Icon className="size-3.5 text-[#f4bf55]" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex min-w-0 items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-[31rem]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <AuthBrandLink className="lg:hidden" />
              <BackToHomeLink className="ml-auto" />
            </div>

            <section className="rounded-[2rem] border border-[#173d2a]/10 bg-[#fffdf8] p-6 shadow-[0_24px_70px_rgb(23_61_42_/_0.11)] sm:p-8 lg:p-10" aria-labelledby="auth-title">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b6811]">{eyebrow}</p>
              <h2 id="auth-title" className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em] text-[#173d2a] sm:text-4xl">
                {title}
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-[#617267]">{description}</p>

              <div className="mt-8">{children}</div>

              <div className="mt-7 border-t border-[#173d2a]/10 pt-6 text-center text-sm font-medium text-[#617267]">
                {footer}
              </div>
            </section>

            <p className="mt-5 text-center text-xs font-semibold text-[#617267]">
              Poultry Prophet • Ligtas at farm-scoped ang records
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
