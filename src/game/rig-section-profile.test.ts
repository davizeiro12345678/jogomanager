import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateRigSectionFallback } from "./rig-section-kernel";

// SHA-256 of the complete Float32 output from commit 76f51b6. These
// independent reference buffers include seams, cap UVs and signed zero.
const references = [
  {
    rows: 2,
    radial: 3,
    roundness: 0.25,
    caps: 2,
    sha256: "35cdc29cd1b04d40f5118a71ab9f97dc4915af6e53a6cb6b642471c9b7195615",
  },
  {
    rows: 2,
    radial: 16,
    roundness: 1,
    caps: 3,
    sha256: "4067e8fa90bca21e7a26a6be89ab5be44f8665ea583bf585d5ce964b3b813caf",
  },
  {
    rows: 2,
    radial: 64,
    roundness: 1.2,
    caps: 0,
    sha256: "26acff4059a3f9e148eb180c1c13256d837f5c006d2cfb80e1738fb6d681404c",
  },
  {
    rows: 2,
    radial: 80,
    roundness: 2,
    caps: 1,
    sha256: "85fb19fedcedfbd750e8716074a98a3ca02d5ecaec67dc6460d69393f5965f4f",
  },
  {
    rows: 2,
    radial: 128,
    roundness: 4,
    caps: 2,
    sha256: "01430a7184bbbbb193a9050f5b1b14e651cca160304dd63a4f69b9b468561018",
  },
  {
    rows: 16,
    radial: 3,
    roundness: 0.25,
    caps: 0,
    sha256: "a8ea40e3b9036f1e82e0eeea218ae39bb2d90af4987a60787eea52d4ceeeb9ed",
  },
  {
    rows: 16,
    radial: 16,
    roundness: 1,
    caps: 1,
    sha256: "6973eb61e3ce98aa51ca3fc36a4d29a98f690ccf0ebb32af9151e24f3d67b34b",
  },
  {
    rows: 16,
    radial: 64,
    roundness: 1.2,
    caps: 2,
    sha256: "1823f952e13d8fee134617b22f35c02a86eecff2b17f939a90fa57258bcd975a",
  },
  {
    rows: 16,
    radial: 80,
    roundness: 2,
    caps: 3,
    sha256: "c9d25f229bf697f9de700adfd73a2d95d87c72b805ea53d57a947c7af974080f",
  },
  {
    rows: 16,
    radial: 128,
    roundness: 4,
    caps: 0,
    sha256: "03c5af4c9d7d307075e864e7aa5e3f4a2e44596650cb9118e791c3d1ddd6a617",
  },
  {
    rows: 256,
    radial: 3,
    roundness: 0.25,
    caps: 0,
    sha256: "b4fb84e8d4efa417d64ad627b2d63d7cdffbe05e1cb42bd86556299adc9f4c44",
  },
  {
    rows: 256,
    radial: 16,
    roundness: 1,
    caps: 1,
    sha256: "a06d2f73f7a57c2df2da96c87ac9480caae3de3451e6e3e8a9505af2e2a9f8d1",
  },
  {
    rows: 256,
    radial: 64,
    roundness: 1.2,
    caps: 2,
    sha256: "70e5fc5519e6bdfc36d10292059af8e2737d0cb3fe1e532b5afdf257f9bca8a6",
  },
  {
    rows: 256,
    radial: 80,
    roundness: 2,
    caps: 3,
    sha256: "d55d0d98f0e0f0f4924b555f9dc983faee815beb899bdc7ca7a7c75834841e83",
  },
  {
    rows: 256,
    radial: 128,
    roundness: 4,
    caps: 0,
    sha256: "56ba9ee2e54154a3260cc1d9028b31a7b03dff4f364e6da047e3441c07f99311",
  },
] as const;

function ringsFor(rows: number) {
  return Float64Array.from({ length: rows * 4 }, (_, index) => {
    const row = Math.floor(index / 4);
    switch (index % 4) {
      case 0:
        return row * 0.0001;
      case 1:
        return 0.35 + row * 0.002;
      case 2:
        return 0.24 + row * 0.001;
      default:
        return ((row % 3) - 1) * 0.01;
    }
  });
}

describe("rig-section angular profile reuse", () => {
  it.each(references)(
    "preserves baseline bytes at $rows rings/$radial sides/$roundness roundness",
    ({ rows, radial, roundness, caps, sha256 }) => {
      const output = generateRigSectionFallback({ rings: ringsFor(rows), radial, roundness, caps });
      expect(createHash("sha256").update(new Uint8Array(output.buffer)).digest("hex")).toBe(sha256);
    },
  );

  it("reflects mutated input and keeps each generated buffer independently owned", () => {
    const input = { rings: ringsFor(16), radial: 64, roundness: 1.2, caps: 3 };
    const first = generateRigSectionFallback(input);
    const preserved = first.slice();
    input.rings[1] = 0.72;
    const second = generateRigSectionFallback(input);
    expect(second.buffer).not.toBe(first.buffer);
    expect(second[5]).not.toBe(first[5]);
    expect(first).toEqual(preserved);
    input.roundness = 0.5;
    const third = generateRigSectionFallback(input);
    expect(third[5]).not.toBe(second[5]);
  });
});
