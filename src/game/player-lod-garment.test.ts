import { expect, it } from "vitest";
import * as THREE from "three";
import { createLowPlayerGeometries } from "./player-lod-geometry";
import { LowShortsAnimator } from "./player-lod-shorts";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";
import { getClip, type ClipName, type PlayerAction } from "./animation";
import { refineFootballAction } from "./football-action";
import { placeScaledInstancePart } from "./instance-transform";

// Evaluate the actual native instanced morph texture and instance matrices.
// This tests the low-LOD geometry/upload contract, not React or GPU playback.
function posedSurface(mesh: THREE.InstancedMesh, instance: number) {
  const proxy = new THREE.Mesh(mesh.geometry),
    matrix = new THREE.Matrix4();
  if (mesh.morphTexture) mesh.getMorphAt(instance, proxy);
  mesh.getMatrixAt(instance, matrix);
  const position = mesh.geometry.getAttribute("position"),
    points = new Float32Array(position.count * 3);
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex++) {
    proxy.getVertexPosition(vertex, point).applyMatrix4(matrix);
    points.set(point.toArray(), vertex * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  geometry.setIndex(mesh.geometry.index!.clone());
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  (proxy.material as THREE.Material).dispose();
  return {
    mesh: new THREE.Mesh(geometry, material),
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

it.each([false, true])(
  "keeps real instanced thigh skin through both moving cuffs (compact=%s)",
  (compact) => {
    const geometries = createLowPlayerGeometries(compact),
      material = new THREE.MeshBasicMaterial();
    const shorts = new THREE.InstancedMesh(geometries["hips"]!, material, 12),
      thighs = new THREE.InstancedMesh(geometries["thighs"]!, material, 24);
    const animator = new LowShortsAnimator(shorts.geometry),
      matrix = new THREE.Matrix4();
    try {
      for (let identity = 0; identity < 12; identity++) {
        const look = lookWithPhysique(
            lookFor(`low-garment-${identity}`, ["MF", "DF", "FW", "GK"][identity % 4]!, true),
            {
              height: [155, 183, 210][identity % 3],
              weight: [48, 76, 120][identity % 3],
            },
          ),
          p = proportionsFor(look);
        for (const clip of ["run", "pass", "slide", "crossed"])
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
                hipYaw: 0.1,
              });
            const hips = new THREE.Matrix4().compose(
              new THREE.Vector3(0, p.hipY + pose.hipY, 0),
              new THREE.Quaternion().setFromEuler(
                new THREE.Euler(pose.hipPitch, pose.hipYaw, pose.hipRoll),
              ),
              new THREE.Vector3(1, 1, 1),
            );
            placeScaledInstancePart(matrix, hips, 0, 0, 0, p.hipW, p.hipH, p.chestD / 0.47);
            shorts.setMatrixAt(identity, matrix);
            animator.update(shorts, identity, pose, p.hipW, p.hipH, p.chestD / 0.47);
            const cloth = posedSurface(shorts, identity);
            try {
              for (const [slot, side] of (["L", "R"] as const).entries()) {
                const femur = hips
                  .clone()
                  .multiply(
                    new THREE.Matrix4().compose(
                      new THREE.Vector3((slot === 0 ? 1 : -1) * p.hipW * 0.36, -p.hipH * 0.4, 0),
                      new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(pose[`leg${side}Pitch`], 0, pose[`leg${side}Roll`]),
                      ),
                      new THREE.Vector3(1, 1, 1),
                    ),
                  );
                placeScaledInstancePart(
                  matrix,
                  femur,
                  0,
                  -p.thigh * 0.5,
                  0,
                  p.legR * 2,
                  p.thigh,
                  p.legR * 2,
                );
                thighs.setMatrixAt(identity * 2 + slot, matrix);
                const skin = posedSurface(thighs, identity * 2 + slot);
                try {
                  const origin = new THREE.Vector3(0, -p.thigh * 0.52, p.legR * 1.3).applyMatrix4(
                      femur,
                    ),
                    direction = new THREE.Vector3(0, 1, -0.1).transformDirection(femur);
                  const ray = new THREE.Raycaster(origin, direction, 0, p.thigh * 1.2),
                    context = `${identity}/${clip}/${phase}/${side}`;
                  expect(
                    ray.intersectObject(skin.mesh).length,
                    `${context}: bare cuff`,
                  ).toBeGreaterThan(0);
                  // Both surfaces are posed independently before this combined ray.
                  expect(
                    ray.intersectObjects([skin.mesh, cloth.mesh]).length,
                    `${context}: dressed cuff`,
                  ).toBeGreaterThan(0);
                  const bind = shorts.geometry.getAttribute("position"),
                    owners = shorts.geometry.getAttribute("openingLeg"),
                    inverse = femur.clone().invert();
                  const hemY = Math.min(
                    ...Array.from({ length: bind.count }, (_, i) => bind.getY(i)),
                  );
                  let coupled = 0;
                  for (let vertex = 0; vertex < bind.count; vertex++) {
                    if (
                      owners.getX(vertex) !== (slot === 0 ? 1 : -1) ||
                      Math.abs(bind.getY(vertex) - hemY) > 1e-6
                    )
                      continue;
                    const hem = new THREE.Vector3().fromBufferAttribute(
                        cloth.mesh.geometry.getAttribute("position"),
                        vertex,
                      ),
                      local = hem.clone().applyMatrix4(inverse);
                    // Sample the front/outer opening, where its own thigh is the visible backing.
                    if (local.z < 0.01 || local.x * (slot === 0 ? 1 : -1) < -p.legR * 0.65)
                      continue;
                    const axis = new THREE.Vector3(0, local.y, 0).applyMatrix4(femur),
                      distance = hem.distanceTo(axis);
                    ray.set(axis, hem.clone().sub(axis).normalize());
                    ray.far = Infinity;
                    const hit = ray.intersectObject(skin.mesh)[0];
                    expect(hit, `${context}: skin backing at moving hem`).toBeDefined();
                    expect(
                      distance - hit!.distance,
                      `${context}: skin outside cuff`,
                    ).toBeGreaterThanOrEqual(-0.0005);
                    coupled++;
                  }
                  expect(coupled, `${context}: coupled native instance samples`).toBeGreaterThan(0);
                } finally {
                  skin.dispose();
                }
              }
            } finally {
              cloth.dispose();
            }
          }
      }
    } finally {
      animator.dispose();
      shorts.dispose();
      thighs.dispose();
      material.dispose();
      Object.values(geometries).forEach((g) => g.dispose());
    }
  },
);
