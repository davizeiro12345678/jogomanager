import { describe, expect, it } from "vitest";
import { performanceMemorySample } from "./performance-memory";

describe("performance memory evidence scopes", () => {
  it("labels browser heap and deduplicated scene estimates without inventing RAM or VRAM", () => {
    const sample = performanceMemorySample(
      { memory: { usedJSHeapSize: 100, totalJSHeapSize: 200, jsHeapSizeLimit: 1000 } },
      { geometryBytes: 16, textureBytes: 64 },
    );
    expect(sample.jsHeap).toMatchObject({
      available: true,
      usedBytes: 100,
      allocatedBytes: 200,
      limitBytes: 1000,
    });
    expect(sample.sceneReferencedResources).toMatchObject({ geometryBytes: 16, textureBytes: 64 });
    expect(sample.processRam).toMatchObject({ available: false, bytes: null });
    expect(sample.deviceVram).toMatchObject({ available: false, bytes: null });
    expect(sample.sceneReferencedResources).not.toHaveProperty("totalBytes");
  });

  it.each([
    null,
    {},
    { memory: {} },
    { memory: { usedJSHeapSize: NaN, totalJSHeapSize: -1, jsHeapSizeLimit: Infinity } },
  ])("keeps unavailable or invalid browser values null: %j", (source) => {
    const sample = performanceMemorySample(source, { geometryBytes: 0, textureBytes: 0 });
    expect(sample.jsHeap).toMatchObject({
      available: false,
      usedBytes: null,
      allocatedBytes: null,
      limitBytes: null,
    });
    expect(sample.sceneReferencedResources.geometryBytes).toBe(0);
    expect(sample.processRam.bytes).toBeNull();
    expect(sample.deviceVram.bytes).toBeNull();
  });

  it("tolerates privacy getters without changing unavailable into zero", () => {
    const source = {
      get memory() {
        throw new Error("restricted");
      },
    };
    const sample = performanceMemorySample(source, { geometryBytes: NaN, textureBytes: -1 });
    expect(sample.jsHeap.usedBytes).toBeNull();
    expect(sample.sceneReferencedResources.geometryBytes).toBeNull();
    expect(sample.sceneReferencedResources.textureBytes).toBeNull();
  });
});
