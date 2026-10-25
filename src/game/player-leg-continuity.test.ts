import { expect, it } from "vitest";
import * as THREE from "three";
import { buildRigSkin } from "./rig-skin";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { kitFor } from "./kits";
import { createLowPlayerGeometries } from "./player-lod-geometry";

it("keeps the same hidden thigh coverage in both instanced mobile LODs", () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const compact of [false, true]) {
    const geometries = createLowPlayerGeometries(compact);
    const thigh = new THREE.Mesh(geometries["thighs"]!, material);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(0, -0.02, 0.65),
      new THREE.Vector3(0, 1, -0.1).normalize(),
      0,
      0.55,
    );
    expect(ray.intersectObject(thigh).length, `compact=${compact}`).toBeGreaterThan(0);
    Object.values(geometries).forEach((g) => g.dispose());
  }
  material.dispose();
});

it("retains a real thigh surface when looking upward through either shorts opening", () => {
  const look = lookFor("studio-fla-MF-1", "MF", true);
  const P = proportionsFor(look);
  const mats = playerMaterials(look, kitFor("fla", "#cc1e32", "#161b21"), null, "alta");
  const skin = buildRigSkin(
    {
      P,
      look,
      mats,
      hi: true,
      portrait: true,
      segs: { radial: 16, cap: 4 },
      handR: P.handR,
      handMat: mats.skin,
      jerseyInk: "#fff",
    },
    [0, 0, 0],
  );
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const surfaces = skin.groups
    .filter((g) => g.material === mats.skin || g.material === mats.shorts)
    .map((g) => new THREE.Mesh(g.geometry, material));
  skin.root.updateMatrixWorld(true);
  for (const side of ["L", "R"] as const) {
    const origin = new THREE.Vector3(0, -P.thigh * 0.52, P.legR * 1.3).applyMatrix4(
      skin.boneOf[`leg${side}`].matrixWorld,
    );
    const direction = new THREE.Vector3(0, 1, -0.1).normalize();
    const hits = new THREE.Raycaster(origin, direction, 0, P.thigh * 0.55).intersectObjects(
      surfaces,
      false,
    );
    expect(hits.length, `empty thigh behind ${side} cuff`).toBeGreaterThan(0);
  }
  skin.dispose();
  material.dispose();
});
