import { expect, it } from "vitest";
import * as THREE from "three";
import { buildRigSkin } from "./rig-skin";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { kitFor } from "./kits";
import { getClip, type ClipName, type PlayerAction } from "./animation";
import { refineFootballAction } from "./football-action";
import { updateRigCorrectives } from "./rig-correctives";
import { AthleteCloth } from "./athlete-cloth";

// Bake the actual GPU inputs through Three's native skinning+morph evaluator.
// Keep only the requested triangles; positions and skinning are not approximated.
function surface(source: THREE.SkinnedMesh, keep: (a: number, b: number, c: number) => boolean) {
  const index = source.geometry.index!,
    vertices: number[] = [],
    triangles: number[] = [],
    remap = new Map<number, number>();
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (!keep(tri[0]!, tri[1]!, tri[2]!)) continue;
    for (const original of tri) {
      if (!remap.has(original)) {
        remap.set(original, vertices.length);
        vertices.push(original);
      }
      triangles.push(remap.get(original)!);
    }
  }
  const geometry = new THREE.BufferGeometry(),
    positions = new Float32Array(vertices.length * 3),
    point = new THREE.Vector3();
  vertices.forEach((original, slot) => {
    source.getVertexPosition(original, point);
    positions.set(point.toArray(), slot * 3);
  });
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(triangles);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    mesh = new THREE.Mesh(geometry, material);
  return {
    mesh,
    vertices,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
function boundMesh(
  group: { geometry: THREE.BufferGeometry; material: THREE.Material },
  skin: ReturnType<typeof buildRigSkin>,
) {
  const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
  mesh.skeleton = skin.skeleton;
  mesh.bindMatrix.copy(skin.bindMatrix);
  mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
  return mesh;
}

it.each(Array.from({ length: 12 }, (_, i) => i))(
  "keeps posed skin behind its own moving shorts for identity %i",
  (identity) => {
    const role = ["MF", "DF", "FW", "GK"][identity % 4]!,
      look = lookWithPhysique(lookFor(`garment-seam-${identity}`, role, true), {
        height: [155, 183, 210][identity % 3],
        weight: [48, 76, 120][identity % 3],
      }),
      p = proportionsFor(look);
    for (const radial of [8, 24])
      for (const clothEnabled of [false, true]) {
        const mats = playerMaterials(look, kitFor("fla", "#cc1e32", "#161b21"), null, "alta");
        const skin = buildRigSkin(
          {
            P: p,
            look,
            mats,
            hi: radial === 24,
            portrait: radial === 24,
            segs: { radial, cap: 6 },
            handR: p.handR,
            handMat: mats.skin,
            jerseyInk: "#fff",
          },
          [0, 0, 0],
        );
        // Production creates the morph targets before constructing its meshes.
        const cloth = new AthleteCloth(skin, p, clothEnabled);
        const clothing = skin.groups
          .filter((g) => g.material === mats.shorts && g.lod === "core")
          .map((g) => boundMesh(g, skin));
        clothing.forEach((mesh) => cloth.bind(mesh));
        const skins = skin.groups
          .filter((g) => g.material === mats.skin && g.lod === "core")
          .map((g) => boundMesh(g, skin));
        skin.root.updateMatrixWorld(true);
        skin.skeleton.update();
        const rest = {
          L: skin.boneOf.legL.matrixWorld.clone().invert(),
          R: skin.boneOf.legR.matrixWorld.clone().invert(),
        };
        let coverage = 0,
          activeMorph = false;
        try {
          for (const clip of ["run", "pass", "slide", "crossed"]) {
            for (const phase of [0.2, 0.5, 0.85]) {
              const pose = getClip((clip === "crossed" ? "idle" : clip) as ClipName)({
                t: phase * 1.4,
                u: phase,
                speed: 4,
                stride: phase * Math.PI * 2,
                seed: look.seed,
              });
              if (clip === "pass" || clip === "slide")
                refineFootballAction(pose, clip as PlayerAction, phase, p, "right");
              if (clip === "crossed")
                Object.assign(pose, {
                  legLPitch: -0.8,
                  legRPitch: 0.15,
                  legLRoll: -0.35,
                  legRRoll: 0.35,
                  kneeL: -0.4,
                  kneeR: -0.7,
                  hipYaw: 0.1,
                });
              skin.boneOf.hips.position.y = p.hipY + pose.hipY;
              skin.boneOf.hips.rotation.set(pose.hipPitch, pose.hipYaw, pose.hipRoll);
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
              if (clothEnabled) {
                for (let frame = 0; frame < 30; frame++)
                  cloth.update(1 / 60, {
                    x: phase,
                    z: phase * 0.3,
                    lift: pose.hipY,
                    effort: 0.6,
                    bend: pose.hipPitch,
                    legL: Math.abs(pose.legLPitch),
                    legR: Math.abs(pose.legRPitch),
                  });
                activeMorph ||= clothing.some((mesh) =>
                  mesh.morphTargetInfluences?.some((value) => Math.abs(value) > 0.001),
                );
              }
              for (const side of ["L", "R"] as const) {
                const bone = skin.boneOf[`leg${side}`],
                  owner = skin.bones.indexOf(bone),
                  opposite = skin.bones.indexOf(skin.boneOf[side === "L" ? "legR" : "legL"]);
                const clothSurfaces = clothing.map((mesh) => {
                  const indices = mesh.geometry.getAttribute("skinIndex"),
                    weights = mesh.geometry.getAttribute("skinWeight");
                  const legShare = (i: number, target: number) =>
                    [0, 1, 2, 3].reduce(
                      (n, c) =>
                        n +
                        (indices.getComponent(i, c) === target ? weights.getComponent(i, c) : 0),
                      0,
                    );
                  return surface(
                    mesh,
                    (a, b, c) =>
                      [a, b, c].reduce(
                        (n, i) => n + legShare(i, owner) - legShare(i, opposite),
                        0,
                      ) > 0,
                  );
                });
                try {
                  let poseCoverage = 0;
                  for (const source of skins) {
                    const joints = source.geometry.getAttribute("skinIndex"),
                      position = source.geometry.getAttribute("position");
                    const thigh = surface(source, (a, b, c) =>
                      [a, b, c].every((i) => joints.getX(i) === owner),
                    );
                    try {
                      const origin = new THREE.Vector3(
                          0,
                          -p.thigh * 0.52,
                          p.legR * 1.3,
                        ).applyMatrix4(bone.matrixWorld),
                        direction = new THREE.Vector3(0, 1, -0.1).transformDirection(
                          bone.matrixWorld,
                        );
                      const ray = new THREE.Raycaster(origin, direction, 0, p.thigh * 1.2);
                      expect(
                        ray.intersectObject(thigh.mesh).length,
                        `${identity}/${radial}/${clothEnabled}/${clip}/${phase}/${side}: bare cuff`,
                      ).toBeGreaterThan(0);
                      expect(
                        ray.intersectObjects([thigh.mesh, ...clothSurfaces.map((s) => s.mesh)])
                          .length,
                        `${identity}/${clip}/${side}: clothed cuff`,
                      ).toBeGreaterThan(0);
                      const samples = thigh.vertices.filter((i) => {
                        const local = new THREE.Vector3()
                            .fromBufferAttribute(position, i)
                            .applyMatrix4(rest[side]),
                          u = -local.y / p.thigh;
                        return (
                          u >= 0.38 &&
                          u <= 0.5 &&
                          local.z > 0.001 &&
                          local.x * (side === "L" ? 1 : -1) > -p.legR * 0.65
                        );
                      });
                      const step = Math.max(1, Math.ceil(samples.length / 32));
                      for (let sample = 0; sample < samples.length; sample += step) {
                        const i = samples[sample]!,
                          local = new THREE.Vector3()
                            .fromBufferAttribute(position, i)
                            .applyMatrix4(rest[side]);
                        const axis = new THREE.Vector3(0, local.y, 0).applyMatrix4(
                            bone.matrixWorld,
                          ),
                          point = source.getVertexPosition(i, new THREE.Vector3()),
                          distance = point.distanceTo(axis);
                        ray.set(axis, point.clone().sub(axis).normalize());
                        ray.far = Infinity;
                        const hit = ray.intersectObjects(clothSurfaces.map((s) => s.mesh))[0];
                        if (hit) {
                          coverage++;
                          poseCoverage++;
                          expect(
                            hit.distance - distance,
                            `${identity}/${radial}/${clothEnabled}/${clip}/${phase}/${side}: skin through garment`,
                          ).toBeGreaterThanOrEqual(-0.0005);
                        }
                      }
                    } finally {
                      thigh.dispose();
                    }
                  }
                  expect(
                    poseCoverage,
                    `${identity}/${radial}/${clothEnabled}/${clip}/${phase}/${side}: coupled pose`,
                  ).toBeGreaterThan(0);
                } finally {
                  clothSurfaces.forEach((s) => s.dispose());
                }
              }
            }
          }
          expect(coverage, `${identity}/${radial}: coupled garment samples`).toBeGreaterThan(0);
          if (clothEnabled)
            expect(activeMorph, "real cloth morph coefficients must be exercised").toBe(true);
        } finally {
          skin.dispose();
        }
      }
  },
);
