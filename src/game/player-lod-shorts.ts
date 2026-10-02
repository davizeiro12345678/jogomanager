import * as THREE from "three";
import type { Pose } from "./animation-core";
import { footballShorts } from "./player-shorts";

const template = { hipW: 1, hipH: 1, chestD: 0.47, legR: 0.306, thigh: 3.4 };
const normalScale = [0.255, 0.14, 0.255] as const;

/** Three-joint cloth skinning expressed as native instanced morph targets.
 * The 18 coefficients are the two femur rotation matrices minus identity.
 * It retains one garment/draw for the team without custom renderer shaders. */
export function lowShortsGeometry() {
  const geometry = footballShorts(template, 8, { waistRows: 4, legRows: 2 });
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  geometry.morphTargetsRelative = true;
  const positions: THREE.Float32BufferAttribute[] = [];
  const normals: THREE.Float32BufferAttribute[] = [];
  for (const side of [1, -1]) {
    for (let source = 0; source < 3; source++) {
      for (let destination = 0; destination < 3; destination++) {
        const delta = new Float32Array(position.count * 3);
        const normalDelta = new Float32Array(position.count * 3);
        for (let vertex = 0; vertex < position.count; vertex++) {
          const x = position.getX(vertex),
            y = position.getY(vertex);
          const legWeight = 1 - THREE.MathUtils.smoothstep(y, -0.85, 0.1);
          const left = THREE.MathUtils.smoothstep(x, -0.12, 0.12);
          const weight = legWeight * (side === 1 ? left : 1 - left);
          const pivot = source === 0 ? side * 0.36 : source === 1 ? -0.4 : 0;
          delta[vertex * 3 + destination] =
            (position.getComponent(vertex, source) - pivot) * weight;
          // Compensate the template's typical nonuniform instance scale when
          // rotating normals. It is a bounded approximation for the far LOD.
          normalDelta[vertex * 3 + destination] =
            normal.getComponent(vertex, source) *
            weight *
            (normalScale[destination]! / normalScale[source]!) ** 2;
        }
        positions.push(new THREE.Float32BufferAttribute(delta, 3));
        normals.push(new THREE.Float32BufferAttribute(normalDelta, 3));
      }
    }
  }
  geometry.morphAttributes.position = positions;
  geometry.morphAttributes.normal = normals;
  return geometry;
}

/** Fixed buffers; only 18 weights per visible player are uploaded per frame. */
export class LowShortsAnimator {
  private readonly proxy: THREE.Mesh;
  private readonly rotation = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly scale = new THREE.Vector3();

  constructor(geometry: THREE.BufferGeometry) {
    this.proxy = new THREE.Mesh(geometry);
  }

  update(
    mesh: THREE.InstancedMesh,
    index: number,
    pose: Pick<Pose, "legLPitch" | "legLRoll" | "legRPitch" | "legRRoll">,
    sx: number,
    sy: number,
    sz: number,
  ) {
    this.scale.set(sx, sy, sz);
    const weights = this.proxy.morphTargetInfluences!;
    for (let leg = 0; leg < 2; leg++) {
      this.quaternion.setFromEuler(
        this.euler.set(
          leg === 0 ? pose.legLPitch : pose.legRPitch,
          0,
          leg === 0 ? pose.legLRoll : pose.legRRoll,
          "XYZ",
        ),
      );
      this.rotation.makeRotationFromQuaternion(this.quaternion);
      for (let source = 0; source < 3; source++)
        for (let destination = 0; destination < 3; destination++)
          weights[leg * 9 + source * 3 + destination] =
            (this.rotation.elements[source * 4 + destination]! * this.scale.getComponent(source)) /
              this.scale.getComponent(destination) -
            (source === destination ? 1 : 0);
    }
    if (!mesh.morphTexture) {
      // LowPlayers compacts mesh.count each frame. Allocate for its capacity,
      // rather than for the first visible player, before writing the texture.
      const count = mesh.count;
      mesh.count = mesh.instanceMatrix.count;
      mesh.setMorphAt(index, this.proxy);
      mesh.count = count;
    } else mesh.setMorphAt(index, this.proxy);
    mesh.morphTexture!.needsUpdate = true;
  }

  dispose() {
    (this.proxy.material as THREE.Material).dispose();
  }
}
