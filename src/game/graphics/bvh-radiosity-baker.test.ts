import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { bakeVertexRadiosityBvh } from "./bvh-radiosity-baker";

describe("bounded offline BVH radiosity", () => {
  it("bakes deterministic diffuse irradiance without mutating source geometry", () => {
    const source = new THREE.BoxGeometry(2, 2, 2);
    const originalIndex = source.index?.count;
    const opts = {
      seed: 42,
      samples: 4,
      bounces: 2,
      ambient: 0.2,
      sunlight: 0.8,
      lightDirection: new THREE.Vector3(0.2, 1, 0.3),
    };
    const a = bakeVertexRadiosityBvh(source, opts);
    const b = bakeVertexRadiosityBvh(source, opts);
    const colors = a.geometry.getAttribute("color");
    expect(a.bounces).toBe(2);
    expect(a.rays).toBeGreaterThan(0);
    expect(colors.count).toBe(a.vertices);
    expect(Array.from(colors.array as ArrayLike<number>).every(Number.isFinite)).toBe(true);
    expect(Array.from(colors.array as ArrayLike<number>)).toEqual(
      Array.from(b.geometry.getAttribute("color").array as ArrayLike<number>),
    );
    expect(source.getAttribute("color")).toBeUndefined();
    expect(source.index?.count).toBe(originalIndex);
    a.geometry.dispose();
    b.geometry.dispose();
    source.dispose();
  });

  it("supports a direct-only bake and refuses uncontrolled geometry sizes", () => {
    const source = new THREE.BoxGeometry(1, 1, 1);
    expect(() => bakeVertexRadiosityBvh(source, { maxVertices: 3 })).toThrow(
      /bounded triangle mesh/,
    );
    const result = bakeVertexRadiosityBvh(source, { bounces: 0, ambient: 0.15 });
    const light = result.geometry.getAttribute("color");
    expect(result.bounces).toBe(0);
    expect(light.getX(0)).toBeGreaterThanOrEqual(0);
    result.geometry.dispose();
    source.dispose();
  });
});
