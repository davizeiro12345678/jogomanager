import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createWeatherDrops } from "../components/game/stadium/stadium-cosmetics";
import {
  initializeWeatherInstanceMatrices,
  writeWeatherInstancePosition,
} from "./weather-instance-data";

describe("weather shared-orientation transforms", () => {
  it.each([true, false])("matches the former full Object3D matrix for rain=%s", (rain) => {
    const drops = createWeatherDrops("weather-matrix-parity", 31);
    const legacy = new THREE.Object3D();
    const expected = new Float32Array(drops.length * 16);
    const actual = new Float32Array(drops.length * 16);
    for (const wind of [-1, -0.3, 0, 0.25, 1]) {
      initializeWeatherInstanceMatrices(actual, rain, wind);
      for (let index = 0; index < drops.length; index++) {
        const drop = drops[index]!;
        legacy.position.set(drop.x, drop.y, drop.z);
        legacy.rotation.set(0, 0, rain ? wind * 0.28 : 0);
        legacy.scale.set(1, rain ? 1 : 0.5, 1);
        legacy.updateMatrix();
        expected.set(legacy.matrix.elements, index * 16);
        writeWeatherInstancePosition(actual, index, drop.x, drop.y, drop.z);
      }
      expect(actual).toEqual(expected);
    }
  });

  it("updates only translation and preserves all seeded drop states", () => {
    const drop = createWeatherDrops("weather-state-parity", 1)[0]!;
    const before = structuredClone(drop);
    const matrix = new Float32Array(16);
    initializeWeatherInstanceMatrices(matrix, true, 0.62);
    const orientation = matrix.slice();
    for (const [x, y, z] of [
      [12, 30, -25],
      [-10, 0.01, 18],
      [0, 34, 0],
    ]) {
      writeWeatherInstancePosition(matrix, 0, x!, y!, z!);
      for (let index = 0; index < 16; index++)
        if (index < 12 || index > 14) expect(matrix[index]).toBe(orientation[index]);
    }
    expect(drop).toEqual(before);
  });
});
