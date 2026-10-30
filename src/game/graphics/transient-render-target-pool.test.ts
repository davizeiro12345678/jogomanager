import { describe, expect, it } from "vitest";
import { TransientRenderTargetPool } from "./transient-render-target-pool";

describe("transient render target reuse", () => {
  it("reuses only released matching targets and limits GPU allocation", () => {
    const pool = new TransientRenderTargetPool(128 * 128 * 4 * 2);
    const a = pool.acquire({ width: 128, height: 128 });
    const b = pool.acquire({ width: 128, height: 128 });
    expect(a).not.toBe(b);
    expect(pool.cachedCount).toBe(2);
    expect(() => pool.acquire({ width: 128, height: 128 })).toThrow(RangeError);
    pool.release(a);
    expect(pool.acquire({ width: 128, height: 128 })).toBe(a);
    pool.release(b);
    pool.release(a);
    expect(() => pool.release(a)).toThrow();
    pool.dispose();
    expect(pool.totalBytes).toBe(0);
  });
  it("evicts an idle incompatible target instead of breaking a live pass", () => {
    const pool = new TransientRenderTargetPool(64 * 64 * 8);
    const a = pool.acquire({ width: 64, height: 64 });
    pool.release(a);
    const b = pool.acquire({ width: 64, height: 64, type: 1016 }); // HalfFloatType
    expect(b).not.toBe(a);
    expect(pool.totalBytes).toBeLessThanOrEqual(pool.maxBytes);
    pool.dispose();
  });
});
