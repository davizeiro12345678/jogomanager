import { describe, expect, it } from "vitest";
import { animateBenchSeatedActor, type BenchSeatedActor } from "./bench-seated-animation";

const actor = (phase: number): BenchSeatedActor => ({
  phase,
  group: { position: { y: 0 }, rotation: { z: 0 } },
  torso: { rotation: { x: 0 } },
});

describe("batched bench animation", () => {
  it("preserves the seated idle pose without a goal reaction", () => {
    const target = actor(1.7);
    animateBenchSeatedActor(target, 2.4, 0.5);
    expect(target.torso?.rotation.x).toBeCloseTo(Math.sin(2.4 * 1.4 + 1.7) * 0.05 - 0.06);
    expect(target.group?.position.y).toBe(0.62);
    expect(target.group?.rotation.z).toBeCloseTo(Math.sin(2.4 * 0.9 + 1.7) * 0.03);
  });

  it("preserves the goal bounce and tolerates a temporarily unmounted mesh", () => {
    const target = actor(0.3);
    animateBenchSeatedActor(target, 1.1, 0.8);
    expect(target.group?.position.y).toBeCloseTo(0.62 + Math.abs(Math.sin(1.1 * 9 + 0.3)) * 0.35);
    const unmounted: BenchSeatedActor = { phase: 0, group: null, torso: null };
    expect(() => animateBenchSeatedActor(unmounted, 1, 1)).not.toThrow();
  });
});
