import { afterEach, describe, expect, it, vi } from "vitest";

import { consumeLastCapturedError } from "./error-capture";
import {
  getSilentErrorReports,
  reportSilent,
  resetSilentErrorReports,
} from "./silent-errors";

describe("reportSilent", () => {
  afterEach(() => {
    resetSilentErrorReports();
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
    expect(consumeLastCapturedError()).toBe(second);
  });

  it("accepts all classes and never rethrows the original failure", () => {
    expect(() => {
      reportSilent("fatal.operation", new Error("fatal"), { classification: "fatal" });
      reportSilent("degradation.operation", "degraded", { classification: "degradation" });
      reportSilent("ignorable.operation", { reason: "cancelled" }, {
        classification: "ignorable",
      });
    }).not.toThrow();

    expect(getSilentErrorReports()).toHaveLength(3);
  });
});
