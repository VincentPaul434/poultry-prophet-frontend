import { cn } from "@/lib/utils";

type PoultryProphetMarkProps = {
  className?: string;
  tone?: "dark" | "light";
};

/**
 * The supplied logo is a stacked lockup. Crop its emblem from the source SVG
 * for compact product surfaces, where the adjacent product name stays legible.
 */
export function PoultryProphetMark({ className, tone = "dark" }: PoultryProphetMarkProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="567.671875 489.535156 364.5 521.25"
      className={cn("block", tone === "light" && "invert", className)}
    >
      <image href="/brand/poultry-prophet-logo.svg" width="1500" height="1500" />
    </svg>
  );
}
