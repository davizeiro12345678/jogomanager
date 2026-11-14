import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { captureStaticStadiumState } from "./static-stadium-batch";

describe("static capture shared-resource work", () => {
  it("reads shared material state once per capture while observing next-frame mutations", () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    let reads = 0;
    let roughness = 0.7;
    Object.defineProperty(material, "roughness", {
      get() {
        reads += 1;
        return roughness;
      },
      set(value: number) {
        roughness = value;
      },
    });
    for (let index = 0; index < 12; index++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = index * 2;
      root.add(mesh);
    }
    const before = captureStaticStadiumState(root);
    expect(before.sourceCount).toBe(12);
    expect(before.eligibleCount).toBe(12);
    expect(reads).toBe(1);
    expect(captureStaticStadiumState(root).revision).toBe(before.revision);
    expect(reads).toBe(2);
    material.roughness = 0.3;
    expect(captureStaticStadiumState(root).revision).not.toBe(before.revision);
    expect(reads).toBe(3);
    geometry.dispose();
    material.dispose();
  });

  it("does not cache texture, geometry or transform revisions across frames", () => {
    const root = new THREE.Group();
    const texture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const first = new THREE.Mesh(geometry, material);
    const second = new THREE.Mesh(geometry, material);
    root.add(first, second);
    let revision = captureStaticStadiumState(root).revision;
    const changed = () => {
      const next = captureStaticStadiumState(root).revision;
      expect(next).not.toBe(revision);
      revision = next;
      expect(captureStaticStadiumState(root).revision).toBe(revision);
    };
    texture.offset.x = 0.4;
    changed();
    material.color.set("#00ff00");
    changed();
    geometry.getAttribute("position").needsUpdate = true;
    changed();
    second.position.z = 1;
    changed();
    second.visible = false;
    changed();
    texture.dispose();
    geometry.dispose();
    material.dispose();
  });
});
