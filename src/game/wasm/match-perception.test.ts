import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluatePassLanesFallback } from "./match-perception";
import { initSync, evaluate_pass_lanes } from "./pkg/crowd_visibility_wasm";

describe("batch match perception", () => {
  it("identifies defenders closing a passing lane", () => {
    const receivers = new Float64Array([20, 0, 0, 0]);
    const open = evaluatePassLanesFallback(0, 0, receivers, new Float64Array([10, 3, 0, 0]));
    const closing = evaluatePassLanesFallback(0, 0, receivers, new Float64Array([10, 3, 0, -4]));
    expect(open[2]).toBe(0);
    expect(closing[2]).toBeGreaterThan(open[2]!);
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
    }
  });
});
