import { installRuntimeErrorReports, subscribeSilentReports } from "./report-silent";
import { reportLovableError } from "./lovable-error-reporting";
import { readConsent } from "./consent";

export function installBrowserErrorReporting() {
  let active = true;
  const stopEvents = installRuntimeErrorReports(window);
  const stopSink = subscribeSilentReports((report) => {
    if (report.class === "ignorable") return;
    // The editor hook is already available only in Lovable's preview.
    reportLovableError(
      new Error(report.message),
      {
        ...report.context,
        scope: report.scope,
        code: report.code,
        failureClass: report.class,
        count: report.count,
      },
      {
        mechanism: "manual",
        handled: report.class !== "fatal",
        severity: report.class === "fatal" ? "error" : "warning",
      },
    );
    if (readConsent().telemetry) {
      const errorCode = `${report.scope}_${report.code}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .slice(0, 40);
      // Reporting stays synchronous; the optional network SDK must not join
      // every visitor's startup bundle. Consent can change while it loads.
      void import("./telemetry-client")
        .then(({ reportTechSample }) => {
          if (active && readConsent().telemetry) reportTechSample({ errorCode });
        })
        .catch(() => {
          /* Offline reporting never breaks the game. */
        });
    }
  });
  return () => {
    active = false;
    stopEvents();
    stopSink();
  };
}
