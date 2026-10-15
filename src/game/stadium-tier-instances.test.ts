import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { stadiumTierInstances } from "./stadium-tier-instances";
import { stadiumAisleCenters, STADIUM_STAIR_SUBSTEPS } from "./stadium-structure";

describe("stadium tier instances", () => {
  it("keeps every tier and real stair tread in three immutable mesh buckets", () => {
    const rings = 11;
    const { concrete, longitudinalSeats, endSeats } = stadiumTierInstances(rings, 52.5, 34);
    expect(concrete).toHaveLength(
      rings * 4 + stadiumAisleCenters(52.5).length * 2 * rings * STADIUM_STAIR_SUBSTEPS,
    );
    expect(longitudinalSeats).toHaveLength(rings * 2);
    expect(endSeats).toHaveLength(rings * 2);
    const transform = new THREE.Object3D();
    for (const placement of [...concrete, ...longitudinalSeats, ...endSeats]) {
      transform.position.fromArray(placement.position);
      transform.scale.fromArray(placement.scale);
      transform.rotation.y = placement.rotationY;
      transform.updateMatrix();
      expect(transform.matrix.elements.every(Number.isFinite)).toBe(true);
      expect(transform.matrix.determinant()).toBeGreaterThan(0);
    }
  });

  it("preserves the facing direction and exact first/last tier placement", () => {
    const { concrete, longitudinalSeats, endSeats } = stadiumTierInstances(11, 52.5, 34);
    expect(concrete[0]!.position).toEqual([0, 1.28, -41]);
    expect(concrete[0]!.scale).toEqual([135, 1.45, 1.5]);
    expect(longitudinalSeats[0]!.rotationY).toBe(0);
    expect(longitudinalSeats[1]!.rotationY).toBe(Math.PI);
    expect(endSeats[0]!.rotationY).toBe(Math.PI / 2);
    expect(endSeats[1]!.rotationY).toBe(-Math.PI / 2);
    expect(longitudinalSeats.at(-1)!.position[2]).toBeCloseTo(56 - 0.78, 8);
    expect(longitudinalSeats.at(-1)!.position[1]).toBeCloseTo(15.9, 8);
  });

  it("supports empty tiers without phantom or negative instances", () => {
    for (const rings of [0, -1]) {
      const plan = stadiumTierInstances(rings, 52.5, 34);
      expect(Object.values(plan).every((bucket) => bucket.length === 0)).toBe(true);
    }
  });
});
