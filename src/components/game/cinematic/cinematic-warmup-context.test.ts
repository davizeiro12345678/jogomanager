import { describe, expect, it, vi } from "vitest";
import { observeWarmupContext } from "./cinematic-warmup-context";

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe("cinematic shader context recovery", () => {
  it("waits for stale shader invalidation before resuming a restored canvas", async () => {
    const canvas = new EventTarget();
    const suspend = vi.fn();
    const resume = vi.fn();
    let finish!: () => void;
    const invalidate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const stop = observeWarmupContext(canvas, suspend, invalidate, resume);
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(suspend).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    await flush();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    finish();
    await flush();
    expect(resume).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    await flush();
    expect(resume).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not resume an invalidated generation or a disposed actor", async () => {
    const canvas = new EventTarget();
    const suspend = vi.fn();
    const resume = vi.fn();
    const pending: (() => void)[] = [];
    const invalidate = vi.fn(() => new Promise<void>((resolve) => pending.push(resolve)));
    const stop = observeWarmupContext(canvas, suspend, invalidate, resume);
    canvas.dispatchEvent(new Event("webglcontextlost"));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    await flush();
    canvas.dispatchEvent(new Event("webglcontextlost"));
    pending[0]!();
    await flush();
    expect(resume).not.toHaveBeenCalled();
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    stop();
    pending[1]!();
    await flush();
    expect(resume).not.toHaveBeenCalled();
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(suspend).toHaveBeenCalledTimes(2);
  });

  it("recovers even if optional shader invalidation rejects", async () => {
    const canvas = new EventTarget();
    const resume = vi.fn();
    const stop = observeWarmupContext(
      canvas,
      vi.fn(),
      async () => {
        throw new Error("optional module unavailable");
      },
      resume,
    );
    canvas.dispatchEvent(new Event("webglcontextlost"));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    await flush();
    expect(resume).toHaveBeenCalledTimes(1);
    stop();
  });
});
