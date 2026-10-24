import { describe, expect, it, vi } from "vitest";
import {
  reportSilent,
  silentReports,
  subscribeSilentReports,
  installRuntimeErrorReports,
} from "./report-silent";
import { retryChunk } from "./chunk-retry";

describe("observable failures", () => {
  it("contains hostile error and context getters", () => {
    const error = new Error("failed");
    Object.defineProperty(error, "message", {
      get() {
        throw new Error("getter");
      },
    });
    expect(() => reportSilent("getter", error, { class: "fatal", code: "getter" })).not.toThrow();
    const context = { class: "fatal" as const, code: "context" };
    Object.defineProperty(context, "phase", {
      enumerable: true,
      get() {
        throw new Error("context getter");
      },
    });
    expect(() => reportSilent("getter", "failed", context)).not.toThrow();
  });
  it("dedupes, counts and sanitizes without leaking context", () => {
    const sink = vi.fn();
    const stop = subscribeSilentReports(sink);
    reportSilent("test-report", new Error("token=private"), {
      class: "degradation",
      code: "example",
      sequence: 4,
      save: { secret: 1 },
    });
    reportSilent("test-report", new Error("token=private"), {
      class: "degradation",
      code: "example",
    });
    stop();
    expect(sink).toHaveBeenCalledTimes(1);
    const report = silentReports().find((r) => r.scope === "test-report")!;
    expect(report.count).toBe(2);
    expect(report.message).not.toContain("private");
    expect(report.context).toEqual({ sequence: 4 });
  });
  it("contains failing sinks and releases global listeners", () => {
    const target = new EventTarget();
    const sink = vi.fn(() => {
      throw new Error("sink failure");
    });
    const stopSink = subscribeSilentReports(sink);
    const stop = installRuntimeErrorReports(target);
    expect(() => target.dispatchEvent(new Event("messageerror"))).not.toThrow();
    stop();
    stopSink();
    const before = sink.mock.calls.length;
    target.dispatchEvent(new Event("messageerror"));
    expect(sink.mock.calls.length).toBe(before);
  });
  it("retries chunks twice then succeeds, and stops after exhaustion", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("network1"))
      .mockRejectedValueOnce(new Error("network2"))
      .mockResolvedValue("stage");
    const wait = vi.fn(async (_ms: number) => undefined);
    expect(await retryChunk("test-chunk", load, wait)).toBe("stage");
    expect(wait.mock.calls.map((call) => call[0])).toEqual([500, 1500]);
    const fail = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(retryChunk("test-offline", fail, wait)).rejects.toThrow("offline");
    expect(fail).toHaveBeenCalledTimes(3);
  });
});
