import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { batchStaticStadium, captureStaticStadiumState } from "@/game/static-stadium-batch";

function actorPart() {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
}

describe("static stadium batch dynamic boundaries", () => {
  it("keeps a rigid actor subtree visible and owned by its frame synchronizer", () => {
    const root = new THREE.Group();
    const actorRoot = new THREE.Group();
    actorRoot.userData["cinematicDynamic"] = true;
    const first = actorPart();
    const second = actorPart();
    actorRoot.add(first, second);
    root.add(actorRoot);

    const cleanup = batchStaticStadium(root);

    expect(root.children).toEqual([actorRoot]);
    expect(actorRoot.children).toEqual([first, second]);
    expect(first.visible).toBe(true);
    expect(second.visible).toBe(true);
    cleanup();
    expect(root.children).toEqual([actorRoot]);
    expect(actorRoot.children).toEqual([first, second]);

    first.geometry.dispose();
    second.geometry.dispose();
    (first.material as THREE.Material).dispose();
    (second.material as THREE.Material).dispose();
  });

  it("does not invalidate a static batch when an excluded dynamic subtree moves", () => {
    const root = new THREE.Group();
    const first = actorPart();
    const second = actorPart();
    const actorRoot = new THREE.Group();
    actorRoot.userData["cinematicDynamic"] = true;
    const actor = actorPart();
    actorRoot.add(actor);
    root.add(first, second, actorRoot);

    const cleanup = batchStaticStadium(root);
    const before = captureStaticStadiumState(root).revision;
    actor.position.x += 2;

    expect(captureStaticStadiumState(root).revision).toBe(before);
    expect(cleanup.isCurrent(before)).toBe(true);
    cleanup();
    first.geometry.dispose();
    second.geometry.dispose();
    actor.geometry.dispose();
    (first.material as THREE.Material).dispose();
    (second.material as THREE.Material).dispose();
    (actor.material as THREE.Material).dispose();
  });

  it("does not invalidate the static scene when a dynamic scoreboard texture changes", () => {
    const root = new THREE.Group();
    const first = actorPart();
    const second = actorPart();
    const scoreboard = new THREE.Group();
    scoreboard.userData["cinematicDynamic"] = true;
    const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    scoreboard.add(display);
    root.add(first, second, scoreboard);

    const before = captureStaticStadiumState(root);
    texture.needsUpdate = true;
    const after = captureStaticStadiumState(root);

    expect(after.revision).toBe(before.revision);
    expect(after.sourceCount).toBe(2);
    const cleanup = batchStaticStadium(root);
    expect(root.children).toContain(scoreboard);
    expect(scoreboard.children).toEqual([display]);
    cleanup();

    first.geometry.dispose();
    second.geometry.dispose();
    display.geometry.dispose();
    (first.material as THREE.Material).dispose();
    (second.material as THREE.Material).dispose();
    (display.material as THREE.Material).dispose();
    texture.dispose();
  });

  it("does not invalidate a static batch when crowd instance attributes change", () => {
    const root = new THREE.Group();
    const first = actorPart();
    const second = actorPart();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    geometry.setAttribute(
      "crowdSkin",
      new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3),
    );
    const crowdMaterial = new THREE.MeshStandardMaterial();
    const crowd = new THREE.InstancedMesh(geometry, crowdMaterial, 1);
    root.add(first, second, crowd);

    const cleanup = batchStaticStadium(root);
    const before = captureStaticStadiumState(root).revision;
    geometry.getAttribute("crowdSkin").needsUpdate = true;
    const after = captureStaticStadiumState(root).revision;

    expect(after).toBe(before);
    expect(cleanup.isCurrent(after)).toBe(true);
    cleanup();
    first.geometry.dispose();
    second.geometry.dispose();
    geometry.dispose();
    (first.material as THREE.Material).dispose();
    (second.material as THREE.Material).dispose();
    crowdMaterial.dispose();
  });

  it("does not invalidate a static batch when sideline flash visibility changes", () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const flashes = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true }),
      6,
    );
    flashes.userData["cinematicDynamic"] = true;
    flashes.visible = false;
    root.add(first, second, flashes);

    const batch = batchStaticStadium(root);
    const before = batch.revision;
    flashes.visible = true;

    expect(batch.batches).toBe(1);
    expect(captureStaticStadiumState(root).revision).toBe(before);
    expect(batch.isCurrent(before)).toBe(true);

    batch();
    first.geometry.dispose();
    second.geometry.dispose();
    flashes.geometry.dispose();
    material.dispose();
    (flashes.material as THREE.Material).dispose();
  });

  it("keeps staticBatchDynamic subtrees visible and out of generated batches", () => {
    const root = new THREE.Group();
    const first = actorPart();
    const second = actorPart();
    const movingRoot = new THREE.Group();
    movingRoot.userData["staticBatchDynamic"] = true;
    const moving = actorPart();
    movingRoot.add(moving);
    root.add(first, second, movingRoot);

    const batch = batchStaticStadium(root);
    const before = captureStaticStadiumState(root).revision;

    expect(batch.batches).toBe(1);
    expect(root.children).toContain(movingRoot);
    expect(movingRoot.children).toEqual([moving]);
    expect(moving.visible).toBe(true);
    moving.position.x += 2;
    expect(captureStaticStadiumState(root).revision).toBe(before);

    batch();
    first.geometry.dispose();
    second.geometry.dispose();
    moving.geometry.dispose();
    (first.material as THREE.Material).dispose();
    (second.material as THREE.Material).dispose();
    (moving.material as THREE.Material).dispose();
  });
});
