import { describe, expect, it } from "vitest";

import { heapUsedBytes } from "./frame-metrics";

describe("heapUsedBytes", () => {
  it("reads Chromium's optional performance.memory metric", () => {
    expect(heapUsedBytes({ memory: { usedJSHeapSize: 42_000 } })).toBe(42_000);
    expect(heapUsedBytes({})).toBeNull();
  });
});
