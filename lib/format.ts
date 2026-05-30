// Small presentation helpers shared across pages.

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatScore(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

// Tailwind text colour band for a 0–100 score (red → amber → green).
export function scoreColor(value: number | null | undefined): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const QUALITY_RATINGS = [
  { value: "C", label: "C" },
  { value: "B", label: "B" },
  { value: "B_PLUS", label: "B+" },
  { value: "A", label: "A" },
  { value: "A_PLUS", label: "A+" },
  { value: "A_PLUS_PLUS", label: "A++" },
] as const;

export const HEALTH_EVENTS = [
  { value: "NONE", label: "None" },
  { value: "ROUTINE", label: "Routine" },
  { value: "MINOR", label: "Minor" },
  { value: "MODERATE", label: "Moderate" },
  { value: "MAJOR", label: "Major" },
] as const;
