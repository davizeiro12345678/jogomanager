import { describe, expect, it } from "vitest";
import { cinematicArrivalLighting } from "./cinematic-arrival-lighting";

describe("motivated arrival daylight", () => {
  it("gives the outdoor arrival coherent sky, fog and reflected daylight", () => {
    const light = cinematicArrivalLighting("arrival", "arrival")!;
    expect(light.sky).toBe("#8fa8bd");
    expect(light.fog).toBe("#8299a9");
    expect(light.ambient).toBeGreaterThan(0.5);
    expect(light.hemisphere).toBeGreaterThan(0.45);
    expect(light.keyIntensity).toBeLessThanOrEqual(3);
  });

  it("does not recolor other sets or arrival variants", () => {
    expect(cinematicArrivalLighting("office", "arrival")).toBeNull();
    expect(cinematicArrivalLighting("arrival", "training")).toBeNull();
  });
});
