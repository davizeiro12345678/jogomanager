import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("ships five authored linear KTX2 maps with complete 1024-pixel mip chains", () => {
  for (const name of [
    "hair-normal",
    "fabric-normal",
    "fabric-rough",
    "turf-normal",
    "turf-rough",
  ]) {
    const data = readFileSync(
      new URL(`../../../public/textures/detail-v1/${name}.ktx2`, import.meta.url),
    );
    expect(
      data
        .subarray(0, 12)
        .equals(
          Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]),
        ),
    ).toBe(true);
    expect(data.readUInt32LE(12)).toBe(0);
    expect(data.readUInt32LE(20)).toBe(1024);
    expect(data.readUInt32LE(24)).toBe(1024);
    expect(data.readUInt32LE(40)).toBe(11);
    expect([1, 2]).toContain(data.readUInt32LE(44));
    const dfd = data.readUInt32LE(48);
    expect(data[dfd + 13]).toBe(0); // unspecified primaries for non-colour data
    expect(data[dfd + 14]).toBe(1); // linear transfer function
    expect(data.length).toBeLessThan(1024 * 1024);
  }
});
