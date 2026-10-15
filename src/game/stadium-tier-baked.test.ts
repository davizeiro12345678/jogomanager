import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { bakeStadiumTierBuckets, bakeStadiumTierGeometry } from "./stadium-tier-baked";
import { stadiumTierInstances, type StadiumTierInstance } from "./stadium-tier-instances";
import { stadiumAisleCenters, stadiumSeatFront } from "./stadium-structure";

describe("baked stadium tier buckets", () => {
  it("matches the instanced source positions, inverse-transpose normals and UVs under nonuniform scale", () => {
    const source = new THREE.BoxGeometry(1, 1, 1);
    const sourcePositions = source.getAttribute("position").array.slice();
    const placements: StadiumTierInstance[] = [
      { position: [3, 7, -11], scale: [135, 1.45, 1.5], rotationY: Math.PI / 2 },
      { position: [-23, 2, 5], scale: [1.1, 1.45 / 6, 1.5 / 6 + 0.02], rotationY: 0 },
    ];
    const baked = bakeStadiumTierGeometry(source, placements);
    for (let placementIndex = 0; placementIndex < placements.length; placementIndex++) {
      const placement = placements[placementIndex]!;
      const transform = new THREE.Object3D();
      transform.position.fromArray(placement.position);
      transform.scale.fromArray(placement.scale);
      transform.rotation.y = placement.rotationY;
      transform.updateMatrix();
      const expected = source.clone().applyMatrix4(transform.matrix);
      for (const name of ["position", "normal", "uv"]) {
        const a = expected.getAttribute(name),
          b = baked.getAttribute(name);
        for (let vertex = 0; vertex < a.count; vertex++)
          for (let component = 0; component < a.itemSize; component++)
            expect(b.getComponent(placementIndex * a.count + vertex, component)).toBeCloseTo(
              a.getComponent(vertex, component),
              6,
            );
      }
      for (let index = 0; index < source.getIndex()!.count; index++)
        expect(baked.getIndex()!.getX(placementIndex * source.getIndex()!.count + index)).toBe(
          source.getIndex()!.getX(index) + placementIndex * source.getAttribute("position").count,
        );
      expected.dispose();
    }
    expect(source.getAttribute("position").array).toEqual(sourcePositions);
    expect(baked.boundingBox!.containsPoint(new THREE.Vector3(3, 7, -11))).toBe(true);
    expect(baked.boundingSphere!.radius).toBeGreaterThan(60);
    source.dispose();
    baked.dispose();
  });

  it("preserves every tier triangle and aisle gap in exactly three owned geometries", () => {
    const plans = stadiumTierInstances(11, 52.5, 34);
    const sources = {
      concrete: new THREE.BoxGeometry(1, 1, 1),
      longitudinalSeats: stadiumSeatFront(135, 1.2, stadiumAisleCenters(52.5)),
      endSeats: new THREE.PlaneGeometry(102, 1.2),
    };
    const sourceDisposed = Object.values(sources).map((geometry) => vi.spyOn(geometry, "dispose"));
    const clone = Object.values(sources).map((geometry) => vi.spyOn(geometry, "clone"));
    const baked = bakeStadiumTierBuckets(sources, plans);
    for (const key of ["concrete", "longitudinalSeats", "endSeats"] as const) {
      expect(baked[key].getAttribute("position").count).toBe(
        sources[key].getAttribute("position").count * plans[key].length,
      );
      expect(baked[key].getIndex()!.count).toBe(sources[key].getIndex()!.count * plans[key].length);
      expect(baked[key].boundingSphere!.radius).toBeGreaterThan(0);
    }
    const disposals = [baked.concrete, baked.longitudinalSeats, baked.endSeats].map((geometry) =>
      vi.spyOn(geometry, "dispose"),
    );
    baked.dispose();
    baked.dispose();
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    sourceDisposed.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    clone.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    Object.values(sources).forEach((geometry) => geometry.dispose());
  });

  it("handles empty buckets without phantom triangles and rejects nonfinite placements", () => {
    const source = new THREE.PlaneGeometry(2, 1);
    const empty = bakeStadiumTierGeometry(source, []);
    expect(empty.getAttribute("position").count).toBe(0);
    expect(empty.getIndex()!.count).toBe(0);
    expect(empty.boundingSphere!.radius).toBe(0);
    expect(() =>
      bakeStadiumTierGeometry(source, [{ position: [NaN, 0, 0], scale: [1, 1, 1], rotationY: 0 }]),
    ).toThrow(/finite/);
    empty.dispose();
    source.dispose();
  });
});
