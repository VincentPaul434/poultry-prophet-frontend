import { Bird } from "lucide-react";

export function BrandMark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={
          tone === "dark"
            ? "flex size-9 items-center justify-center rounded-full bg-(--pp-green) text-(--pp-lime)"
            : "flex size-9 items-center justify-center rounded-full bg-(--pp-lime) text-(--pp-green)"
        }
      >
        <Bird className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold tracking-[-0.02em]">Poultry Prophet</span>
    </span>
  );
}
