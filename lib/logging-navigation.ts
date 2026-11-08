export const LOGGING_ORIGINS = {
  dashboard: "dashboard",
  batch: "batch",
  tasks: "tasks",
  incubation: "incubation",
  alerts: "alerts",
} as const;

export type LoggingOrigin = (typeof LOGGING_ORIGINS)[keyof typeof LOGGING_ORIGINS];

/** Parse the allowlisted logging origin query parameter. */
export function parseLoggingOrigin(
  value: string | string[] | undefined
): LoggingOrigin | null {
  const origin = Array.isArray(value) ? value[0] : value;

  if (Object.values(LOGGING_ORIGINS).includes(origin as LoggingOrigin)) {
    return origin as LoggingOrigin;
  }

  return null;
}

/** Return the safe in-app page to return to after logging from the shell. */
export function getLoggingOriginForPathname(pathname: string): Exclude<LoggingOrigin, "batch"> {
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return LOGGING_ORIGINS.tasks;
  if (pathname === "/incubation" || pathname.startsWith("/incubation/")) return LOGGING_ORIGINS.incubation;
  if (pathname === "/alerts" || pathname.startsWith("/alerts/")) return LOGGING_ORIGINS.alerts;
  return LOGGING_ORIGINS.dashboard;
}

/** Match only numeric batch routes so arbitrary path text cannot become a target. */
export function getBatchIdFromPathname(pathname: string): number | null {
  const match = pathname.match(/^\/batches\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Build an internal logging URL from the fixed origin enum. */
export function getLoggingHref(
  batchId: string | number,
  origin: LoggingOrigin,
  focusLog = false
) {
  return `/batches/${batchId}/data-entry?from=${origin}${focusLog ? "#record-event" : ""}`;
}

/** Build a read-only event-history URL without opening the recording workflow. */
export function getEventLogHref(batchId: string | number, origin: LoggingOrigin = LOGGING_ORIGINS.batch) {
  return `/batches/${batchId}/data-entry?from=${origin}&view=history`;
}
