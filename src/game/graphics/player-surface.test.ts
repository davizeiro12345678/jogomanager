import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applySurface,
  surfaceFromSteps,
  surfaceKey,
  surfaceState,
  surfaceSteps,
} from "./player-surface";

describe("match player surfaces", () => {
  it("repeats and reverses weather without accumulating gloss or losing club colours", () => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "#f5f4ec",
      roughness: 0.82,
      clearcoat: 0.04,
      clearcoatRoughness: 0.65,
      sheen: 0.45,
    });
    const original = material.color.getHexString();
    const rain = surfaceState({ minute: 85, weather: "chuva" });
    applySurface(material, rain);
    const first = [
      material.color.getHexString(),
      material.roughness,
      material.clearcoat,
      material.sheen,
    ];
    for (let i = 0; i < 12; i++) applySurface(material, rain);
    expect([
      material.color.getHexString(),
      material.roughness,
      material.clearcoat,
      material.sheen,
    ]).toEqual(first);
    expect(material.color.getHexString()).not.toBe(original);
    expect(material.roughness).toBeGreaterThanOrEqual(0.28);
    applySurface(material, { sweat: 0, dirt: 0, wet: 0, fatigue: 0 });
    expect(material.color.getHexString()).toBe(original);
    expect(material.roughness).toBe(0.82);
    expect(material.clearcoat).toBe(0.04);
    material.dispose();
  });

  it("keeps skin tone while fabric accumulates grass and rain", () => {
    const skin = new THREE.MeshStandardMaterial({ color: "#a97857", roughness: 0.7 });
    const colour = skin.color.getHexString();
    applySurface(skin, surfaceState({ minute: 90, weather: "chuva" }), "skin");
    expect(skin.color.getHexString()).toBe(colour);
    expect(skin.roughness).toBeGreaterThan(0.45);
    skin.dispose();
  });

  it("bounds the material cache to eighteen reusable surface states", () => {
    const keys = new Set<string>();
    for (const weather of ["limpo", "chuva", "neve", "nublado"] as const)
      for (let minute = 0; minute < 120; minute++) {
        const steps = surfaceSteps(surfaceState({ minute, weather }));
        keys.add(surfaceKey(steps));
        expect(Object.values(surfaceFromSteps(steps)).every(Number.isFinite)).toBe(true);
      }
    expect(keys.size).toBeLessThanOrEqual(18);
  });
});
