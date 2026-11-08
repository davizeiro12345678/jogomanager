import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  batchStaticStadium,
  captureStaticStadiumState,
  prepareStaticStadiumBatch,
} from "./static-stadium-batch";
import { censusScene, tagCensus } from "./scene-census";

function box(color: string, x: number, roughness = 0.8) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color, roughness }),
  );
  mesh.position.x = x;
  return mesh;
}

function generatedMeshes(root: THREE.Group) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object.userData["staticBatchGenerated"] === true && object instanceof THREE.Mesh)
      meshes.push(object);
  });
  return meshes;
}

describe("immutable stadium batching", () => {
  it("consolidates fixed subsystem colours and inactive shadow splits only with an explicit policy", () => {
    const root = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const mesh = box(i % 2 ? "red" : "blue", i);
      tagCensus(mesh, i < 2 ? "static" : "props");
      mesh.castShadow = i % 2 === 0;
      mesh.receiveShadow = i < 2;
      root.add(mesh);
    }
    const before = censusScene(root);
    const cleanup = batchStaticStadium(root, { bucket: "static", shadows: false });
    const after = censusScene(root);
    expect(after.total.draws).toBe(1);
    expect(after.total.triangles).toBe(before.total.triangles);
    expect(after.total.shadowCasters).toBe(0);
    cleanup();
    expect(censusScene(root).total).toEqual(before.total);
  });
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
    const merged = generatedMeshes(group)[0]!;
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

  it("batches vertex-color sources after baking their material colors into attributes", () => {
    const group = new THREE.Group();
    const plain = box("white", 0);
    const vertexColored = box("white", 2);
    const material = vertexColored.material as THREE.MeshStandardMaterial;
    material.vertexColors = true;
    const positions = vertexColored.geometry.getAttribute("position");
    vertexColored.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(new Float32Array(positions.count * 3).fill(0.5), 3),
    );
    group.add(plain, vertexColored);

    const before = censusScene(group);
    const cleanup = batchStaticStadium(group);
    const after = censusScene(group);
    expect(after.total.draws).toBe(1);
    expect(after.total.triangles).toBe(before.total.triangles);

    const merged = generatedMeshes(group)[0]!;
    const colors = merged.geometry.getAttribute("color");
    expect(colors.getX(0)).toBeCloseTo(1);
    expect(colors.getX(36)).toBeCloseTo(0.5);
    cleanup();
    expect(censusScene(group).total).toEqual(before.total);
  });

  it("keeps renderOrder inherited from groups when creating generated batches", () => {
    const root = new THREE.Group();
    const early = new THREE.Group();
    const late = new THREE.Group();
    early.renderOrder = 2;
    late.renderOrder = 5;
    early.add(box("white", -2), box("white", -1));
    late.add(box("white", 1), box("white", 2));
    root.add(early, late);

    const cleanup = batchStaticStadium(root);
    const generated = generatedMeshes(root);

    expect(generated).toHaveLength(2);
    expect(generated.map((mesh) => mesh.parent?.renderOrder).sort()).toEqual([2, 5]);
    expect(generated.every((mesh) => mesh.renderOrder === 0)).toBe(true);
    cleanup();
    expect(root.children).toEqual([early, late]);
  });

  it("does not merge materials with distinct alpha, blending or forceSinglePass state", () => {
    const root = new THREE.Group();
    const definitions = [
      { blending: THREE.NormalBlending, alphaHash: false, forceSinglePass: true },
      { blending: THREE.AdditiveBlending, alphaHash: false, forceSinglePass: true },
      { blending: THREE.NormalBlending, alphaHash: true, forceSinglePass: false },
    ];
    for (const [index, definition] of definitions.entries()) {
      const material = new THREE.MeshStandardMaterial({
        color: "white",
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        ...definition,
      });
      const first = new THREE.Mesh(new THREE.BoxGeometry(), material);
      const second = new THREE.Mesh(new THREE.BoxGeometry(), material);
      first.position.x = index * 3;
      second.position.x = index * 3 + 1;
      root.add(first, second);
    }

    const cleanup = batchStaticStadium(root);

    expect(cleanup.batches).toBe(3);
    expect(generatedMeshes(root)).toHaveLength(3);
    cleanup();
  });

  it("keeps forceSinglePass groups separate and invalidates a changed source", () => {
    const root = new THREE.Group();
    const singlePass = new THREE.MeshStandardMaterial({
      color: "white",
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
    const twoPass = singlePass.clone();
    twoPass.forceSinglePass = false;
    const sources = [singlePass, twoPass].map((material, index) => {
      const first = new THREE.Mesh(new THREE.BoxGeometry(), material);
      const second = new THREE.Mesh(new THREE.BoxGeometry(), material);
      first.position.x = index * 3;
      second.position.x = index * 3 + 1;
      root.add(first, second);
      return [first, second];
    });

    const cleanup = batchStaticStadium(root);
    const generated = generatedMeshes(root);

    expect(cleanup.batches).toBe(2);
    expect(
      generated.map((mesh) => (mesh.material as THREE.MeshStandardMaterial).forceSinglePass),
    ).toEqual([true, false]);
    twoPass.forceSinglePass = true;
    expect(cleanup.changedSources()).toEqual(sources[1]);

    cleanup();
    for (const mesh of sources.flat()) mesh.geometry.dispose();
    singlePass.dispose();
    twoPass.dispose();
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

  it("does not commit or hide sources when their state changes during preparation", () => {
    const group = new THREE.Group();
    const red = box("#ff0000", -2);
    const green = box("#00ff00", 3);
    group.add(red, green);

    const prepared = prepareStaticStadiumBatch(group);
    red.position.x += 1;

    expect(prepared.commit()).toBeNull();
    expect(group.children).toEqual([red, green]);
    expect(red.visible).toBe(true);
    expect(green.visible).toBe(true);
    prepared.dispose();
  });

  it("reports mutated sources before disposing an immutable batch and disposes only once", () => {
    const group = new THREE.Group();
    const moving = box("white", 0);
    const fixed = box("white", 2);
    group.add(moving, fixed);

    const cleanup = batchStaticStadium(group);
    const merged = generatedMeshes(group)[0]!;
    const materialDispose = vi.spyOn(merged.material as THREE.Material, "dispose");

    expect(cleanup.changedSources()).toEqual([]);
    moving.position.x = 4;
    (fixed.material as THREE.MeshStandardMaterial).roughness = 0.2;
    group.updateWorldMatrix(true, true);
    expect(cleanup.changedSources()).toEqual([moving, fixed]);
    expect(cleanup.changedSources()).toEqual([moving, fixed]);

    cleanup();
    cleanup();
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(moving.visible).toBe(true);
    expect(fixed.visible).toBe(true);
  });

  it("reports a source whose buffer geometry changes after commit", () => {
    const group = new THREE.Group();
    const changing = box("white", 0);
    const fixed = box("white", 2);
    group.add(changing, fixed);

    const cleanup = batchStaticStadium(group);
    const position = changing.geometry.getAttribute("position");
    position.setX(0, position.getX(0) + 0.25);
    position.needsUpdate = true;

    expect(cleanup.changedSources()).toEqual([changing]);
    cleanup();
  });

  it("reports an eligible singleton that changes after another material batch commits", () => {
    const group = new THREE.Group();
    const stableA = box("white", 0);
    const stableB = box("white", 2);
    const singleton = box("white", 4, 0.2);
    singleton.renderOrder = 3;
    group.add(stableA, stableB, singleton);

    const cleanup = batchStaticStadium(group);
    singleton.position.x += 1;

    expect(cleanup.batches).toBe(1);
    expect(cleanup.changedSources()).toEqual([singleton]);
    cleanup();
  });

  it("keeps the stable batch alive after excluding a changed singleton", () => {
    const group = new THREE.Group();
    const stableA = box("white", 0);
    const stableB = box("white", 2);
    const singleton = box("white", 4, 0.2);
    singleton.renderOrder = 3;
    group.add(stableA, stableB, singleton);

    const dynamic = new Set<THREE.Mesh>();
    let cleanup = batchStaticStadium(group, { exclude: dynamic });
    const firstBatch = generatedMeshes(group)[0]!;
    const disposeGeometry = vi.spyOn(firstBatch.geometry, "dispose");
    singleton.position.x += 1;
    for (const source of cleanup.changedSources()) dynamic.add(source);
    cleanup();
    cleanup = batchStaticStadium(group, { exclude: dynamic });
    const stableBatch = generatedMeshes(group)[0]!;
    const stableDispose = vi.spyOn(stableBatch.geometry, "dispose");

    for (let frame = 0; frame < 20; frame++) {
      expect(cleanup.changedSources()).toEqual([]);
      expect(generatedMeshes(group)).toEqual([stableBatch]);
    }
    expect(stableDispose).not.toHaveBeenCalled();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("reports source churn and makes cleanup idempotent", () => {
    const group = new THREE.Group();
    const red = box("#ff0000", -2);
    const green = box("#00ff00", 3);
    group.add(red, green);
    const cleanup = batchStaticStadium(group);
    const baked = generatedMeshes(group)[0]!;
    const geometryDispose = vi.spyOn(baked.geometry, "dispose");
    const materialDispose = vi.spyOn(baked.material as THREE.Material, "dispose");
    const state = captureStaticStadiumState(group);

    red.position.x += 1;
    expect(state.revision).not.toBe(captureStaticStadiumState(group).revision);
    expect(cleanup.isCurrent(captureStaticStadiumState(group).revision)).toBe(false);

    cleanup();
    cleanup();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(group.children).toEqual([red, green]);
  });
});
