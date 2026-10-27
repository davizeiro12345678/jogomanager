import { expect, it, vi } from "vitest";

it("imports the shared handled-error record without installing server console or global handlers", async () => {
  vi.resetModules();
  const prior = console.error,
    listen = vi.fn();
  vi.stubGlobal("addEventListener", listen);
  try {
    const capture = await import("./error-capture");
    expect(console.error).toBe(prior);
    expect(listen).not.toHaveBeenCalled();
    const error = new Error("handled");
    capture.captureReportedError(error, { feature: "test" });
    expect(capture.consumeLastCapturedError()).toBe(error);
  } finally {
    console.error = prior;
    vi.unstubAllGlobals();
  }
});

it("retains server console expansion, consume-once errors and Worker global event capture", async () => {
  vi.resetModules();
  const prior = console.error,
    print = vi.fn(),
    listen = vi.fn();
  console.error = print;
  vi.stubGlobal("addEventListener", listen);
  try {
    await import("./error-capture.server");
    const capture = await import("./error-capture"),
      error = new Error("SSR failure", { cause: new Error("original cause") });
    console.error(error, "details");
    expect(print).toHaveBeenCalledOnce();
    expect(print.mock.calls[0]![0]).toContain("SSR failure");
    expect(print.mock.calls[0]![0]).toContain("original cause");
    expect(capture.consumeLastCapturedError()).toBe(error);
    expect(capture.consumeLastCapturedError()).toBeUndefined();
    expect(listen.mock.calls.map((call) => call[0])).toEqual(["error", "unhandledrejection"]);
    const rejected = new Error("rejected");
    listen.mock.calls[1]![1]({ reason: rejected });
    expect(capture.consumeLastCapturedError()).toBe(rejected);
  } finally {
    console.error = prior;
    vi.unstubAllGlobals();
  }
});
