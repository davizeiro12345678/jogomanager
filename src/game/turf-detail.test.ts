import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildTurfDetail } from "./turf-detail";
import { initSync, build_turf_detail } from "./wasm/pkg/crowd_visibility_wasm";

initSync({
  module: readFileSync(new URL("./wasm/pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
});
it("keeps Rust/WASM and the fallback byte-identical for all detail budgets", () => {
  for (const size of [32, 64, 256, 512])
    for (const seed of [0, 2106, 0xffffffff]) {
      expect(
        Buffer.compare(
          Buffer.from(build_turf_detail(size, seed)),
          Buffer.from(buildTurfDetail(size, seed)),
        ),
      ).toBe(0);
    }
});
it("bounds allocations and produces varied opaque data with nearly unit normals", () => {
  for (const size of [
    0,
    31,
    33,
    64.5,
    2048,
    2 ** 32 + 64,
    -(2 ** 32) + 64,
    Number.MAX_VALUE,
    NaN,
    Infinity,
    -Infinity,
  ]) {
    expect(buildTurfDetail(size, 1)).toHaveLength(0);
    expect(build_turf_detail(size, 1)).toHaveLength(0);
  }
  const bytes = buildTurfDetail(64, 2106);
  for (let i = 0; i < 64 * 64 * 4; i += 4) {
    const x = (bytes[i]! / 255) * 2 - 1,
      y = (bytes[i + 1]! / 255) * 2 - 1,
      z = (bytes[i + 2]! / 255) * 2 - 1;
    expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 1);
    expect(bytes[i + 3]).toBe(255);
  }
});
