import { describe, expect, it } from "vitest";
import { planarLength } from "./planar-length";

describe("scaled pitch-plane length", () => {
  it("retains native results for exceptional values and extreme magnitudes", () => {
    const values = [
      0,
      -0,
      1,
      -1,
      3,
      4,
      Number.MIN_VALUE,
      -Number.MIN_VALUE,
      Number.MAX_VALUE,
      1e-150,
      1e150,
      Infinity,
      -Infinity,
      NaN,
    ];
    for (const x of values)
      for (const z of values) expect(Object.is(planarLength(x, z), Math.hypot(x, z))).toBe(true);
  });
  it("matches native float64 results across arbitrary bit patterns", () => {
    const view = new DataView(new ArrayBuffer(16));
    let state = 12345;
    const next = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    };
    for (let sample = 0; sample < 20000; sample++) {
      for (let word = 0; word < 4; word++) view.setUint32(word * 4, next());
      const x = view.getFloat64(0),
        z = view.getFloat64(8);
      expect(Object.is(planarLength(x, z), Math.hypot(x, z))).toBe(true);
    }
  });
});
