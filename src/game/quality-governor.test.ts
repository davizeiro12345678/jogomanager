import { describe, expect, it } from "vitest";
import { QualityGovernor } from "./quality-governor";

function runWindow(governor: QualityGovernor, frameMs: number, frames = 45) {
  for (let i = 0; i < frames; i++) governor.sample(frameMs / 1000);
  return governor.stage;
}

describe("adaptive match quality governor", () => {
  it("reacts to severe frame-budget misses before the match spends many seconds overloaded", () => {
    const governor = new QualityGovernor(20);

    expect(runWindow(governor, 65)).toBe(3);
    expect(runWindow(governor, 65)).toBe(6);
    expect(resolveStageWithSustainedPressure(governor, 65)).toBe(8);
  });

  it("does not lower the scene for an isolated spike or invalid frame delta", () => {
    const governor = new QualityGovernor(20);
    governor.sample(Number.NaN);
    expect(governor.stage).toBe(0);

    governor.sample(0.75);
    governor.sample(0.75);
    expect(governor.stage).toBe(0);
  });

  it("recovers one stage at a time only after sustained headroom", () => {
    const governor = new QualityGovernor(20);
    runWindow(governor, 65);
    runWindow(governor, 65);
    resolveStageWithSustainedPressure(governor, 65);
    expect(governor.stage).toBe(8);

    for (let i = 0; i < 2_300; i++) governor.sample(0.01);
    expect(governor.stage).toBe(7);
  });
});

function resolveStageWithSustainedPressure(governor: QualityGovernor, frameMs: number) {
  for (let i = 0; i < 12; i++) runWindow(governor, frameMs);
  return governor.stage;
}
