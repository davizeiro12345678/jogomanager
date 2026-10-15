import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluatePassLanesFallback, evaluatePassLanesIntoFallback } from "./match-perception";
import {
  initSync,
  evaluate_pass_lanes,
  evaluate_pass_lanes_into,
} from "./pkg/crowd_visibility_wasm";
import { evaluatePassLanesFallback as reference } from "./match-perception-reference.fixture";
import { MatchSim } from "../sim";
import { buildTeamSetup } from "../quickMatch";

describe("batch match perception", () => {
  it("bounds direct ABI copies before receiving oversized untrusted arrays", () => {
    const { memory } = initSync({
      module: readFileSync(new URL("./pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
    });
    const prefix = new Float64Array(64 * 4).fill(20);
    const expected = evaluate_pass_lanes(0, 0, prefix, prefix);
    const oversized = new Float64Array(1_000_000).fill(20);
    const before = memory.buffer.byteLength;
    expect(evaluate_pass_lanes(0, 0, oversized, oversized)).toEqual(expected);
    expect(memory.buffer.byteLength - before).toBeLessThanOrEqual(65_536);
  });
  it("identifies defenders closing a passing lane", () => {
    const receivers = new Float64Array([20, 0, 0, 0]);
    const open = evaluatePassLanesFallback(0, 0, receivers, new Float64Array([10, 3, 0, 0]));
    const closing = evaluatePassLanesFallback(0, 0, receivers, new Float64Array([10, 3, 0, -4]));
    expect(open[2]).toBe(0);
    expect(closing[2]).toBeGreaterThan(open[2]!);
  });
  it("keeps reusable outputs owned by JS and writes only complete records", () => {
    const receivers = new Float64Array([20, 0, 0, 0, 25, 1, 0, 0]);
    const defenders = new Float64Array([10, 2, 0, -4]);
    for (const capacity of [0, 1, 2, 3, 4, 5, 6, 64 * 3]) {
      const fallback = new Float64Array(capacity + 3).fill(12345);
      const rust = fallback.slice();
      const output = rust.subarray(0, capacity);
      const length = evaluatePassLanesIntoFallback(
        0,
        0,
        receivers,
        defenders,
        fallback.subarray(0, capacity),
      );
      expect(evaluate_pass_lanes_into(0, 0, receivers, defenders, output)).toBe(length);
      expect(rust).toEqual(fallback);
      expect(rust.subarray(length)).toEqual(new Float64Array(rust.length - length).fill(12345));
      const saved = rust.slice();
      evaluate_pass_lanes(10, 20, receivers, defenders);
      expect(rust).toEqual(saved);
    }
  });
  it("keeps perception finite for corrupted but finite overflowing coordinates", () => {
    for (const value of [Number.MAX_VALUE, -Number.MAX_VALUE, 1e200, -1e200]) {
      const receivers = new Float64Array([value, -value, value, -value]);
      const defenders = new Float64Array([value, value, value, -value]);
      const fallback = evaluatePassLanesFallback(value, value, receivers, defenders);
      expect(fallback.every(Number.isFinite)).toBe(true);
      expect(evaluate_pass_lanes(value, value, receivers, defenders)).toEqual(fallback);
    }
  });
  it("matches the actual compiled Rust kernel across moving squads", () => {
    initSync({
      module: readFileSync(new URL("./pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
    });
    for (let fixture = 0; fixture < 50; fixture++) {
      const receivers = Float64Array.from({ length: 40 }, (_, i) => Math.sin(i + fixture) * 22);
      const defenders = Float64Array.from({ length: 44 }, (_, i) => Math.cos(i * 3 + fixture) * 17);
      expect(evaluate_pass_lanes(-fixture / 3, 2, receivers, defenders)).toEqual(
        evaluatePassLanesFallback(-fixture / 3, 2, receivers, defenders),
      );
      expect(evaluatePassLanesFallback(-fixture / 3, 2, receivers, defenders)).toEqual(
        reference(-fixture / 3, 2, receivers, defenders),
      );
    }
  });
  it("preserves the reference near interception thresholds and bounded malformed inputs", () => {
    for (const distance of [0, 2.2 - 1e-10, 2.2, 2.2 + 1e-10, 100, 100.001]) {
      const receivers = new Float64Array([20, 0, 0, 0, 0, 0, 0, 0]);
      const defenders = new Float64Array([10, distance, 0, -2, NaN, Infinity, 0, 0]);
      expect(evaluatePassLanesFallback(0, 0, receivers, defenders)).toEqual(
        reference(0, 0, receivers, defenders),
      );
      expect(evaluate_pass_lanes(0, 0, receivers, defenders)).toEqual(
        reference(0, 0, receivers, defenders),
      );
    }
  });
  it("preserves seeded match decisions against the previous kernel", () => {
    for (const seed of ["spatial-1", "spatial-2", "spatial-3"]) {
      const previous = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
      const current = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
      previous.setPassLaneKernel(reference);
      current.setPassLaneKernel(evaluate_pass_lanes);
      try {
        for (let tick = 0; tick < 1200; tick++) {
          previous.step(1 / 30, 6);
          current.step(1 / 30, 6);
        }
        expect(current.players).toEqual(previous.players);
        expect(current.ball).toEqual(previous.ball);
        expect(current.stats).toEqual(previous.stats);
        expect(current.events).toEqual(previous.events);
      } finally {
        previous.dispose();
        current.dispose();
      }
    }
  }, 20000);
});
