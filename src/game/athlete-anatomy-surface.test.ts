import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { anatomicalLimb } from "./rig-geometry";
import { playerMaterials } from "./player-materials";
import { lookFor } from "./player-model";

const kit = { base: "#be2035", detail: "#fff", shorts: "#18202b", socks: "#be2035", pattern: "solid" } as const;

describe("athlete anatomy and material response", () => {
  it("mirrors medial muscle landmarks while retaining identical joint openings", () => {
    for (const kind of ["thigh", "calf", "forearm"] as const) {
      const left = anatomicalLimb(kind, 0.44, 0.06, 16, false, undefined, 1);
      const right = anatomicalLimb(kind, 0.44, 0.06, 16, false, undefined, -1);
      const a = left.getAttribute("position"), b = right.getAttribute("position");
      let asymmetry = 0;
      const rows = a.count / 17;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= 16; col++) {
          const i = row * 17 + col, mirrored = row * 17 + (16 - col);
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
      left.dispose(); right.dispose();
    }
  });

  it("keeps shorts twill and sock rib roughness distinct from shirt weave", () => {
    const first = playerMaterials(lookFor("surface-a", "MF"), kit, null, "alta");
    const second = playerMaterials(lookFor("surface-b", "DF"), kit, null, "alta");
    const shorts = first.shorts as THREE.MeshStandardMaterial;
    const socks = first.socks as THREE.MeshStandardMaterial;
    expect(shorts.roughnessMap).not.toBe((first.jersey as THREE.MeshStandardMaterial).roughnessMap);
    expect(socks.roughnessMap).not.toBe(shorts.roughnessMap);
    expect(shorts.roughnessMap).toBe((second.shorts as THREE.MeshStandardMaterial).roughnessMap);
    expect(socks.roughnessMap).toBe((second.socks as THREE.MeshStandardMaterial).roughnessMap);
    expect(shorts.roughnessMap!.colorSpace).toBe(THREE.NoColorSpace);
    expect(socks.roughnessMap!.colorSpace).toBe(THREE.NoColorSpace);
    expect((shorts.roughnessMap as THREE.DataTexture).image.data!.byteLength).toBeLessThanOrEqual(64 * 64 * 4);
  });

  it("preserves nonmetallic, restrained specular highlights on dry and sweaty skin", () => {
    const look = lookFor("surface-skin", "MF");
    const dry = playerMaterials({ ...look, sweat: 0 }, kit, null, "alta").skin as THREE.MeshPhysicalMaterial;
    const wet = playerMaterials({ ...look, sweat: 1 }, kit, null, "alta").skin as THREE.MeshPhysicalMaterial;
    expect(dry.metalness).toBe(0);
    expect(dry.roughness).toBeGreaterThan(wet.roughness);
    expect(wet.specularIntensity).toBeGreaterThan(dry.specularIntensity);
    expect(wet.specularIntensity).toBeLessThan(0.65);
    expect(wet.clearcoat).toBeLessThan(0.2);
  });
});
