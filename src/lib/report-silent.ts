import { redactDiagnosticText } from "./error-redaction";

export type FailureClass = "fatal" | "degradation" | "ignorable";
export interface SilentContext {
  class: FailureClass;
  code: string;
  [key: string]: unknown;
}
export interface SilentReport {
  scope: string;
  code: string;
  class: FailureClass;
  count: number;
  firstAt: number;
  lastAt: number;
  message: string;
  context: Record<string, string | number | boolean>;
}
const records = new Map<string, SilentReport>();
const sinks = new Set<(report: SilentReport, error: unknown) => void>();
const allowed = new Set([
  "route",
  "scene",
  "phase",
  "quality",
  "backend",
  "sequence",
  "revision",
  "attempt",
  "session",
  "source",
  "boundary",
]);
const redact = (text: string) => redactDiagnosticText(text, 320);
export function subscribeSilentReports(sink: (report: SilentReport, error: unknown) => void) {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}
export function silentReports(): SilentReport[] {
  return [...records.values()].map((record) => ({ ...record, context: { ...record.context } }));
}
/** Reporting is observational and must never throw into recovery or rendering. */
export function reportSilent(scope: string, error: unknown, context: SilentContext): void {
  try {
    recordSilent(scope, error, context);
  } catch {
    // Host objects, getters and even development consoles can throw. Reporting
    // must remain observational, especially while recovering a failed worker.
  }
}

function recordSilent(scope: string, error: unknown, context: SilentContext): void {
  const message = redact(
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown failure",
  );
  const now = Date.now();
  const key = `${scope}:${context.code}:${context.class}:${message}`;
  const previous = records.get(key);
  if (previous && now - previous.firstAt < 60_000) {
    previous.count++;
    previous.lastAt = now;
    return;
  }
  const safe: SilentReport["context"] = {};
  for (const [name, value] of Object.entries(context))
    if (
      allowed.has(name) &&
      (typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)))
    )
      safe[name] = typeof value === "string" ? redact(value) : value;
  const report: SilentReport = {
    scope: scope.slice(0, 80),
    code: context.code.slice(0, 80),
    class: context.class,
    count: 1,
    firstAt: now,
    lastAt: now,
    message,
    context: safe,
  };
  records.delete(key);
  records.set(key, report);
  while (records.size > 200) records.delete(records.keys().next().value!);
  if (import.meta.env.DEV && context.class !== "ignorable")
    console.warn(`[${scope}/${context.code}]`, report);
  for (const sink of sinks) {
    try {
      sink(report, error);
    } catch {
      /* prevent report recursion */
    }
  }
}

export function installRuntimeErrorReports(
  target: Pick<Window, "addEventListener" | "removeEventListener">,
) {
  const error = (event: Event) => {
    const detail = event as ErrorEvent;
    reportSilent("runtime", detail.error ?? detail.message, {
      class: "fatal",
      code: "error-event",
    });
  };
  const rejection = (event: Event) =>
    reportSilent("runtime", (event as PromiseRejectionEvent).reason, {
      class: "fatal",
      code: "unhandled-rejection",
    });
  const message = () =>
    reportSilent("runtime", "Unable to deserialize message", {
      class: "degradation",
      code: "message-error",
    });
  target.addEventListener("error", error);
  target.addEventListener("unhandledrejection", rejection);
  target.addEventListener("messageerror", message);
  return () => {
    target.removeEventListener("error", error);
    target.removeEventListener("unhandledrejection", rejection);
    target.removeEventListener("messageerror", message);
  };
}
