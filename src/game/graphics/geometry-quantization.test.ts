import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { decodeQuantizedPosition, quantizeGeometryPositions } from "./geometry-quantization";

describe("16-bit stadium/meshlet geometry quantization", () => {
  it("halves position buffer bytes with <=half-step reconstruction error", () => {
    const geometry = new THREE.SphereGeometry(4, 24, 16);
    const packed = quantizeGeometryPositions(geometry);
    const original = geometry.getAttribute("position");
    expect(packed.data.byteLength).toBe(original.array.byteLength / 2);
    for (let i = 0; i < original.count; i++) {
      const decoded = decodeQuantizedPosition(packed, i);
      expect(Math.abs(decoded.x - original.getX(i))).toBeLessThanOrEqual(packed.scale.x / 2 + 1e-5);
      expect(Math.abs(decoded.y - original.getY(i))).toBeLessThanOrEqual(packed.scale.y / 2 + 1e-5);
      expect(Math.abs(decoded.z - original.getZ(i))).toBeLessThanOrEqual(packed.scale.z / 2 + 1e-5);
    }
    geometry.dispose();
  });
  it("rejects malformed geometry instead of corrupting GPU indices", () => {
    const mesh = new THREE.BufferGeometry();
    expect(() => quantizeGeometryPositions(mesh)).toThrow(TypeError);
    mesh.dispose();
  });
});
