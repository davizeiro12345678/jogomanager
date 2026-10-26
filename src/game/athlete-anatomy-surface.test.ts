import { describe, expect, it, vi } from "vitest";
import * as compressedTextures from "./textures/ktx2";
import * as THREE from "three";
import {
  anatomicalLimb,
  anatomicalSection,
  tailoredJerseySurface,
  neckSurface,
  clothSurface,
  athleticTorsoSurface,
} from "./rig-geometry";
import { playerMaterials } from "./player-materials";
import { lookFor } from "./player-model";

const kit = {
  base: "#be2035",
  detail: "#fff",
  shorts: "#18202b",
  socks: "#be2035",
  pattern: "solid",
} as const;

describe("athlete anatomy and material response", () => {
  it("keeps the sculpted neck and shirt UV seam smooth while preserving hard cap normals", () => {
    for (const sculpt of [
      (geometry: THREE.BufferGeometry) => neckSurface(geometry, 0.06, 0.12),
      (geometry: THREE.BufferGeometry) => tailoredJerseySurface(geometry, 0.21),
      (geometry: THREE.BufferGeometry) => clothSurface(geometry),
      (geometry: THREE.BufferGeometry) => athleticTorsoSurface(geometry, 0.21, 0.3),
    ]) {
      const radial = 24;
      const rings = [
        { y: 0, width: 0.18, depth: 0.11 },
        { y: 0.15, width: 0.21, depth: 0.12 },
        { y: 0.3, width: 0.17, depth: 0.1 },
      ];
      const geometry = anatomicalSection(rings, radial, 1, true, 1);
      sculpt(geometry);
      const normals = geometry.getAttribute("normal");
      for (let row = 0; row < rings.length; row++) {
        const a = row * (radial + 1),
          b = a + radial;
        expect(normals.getX(a)).toBeCloseTo(normals.getX(b), 6);
        expect(normals.getY(a)).toBeCloseTo(normals.getY(b), 6);
        expect(normals.getZ(a)).toBeCloseTo(normals.getZ(b), 6);
      }
      const capCenter = rings.length * (radial + 1);
      expect(Math.abs(normals.getY(capCenter))).toBeCloseTo(1, 6);
      expect(normals.getY(capCenter)).not.toBeCloseTo(normals.getY(0), 2);
      geometry.dispose();
    }
  });
  it("tailors shirt drape without moving attachment rings or adding topology", () => {
    const geometry = anatomicalSection(
      [
        { y: 0, width: 0.18, depth: 0.11 },
        { y: 0.3, width: 0.21, depth: 0.12 },
        { y: 0.6, width: 0.17, depth: 0.1 },
      ],
      24,
    );
    const original = geometry.getAttribute("position").clone();
    const indexCount = geometry.getIndex()!.count;
    tailoredJerseySurface(geometry, 0.21);
    const position = geometry.getAttribute("position"),
      uv = geometry.getAttribute("uv");
    let relief = 0;
    for (let i = 0; i < position.count; i++) {
      expect(position.getY(i)).toBe(original.getY(i));
      const delta = Math.hypot(
        position.getX(i) - original.getX(i),
        position.getZ(i) - original.getZ(i),
      );
      if (uv.getY(i) === 0 || uv.getY(i) === 1) expect(delta).toBeLessThan(1e-7);
      expect(delta).toBeLessThan(0.012);
      relief = Math.max(relief, delta);
    }
    expect(relief).toBeGreaterThan(0.002);
    expect(position.array.length).toBe(original.array.length);
    expect(geometry.getIndex()!.count).toBe(indexCount);
    geometry.dispose();
  });
  it("mirrors medial muscle landmarks while retaining identical joint openings", () => {
    for (const kind of ["thigh", "calf", "forearm"] as const) {
      const left = anatomicalLimb(kind, 0.44, 0.06, 16, false, undefined, 1);
      const right = anatomicalLimb(kind, 0.44, 0.06, 16, false, undefined, -1);
      const a = left.getAttribute("position"),
        b = right.getAttribute("position");
      let asymmetry = 0;
      const rows = a.count / 17;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= 16; col++) {
          const i = row * 17 + col,
            mirrored = row * 17 + (16 - col);
          expect(a.getX(i)).toBeCloseTo(-b.getX(mirrored), 6);
          expect(a.getZ(i)).toBeCloseTo(b.getZ(mirrored), 6);
          asymmetry = Math.max(asymmetry, Math.abs(a.getZ(i) - b.getZ(i)));
          if (row === 0 || row === rows - 1) {
            expect(a.getX(i)).toBeCloseTo(b.getX(i), 6);
            expect(a.getZ(i)).toBeCloseTo(b.getZ(i), 6);
          }
        }
      }
      expect(asymmetry).toBeGreaterThan(0.0003);
      expect(asymmetry).toBeLessThan(0.008);
      left.dispose();
      right.dispose();
    }
  });

  it("keeps fallback shorts twill and sock rib roughness distinct when compressed maps are unavailable", () => {
    const fallback = vi
      .spyOn(compressedTextures, "needsKtx2ProceduralFallback")
      .mockReturnValue(true);
    try {
      const first = playerMaterials(lookFor("surface-a", "MF"), kit, null, "alta");
      const second = playerMaterials(lookFor("surface-b", "DF"), kit, null, "alta");
      const shorts = first.shorts as THREE.MeshStandardMaterial;
      const socks = first.socks as THREE.MeshStandardMaterial;
      expect(shorts.roughnessMap).not.toBe(
        (first.jersey as THREE.MeshStandardMaterial).roughnessMap,
      );
      expect(socks.roughnessMap).not.toBe(shorts.roughnessMap);
      expect(shorts.roughnessMap).toBe((second.shorts as THREE.MeshStandardMaterial).roughnessMap);
      expect(socks.roughnessMap).toBe((second.socks as THREE.MeshStandardMaterial).roughnessMap);
      expect(shorts.roughnessMap!.colorSpace).toBe(THREE.NoColorSpace);
      expect(socks.roughnessMap!.colorSpace).toBe(THREE.NoColorSpace);
      expect((shorts.roughnessMap as THREE.DataTexture).image.data!.byteLength).toBeLessThanOrEqual(
        64 * 64 * 4,
      );
    } finally {
      fallback.mockRestore();
    }
  });

  it("preserves nonmetallic, restrained specular highlights on dry and sweaty skin", () => {
    const look = lookFor("surface-skin", "MF");
    const dry = playerMaterials({ ...look, sweat: 0 }, kit, null, "alta")
      .skin as THREE.MeshPhysicalMaterial;
    const wet = playerMaterials({ ...look, sweat: 1 }, kit, null, "alta")
      .skin as THREE.MeshPhysicalMaterial;
    expect(dry.metalness).toBe(0);
    expect(dry.roughness).toBeGreaterThan(wet.roughness);
    expect(wet.specularIntensity).toBeGreaterThan(dry.specularIntensity);
    expect(wet.specularIntensity).toBeLessThan(0.65);
    expect(wet.clearcoat).toBeLessThan(0.2);
  });
});
