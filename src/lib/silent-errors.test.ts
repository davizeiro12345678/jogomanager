import { afterEach, describe, expect, it, vi } from "vitest";

import { consumeLastCapturedError } from "./error-capture";
import { getSilentErrorReports, reportSilent, resetSilentErrorReports } from "./silent-errors";

describe("reportSilent", () => {
  afterEach(() => {
    resetSilentErrorReports();
    consumeLastCapturedError();
    vi.restoreAllMocks();
  });

  it("deduplicates a stable cause while keeping count and first/last context", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const first = new Error("chunk indisponível");
    const second = new Error("chunk indisponível");

    reportSilent("cutscene.stage", first, {
      classification: "degradation",
      feature: "cinematic",
      phase: "preload",
      dedupeKey: "chunk:cinematic-stage",
      attempt: 1,
    });
    reportSilent("cutscene.stage", second, {
      classification: "degradation",
      feature: "cinematic",
      phase: "preload",
      dedupeKey: "chunk:cinematic-stage",
      attempt: 2,
    });

    const [report] = getSilentErrorReports();
    expect(report).toMatchObject({
      scope: "cutscene.stage",
      classification: "degradation",
      count: 2,
      firstContext: { attempt: 1 },
      lastContext: { attempt: 2 },
    });
    expect(report?.cause).toContain("chunk indisponível");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("keeps a fatal cause available when a later degradation is handled", () => {
    const fatal = new Error("server request failed");
    reportSilent("server.request", fatal, { classification: "fatal" });
    reportSilent("cutscene.preload", new Error("optional asset unavailable"), {
      classification: "degradation",
    });
    expect(consumeLastCapturedError()).toBe(fatal);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("accepts all classes and never rethrows the original failure", () => {
    expect(() => {
      reportSilent("fatal.operation", new Error("fatal"), { classification: "fatal" });
      reportSilent("degradation.operation", "degraded", { classification: "degradation" });
      reportSilent(
        "ignorable.operation",
        { reason: "cancelled" },
        {
          classification: "ignorable",
        },
      );
    }).not.toThrow();

    expect(getSilentErrorReports()).toHaveLength(3);
  });
});
