import { describe, expect, it } from "vitest";
import { validSeatTransformRequest, type SeatTransformRequest } from "./seat-transform-contract";

function request(lane = 0, count = 513): SeatTransformRequest {
  const matrices = 64 + count * 72;
  const colors = matrices + count * 64;
  const skins = colors + count * 12;
  const styles = skins + count * 12;
  return {
    module: new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])),
    memory: new WebAssembly.Memory({ initial: 2, maximum: 512, shared: true }),
    lane,
    args: [
      Math.floor((count * lane) / 2),
      Math.floor((count * (lane + 1)) / 2),
      64,
      matrices,
      colors,
      skins,
      styles,
    ],
  };
}

describe("shared seat WASM offset contract", () => {
  it("accepts exact disjoint halves including odd seat counts", () => {
    expect(validSeatTransformRequest(request(0))).toBe(true);
    expect(validSeatTransformRequest(request(1))).toBe(true);
  });
  it("rejects overlapping regions, out-of-bounds writes and forged lane ranges", () => {
    for (const [field, value] of [
      [0, 1],
      [1, 513],
      [2, 0],
      [3, 64],
      [4, 64],
      [5, 64],
      [6, 64],
    ] as const) {
      const invalid = request();
      invalid.args[field] = value;
      expect(validSeatTransformRequest(invalid)).toBe(false);
    }
    const short = request();
    short.memory = new WebAssembly.Memory({ initial: 1, maximum: 512, shared: true });
    expect(validSeatTransformRequest(short)).toBe(false);
    expect(validSeatTransformRequest(request(2))).toBe(false);
    const ordinary = request();
    ordinary.memory = new WebAssembly.Memory({ initial: 2, maximum: 512 });
    expect(validSeatTransformRequest(ordinary)).toBe(false);
  });
  it("rejects malformed offsets before i32 coercion or atomic access", () => {
    for (const value of ["destroy", null, NaN, Infinity, -1, 0.5, 2 ** 32]) {
      const invalid = request();
      const args: unknown[] = [...invalid.args];
      args[0] = value;
      expect(validSeatTransformRequest({ ...invalid, args })).toBe(false);
    }
    for (const value of [null, "destroy", { type: "destroy" }])
      expect(validSeatTransformRequest(value)).toBe(false);
  });
});
