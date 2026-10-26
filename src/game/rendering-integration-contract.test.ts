import { describe, expect, it } from "vitest";
import { BallResponse } from "./ball-response";
import { copyGrassInstanceBuffers } from "./grass-instance-data";
import { keepPitchCameraInRunoff } from "./stand-camera";
import { NetDynamics } from "./net-dynamics";
import {
  cinematicGpuQuality,
  cinematicPresentationBudget,
  CinematicPressureController,
} from "./cinematic-performance";

describe("main-preserving rendering integration", () => {
  it("resets replay ball compression without retaining an old impact impulse", () => {
    const response = new BallResponse();
    response.impact(20);
    expect(response.step(1 / 60).axial).toBeLessThan(1);
    response.reset();
    expect(response.step(1 / 60)).toEqual({ axial: 1, radial: 1 });
  });
  it("publishes a complete grass pair and leaves both buffers intact on mismatched capacity", () => {
    const matrices = new Float32Array(16).fill(4),
      colors = new Float32Array(3).fill(5);
    expect(
      copyGrassInstanceBuffers(matrices, colors, {
        matrices: new Float32Array(32),
        colors: new Float32Array(6),
      }),
    ).toBe(false);
    expect([...matrices, ...colors]).toEqual([...new Array(16).fill(4), ...new Array(3).fill(5)]);
    expect(
      copyGrassInstanceBuffers(matrices, colors, {
        matrices: new Float32Array(16).fill(2),
        colors: new Float32Array(3).fill(3),
      }),
    ).toBe(true);
    expect(matrices.every((value) => value === 2)).toBe(true);
    expect(colors.every((value) => value === 3)).toBe(true);
  });
  it("keeps low pitch cameras in clear runoff and permits a continuous elevated stand transition", () => {
    const low = { x: 100, y: 1.9, z: 100 },
      high = { ...low, y: 8 };
    keepPitchCameraInRunoff(low, 52.5, 34);
    keepPitchCameraInRunoff(high, 52.5, 34);
    expect(low).toEqual({ x: 59.5, y: 1.9, z: 38 });
    expect(high.x).toBeGreaterThan(low.x);
    expect(high.z).toBeGreaterThan(low.z);
  });
  it("uses each real net panel's dimensions while retaining the default constructor and bounded state", () => {
    const defaultPanel = new NetDynamics(18, 10),
      side = new NetDynamics(10, 10, 2, 2.44);
    expect(defaultPanel.width).toBe(7.32);
    expect(side.width).toBe(2);
    side.impact(0.5, 0.5, 25);
    for (let frame = 0; frame < 60; frame++) side.step(1 / 60, frame / 60, 0.3, 1);
    expect(side.snapshot().displacement.every(Number.isFinite)).toBe(true);
    expect(side.snapshot().accumulator).toBeGreaterThanOrEqual(0);
  });
  it("preserves native GPU choice and sheds lens work before portrait quality", () => {
    expect(cinematicGpuQuality("alta", "ANGLE Intel Iris Xe D3D11")).toBe("alta");
    expect(cinematicGpuQuality("alta", "ANGLE SwiftShader")).toBe("baixa");
    expect(cinematicPresentationBudget("alta", 2)).toMatchObject({
      lens: "off",
      actorQuality: "alta",
      resolutionScale: 1,
    });
    const pressure = new CinematicPressureController();
    expect(pressure.sample(20, 50)).toBe(0);
    expect(pressure.sample(20, 50)).toBe(1);
    for (let n = 0; n < 10; n++) pressure.sample(60, 16);
    expect(pressure.stage).toBe(0);
  });
});
