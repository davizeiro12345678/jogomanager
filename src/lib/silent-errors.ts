import { captureReportedError } from "./error-capture";

export type SilentErrorClass = "fatal" | "degradation" | "ignorable";

export type SilentErrorContext = {
  classification: SilentErrorClass;
  feature?: string;
  phase?: string;
  dedupeKey?: string;
  [key: string]: unknown;
};

export type SilentErrorReport = {
  key: string;
  scope: string;
  classification: SilentErrorClass;
  cause: string;
  count: number;
  firstAt: number;
  lastAt: number;
  firstContext: SilentErrorContext;
  lastContext: SilentErrorContext;
};

const reports = new Map<string, SilentErrorReport>();

function describeCause(error: unknown) {
  if (error instanceof Error) return `${error.name}:${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .filter((key) => key !== "dedupeKey")
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function isDevelopment() {
  return Boolean(
    (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ??
    (globalThis as typeof globalThis & { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV === "development",
  );
}

/** Reports a handled error, preserving the original cause and warning once per stable key in dev. */
export function reportSilent(scope: string, error: unknown, context: SilentErrorContext): void {
  const cause = describeCause(error);
  const key = `${scope}:${context.dedupeKey ?? `${cause}:${stableValue(context)}`}`;
  const now = Date.now();
  const previous = reports.get(key);
  if (previous) {
    previous.count += 1;
    previous.lastAt = now;
    previous.lastContext = { ...context };
  } else {
    reports.set(key, {
      key,
      scope,
      classification: context.classification,
      cause,
      count: 1,
      firstAt: now,
      lastAt: now,
      firstContext: { ...context },
      lastContext: { ...context },
    });
    if (isDevelopment())
      console.warn(`[silent:${context.classification}] ${scope}`, error, context);
  }
  captureReportedError(error, { scope, ...context });
}

export function getSilentErrorReports(): SilentErrorReport[] {
  return [...reports.values()].map((report) => ({
    ...report,
    firstContext: { ...report.firstContext },
    lastContext: { ...report.lastContext },
  }));
}

export function resetSilentErrorReports() {
  reports.clear();
}
