import { describe, expect, it } from "vitest";
import {
  createCrowdMailbox,
  MAILBOX_CAPACITY,
  publishCrowdResult,
  writeCrowdCamera,
} from "./crowd-mailbox";
import { createCrowdVisibilityLayout } from "./crowd-visibility";

describe("atomic crowd mailbox", () => {
  it("clears stale planes and normalizes budgets before the WASM u32 boundary", () => {
    const target = new Float64Array(33).fill(-100);
    writeCrowdCamera(target, {
      layout: createCrowdVisibilityLayout([], []),
      frustumPlanes: new Float64Array([1, 0, 0, 2]),
      camera: { x: 0, y: 0, z: 0 },
      projectedScale: 100,
      perspective: true,
      maxTiles: -1,
      maxInstances: Number.NaN,
      detailedPixels: 42,
      meshPixels: 28,
    });
    expect([...target.subarray(0, 24)]).toEqual(Array(24).fill(0));
    expect(target[29]).toBe(0);
    expect(target[30]).toBe(0);
  });
  it("publishes packed values before releasing the ready state", () => {
    const mailbox = createCrowdMailbox();
    Atomics.store(mailbox.state, 0, 1);
    const consumer = new Int32Array(mailbox.state.buffer);
    publishCrowdResult(mailbox, new Uint32Array([4, 10, 15]));
    expect(Atomics.load(consumer, 0)).toBe(2);
    expect(Atomics.load(consumer, 1)).toBe(3);
    expect(Array.from(new Uint32Array(mailbox.packed.buffer, 0, 3))).toEqual([4, 10, 15]);
    expect(() => publishCrowdResult(mailbox, new Uint32Array(MAILBOX_CAPACITY + 1))).toThrow(
      RangeError,
    );
  });
});
