import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { nearestCrowdPoolDepth } from "./crowd-pool-occlusion";

describe("conservative crowd-pool Hi-Z bound", () => {
  it("uses the closest of all currently drawn spectators", () => {
    const seats = new Int32Array([1, 0]);
    const matrices = new Float32Array(32);
    matrices[12] = 0;
    matrices[13] = 0;
    matrices[14] = 0.8;
    matrices[28] = 0;
    matrices[29] = 0;
    matrices[30] = 0.6;
    expect(nearestCrowdPoolDepth(seats, 2, matrices, new THREE.Matrix4())).toBeCloseTo(0.55);
  });
  it("disables occlusion for malformed or empty candidate pools", () => {
    expect(
      nearestCrowdPoolDepth(new Int32Array(), 0, new Float32Array(), new THREE.Matrix4()),
    ).toBe(0);
    expect(
      nearestCrowdPoolDepth(new Int32Array([-1]), 1, new Float32Array(), new THREE.Matrix4()),
    ).toBe(0);
  });
});
