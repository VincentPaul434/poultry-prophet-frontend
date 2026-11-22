import { PoultryProphetMark } from "@/components/poultry-prophet-mark";

export function BrandMark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={
          tone === "dark"
            ? "flex size-9 items-center justify-center rounded-full bg-(--pp-green) text-(--pp-lime)"
            : "flex size-9 items-center justify-center rounded-full bg-white text-(--pp-green)"
        }
      >
        <PoultryProphetMark className="h-5 w-4" tone={tone === "dark" ? "light" : "dark"} />
      </span>
      <span className="text-lg font-semibold tracking-[-0.02em]">Poultry Prophet</span>
    </span>
  );
}
