// Install h3/Worker process hooks only in the server entry. Shared handled-error
// reporting must not replace the browser's console or import stack expansion.
import { captureReportedError, describeError } from "./error-capture";
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const expanded = args.map((arg) => {
    if (!(arg instanceof Error)) return arg;
    captureReportedError(arg);
    return describeError(arg);
  });
  originalConsoleError(...expanded);
};
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) =>
    captureReportedError((event as ErrorEvent).error ?? event),
  );
  globalThis.addEventListener("unhandledrejection", (event) =>
    captureReportedError((event as PromiseRejectionEvent).reason),
  );
}
