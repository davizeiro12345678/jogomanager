import { readFileSync } from "node:fs";
import { beforeAll, it, expect } from "vitest";
import init, { FloatNet, wasm_capabilities } from "./pkg/crowd_visibility_wasm";
import { FloatNetMotion } from "./net-float";
import { NetDynamics } from "../net-dynamics";
import { WASM_CAPABILITY } from "./runtime";
let memory: WebAssembly.Memory;
beforeAll(async () => {
  memory = (
    await init({
      module_or_path: readFileSync(new URL("./pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
    })
  ).memory;
});

it.each([
  [28, 16, 7.32, 2.44],
  [28, 16, 1.9, 2.44],
  [18, 10, 1.9, 7.32],
])("keeps Float32 cloth within 2mm of the reference for panel %j", (cols, rows, width, height) => {
  expect(wasm_capabilities() & WASM_CAPABILITY.netFloat32).toBe(WASM_CAPABILITY.netFloat32);
  const reference = new NetDynamics(cols!, rows!, width!, height!);
  const raw = new FloatNet(cols!, rows!, width!, height!);
  const motion = new FloatNetMotion(raw, memory);
  let maxError = 0;
  for (let tick = 0; tick < 160; tick++) {
    if (tick % 45 === 0) {
      reference.impact(0.41, 0.62, 18);
      motion.impact(0.41, 0.62, 18);
    }
    const wind = tick < 80 ? 0.4 : 0;
    reference.step(1 / 60, tick / 60, wind, 0.7);
    motion.step(1 / 60, tick / 60, wind, 0.7);
    for (let i = 0; i < reference.displacement.length; i++)
      maxError = Math.max(maxError, Math.abs(reference.displacement[i]! - motion.displacement[i]!));
  }
  expect(maxError).toBeLessThan(0.002);
  motion.dispose();
});

it("promotes current motion without a reset and refreshes views after WASM memory growth", () => {
  const reference = new NetDynamics(18, 10);
  reference.impact(0.5, 0.5, 20);
  reference.step(0.1, 0, 0);
  const state = reference.snapshot();
  const raw = new FloatNet(18, 10, 7.32, 2.44);
  expect(raw.restore(state.displacement, state.velocity, state.accumulator)).toBe(true);
  const motion = new FloatNetMotion(raw, memory);
  expect(motion.displacement).toEqual(state.displacement);
  const old = motion.displacement;
  memory.grow(1);
  expect(motion.displacement.buffer).not.toBe(old.buffer);
  expect(motion.displacement).toEqual(state.displacement);
  motion.dispose();
  motion.dispose();
  expect(motion.displacement).toEqual(state.displacement);
});
