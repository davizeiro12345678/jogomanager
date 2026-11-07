import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { batchStaticStadium } from "@/game/static-stadium-batch";

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
});
