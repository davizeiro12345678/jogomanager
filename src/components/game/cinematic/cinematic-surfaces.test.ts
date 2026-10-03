import { describe, expect, it } from "vitest";
import { cinematicNormalPixels, cinematicSurface } from "./cinematic-surfaces";

describe("cinematic PBR surface maps", () => {
  it("encodes a flat height field as a neutral tangent-space normal", () => {
    const height = new Uint8Array(8 * 8).fill(128);
    const normal = cinematicNormalPixels(height, 8, 8);
    const center = (4 * 8 + 4) * 4;

    expect([...normal.slice(center, center + 4)]).toEqual([128, 128, 255, 255]);
  });

  it("uses wrapped neighboring texels and keeps increasing height facing away from the slope", () => {
    const width = 16;
    const height = new Uint8Array(width * width);
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) height[y * width + x] = x * 12;
    }
    const normal = cinematicNormalPixels(height, width, width, 1);
    const center = (8 * width + 8) * 4;
    const edge = 8 * width * 4;

    expect(normal[center]).toBeLessThan(128);
    expect(normal[center + 1]).toBe(128);
    expect(normal[edge]).not.toBe(0);
    expect(normal[edge + 3]).toBe(255);
  });

  it("keeps browser textures out of server rendering", () => {
    expect(cinematicSurface("tile")).toBeNull();
    expect(cinematicSurface("tile", "normal")).toBeNull();
    expect(cinematicSurface("asphalt", "roughness")).toBeNull();
  });
});
