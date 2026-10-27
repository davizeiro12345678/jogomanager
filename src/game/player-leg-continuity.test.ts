import { expect, it } from "vitest";
import * as THREE from "three";
import { buildRigSkin } from "./rig-skin";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { kitFor } from "./kits";
import { createLowPlayerGeometries } from "./player-lod-geometry";
import { getClip, type ClipName, type PlayerAction } from "./animation";
import { refineFootballAction } from "./football-action";
import { updateRigCorrectives } from "./rig-correctives";

it.each(Array.from({ length: 12 }, (_, index) => index))(
  "keeps both upper thighs complete across posed real triangles for identity %i",
  (index) => {
    const role = ["MF", "DF", "FW", "GK"][index % 4]!;
    const look = lookWithPhysique(lookFor(`continuity-${index}`, role, true), {
      height: [155, 183, 210][index % 3],
      weight: [48, 76, 120][index % 3],
    });
    const P = proportionsFor(look);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const radial of [8, 24]) {
      const mats = playerMaterials(look, kitFor("fla", "#cc1e32", "#161b21"), null, "alta");
      const skin = buildRigSkin(
        {
          P,
          look,
          mats,
          hi: radial === 24,
          portrait: radial === 24,
          segs: { radial, cap: 6 },
          handR: P.handR,
          handMat: mats.skin,
          jerseyInk: "#fff",
        },
        [0, 0, 0],
      );
      const surfaces = skin.groups
        .filter((g) => g.material === mats.skin && g.lod === "core")
        .map((g) => {
          const mesh = new THREE.SkinnedMesh(g.geometry, material);
          mesh.skeleton = skin.skeleton;
          mesh.bindMatrix.copy(skin.bindMatrix);
          mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
          return mesh;
        });
      for (const clip of [
        "walk",
        "run",
        "sprint",
        "decelerate",
        "curveRunLeft",
        "idle",
        "pass",
        "shotPower",
        "trap",
        "header",
        "diveLeft",
        "slide",
      ] as ClipName[]) {
        for (const phase of [0.2, 0.5, 0.85]) {
          const pose = getClip(clip)({
            t: phase * 1.5,
            u: phase,
            speed: 4,
            stride: phase * Math.PI * 2,
            seed: look.seed,
          });
          if (["pass", "shotPower", "trap", "header", "diveLeft", "slide"].includes(clip))
            refineFootballAction(pose, clip as PlayerAction, phase, P, "right");
          for (const side of ["L", "R"] as const) {
            skin.boneOf[`leg${side}`].rotation.set(
              pose[`leg${side}Pitch`],
              0,
              pose[`leg${side}Roll`],
            );
            skin.boneOf[`knee${side}`].rotation.x = -pose[`knee${side}`];
          }
          updateRigCorrectives(skin.boneOf);
          skin.root.updateMatrixWorld(true);
          skin.skeleton.update();
          for (const mesh of surfaces) mesh.computeBoundingSphere();
          for (const side of ["L", "R"] as const) {
            const bone = skin.boneOf[`leg${side}`],
              boneIndex = skin.bones.indexOf(bone);
            const origin = new THREE.Vector3(0, -P.thigh * 0.25, P.legR * 3).applyMatrix4(
              bone.matrixWorld,
            );
            const direction = new THREE.Vector3(0, 0, -1).transformDirection(bone.matrixWorld);
            const hits = new THREE.Raycaster(origin, direction, 0, P.legR * 6).intersectObjects(
              surfaces,
              false,
            );
            const ownThigh = hits.some(
              (hit) =>
                hit.face &&
                [hit.face.a, hit.face.b, hit.face.c].every(
                  (vertex) =>
                    (hit.object as THREE.Mesh).geometry.getAttribute("skinIndex").getX(vertex) ===
                    boneIndex,
                ),
            );
            expect(ownThigh, `${index}/${radial}/${clip}/${phase}/${side}`).toBe(true);
          }
        }
      }
      if (radial === 24)
        expect(
          skin.groups.reduce((sum, g) => sum + (g.geometry.index?.count ?? 0) / 3, 0),
        ).toBeLessThanOrEqual(90000);
      skin.dispose();
    }
    material.dispose();
  },
);

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
