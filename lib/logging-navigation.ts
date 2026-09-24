export const LOGGING_ORIGINS = {
  dashboard: "dashboard",
  batch: "batch",
} as const;

export type LoggingOrigin = (typeof LOGGING_ORIGINS)[keyof typeof LOGGING_ORIGINS];

/** Parse the allowlisted logging origin query parameter. */
export function parseLoggingOrigin(
  value: string | string[] | undefined
): LoggingOrigin | null {
  const origin = Array.isArray(value) ? value[0] : value;

  if (origin === LOGGING_ORIGINS.dashboard || origin === LOGGING_ORIGINS.batch) {
    return origin;
  }

  return null;
}

/** Build an internal logging URL from the fixed origin enum. */
export function getLoggingHref(
  batchId: string | number,
  origin: LoggingOrigin,
  focusLog = false
) {
  return `/batches/${batchId}/data-entry?from=${origin}${focusLog ? "#log-event" : ""}`;
}
