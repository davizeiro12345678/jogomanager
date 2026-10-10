import { describe, expect, it } from "vitest";
import { FrameRateWindow } from "./frame-rate-window";
describe("FrameRateWindow", () => {
  it("reports recent frames independently of earlier stalls", () => {
    const meter = new FrameRateWindow(1000);
    expect(meter.sample(0)).toBeNull();
    expect(meter.sample(5000)?.fps).toBe(0.2);
    for (let index = 1; index < 50; index++) expect(meter.sample(5000 + index * 20)).toBeNull();
    expect(meter.sample(6000)).toEqual({ fps: 50, meanMs: 20, frames: 50, elapsedMs: 1000 });
  });
  it("does not count hidden-tab time on resume", () => {
    const meter = new FrameRateWindow(1000);
    meter.sample(0);
    meter.sample(500);
    meter.sample(1000, true);
    expect(meter.sample(10000)).toBeNull();
    expect(meter.sample(11000)?.frames).toBe(1);
  });
  it("rejects invalid intervals and timestamps", () => {
    expect(() => new FrameRateWindow(0)).toThrow();
    const meter = new FrameRateWindow(100);
    meter.sample(0);
    expect(meter.sample(Number.NaN)).toBeNull();
    expect(meter.sample(500)).toBeNull();
    expect(meter.sample(600)?.fps).toBe(10);
  });
});
