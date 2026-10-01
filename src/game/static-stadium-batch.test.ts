import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { batchStaticStadium } from "./static-stadium-batch";
import { censusScene, tagCensus } from "./scene-census";

function box(color: string, x: number, roughness = 0.8) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color, roughness }),
  );
  mesh.position.x = x;
  return mesh;
}

describe("immutable stadium batching", () => {
  it("reduces draws while preserving positions, colours, triangles and census ownership", () => {
    const group = new THREE.Group();
    group.position.x = 20;
    tagCensus(group, "props");
    const red = box("#ff0000", -2);
    const green = box("#00ff00", 3);
    group.add(red, green);
    const original = censusScene(group);
    const cleanup = batchStaticStadium(group);
    const batched = censusScene(group);
    expect(batched.buckets.props.draws).toBe(1);
    expect(batched.total.triangles).toBe(original.total.triangles);
    const merged = group.children.find((child) => child !== red && child !== green) as THREE.Mesh;
    merged.geometry.computeBoundingBox();
    expect(merged.geometry.boundingBox!.min.x).toBeCloseTo(-2.5);
    expect(merged.geometry.boundingBox!.max.x).toBeCloseTo(3.5);
    const colors = merged.geometry.getAttribute("color");
    expect(colors.getX(0)).toBeCloseTo(1);
    expect(colors.getY(36)).toBeCloseTo(1);
    // A source React child can be reconciled after batching. It must not be
    // rendered a second time alongside the baked version.
    red.visible = true;
    green.visible = true;
    cleanup.hideSources();
    expect(censusScene(group).buckets.props.draws).toBe(1);
    expect(group.children).toHaveLength(3);
    cleanup();
    expect(group.children).toEqual([red, green]);
    expect(censusScene(group).total).toEqual(original.total);
  });

  it("preserves roughness and shadow differences instead of collapsing distinct surfaces", () => {
    const group = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const mesh = box("white", i, i < 4 ? 0.8 : 0.2);
      mesh.castShadow = i >= 2 && i < 4;
      group.add(mesh);
    }
    const cleanup = batchStaticStadium(group);
    expect(censusScene(group).total.draws).toBe(3);
    expect(censusScene(group).total.shadowCasters).toBe(1);
    cleanup();
  });

  it("leaves animated, transparent and hidden objects under their original owner", () => {
    const group = new THREE.Group();
    const transparent = box("white", 0);
    (transparent.material as THREE.Material).transparent = true;
    const animated = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    const instances = new THREE.InstancedMesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial(),
      2,
    );
    const hidden = new THREE.Group();
    hidden.visible = false;
    const hiddenBox = box("white", 0);
    hidden.add(hiddenBox);
    const materialDispose = vi.spyOn(transparent.material as THREE.Material, "dispose");
    group.add(transparent, animated, instances, hidden);
    const cleanup = batchStaticStadium(group);
    expect(group.children).toEqual([transparent, animated, instances, hidden]);
    expect(hiddenBox.visible).toBe(true);
    cleanup();
    expect(materialDispose).not.toHaveBeenCalled();
  });
});
