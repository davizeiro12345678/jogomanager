import * as THREE from "three";

/** A continuous shirt follows the chest hinge even in the instanced match LOD.
 * Twelve relative morph coefficients encode an affine transform. Its lower
 * hem remains on the lumbar bone; no second torso mesh or bone texture is used. */
export function articulateLowTorso(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const positions: THREE.Float32BufferAttribute[] = [];
  const normals: THREE.Float32BufferAttribute[] = [];
  const typicalScale = [0.5, 0.55, 0.3];
  geometry.morphTargetsRelative = true;
  for (let source = 0; source < 4; source++)
    for (let destination = 0; destination < 3; destination++) {
      const delta = new Float32Array(position.count * 3);
      const normalDelta = new Float32Array(position.count * 3);
      for (let vertex = 0; vertex < position.count; vertex++) {
        const weight = THREE.MathUtils.smoothstep(position.getY(vertex), -0.12, 0.32);
        delta[vertex * 3 + destination] =
          weight * (source < 3 ? position.getComponent(vertex, source) : 1);
        if (source < 3)
          normalDelta[vertex * 3 + destination] =
            normal.getComponent(vertex, source) *
            weight *
            (typicalScale[destination]! / typicalScale[source]!) ** 2;
      }
      positions.push(new THREE.Float32BufferAttribute(delta, 3));
      normals.push(new THREE.Float32BufferAttribute(normalDelta, 3));
    }
  geometry.morphAttributes.position = positions;
  geometry.morphAttributes.normal = normals;
  return geometry;
}

export class LowTorsoAnimator {
  private readonly proxy: THREE.Mesh;
  private readonly rotation = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly scale = new THREE.Vector3();
  private readonly hinge = new THREE.Vector3();
  private readonly rotatedHinge = new THREE.Vector3();

  constructor(geometry: THREE.BufferGeometry) {
    this.proxy = new THREE.Mesh(geometry);
  }

  update(
    mesh: THREE.InstancedMesh,
    index: number,
    pitch: number,
    yaw: number,
    hingeY: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    this.scale.set(sx, sy, sz);
    this.quaternion.setFromEuler(this.euler.set(pitch, yaw, 0, "XYZ"));
    this.rotation.makeRotationFromQuaternion(this.quaternion);
    this.hinge.set(0, hingeY, 0);
    this.rotatedHinge.copy(this.hinge).applyMatrix4(this.rotation);
    const weights = this.proxy.morphTargetInfluences!;
    for (let source = 0; source < 3; source++)
      for (let destination = 0; destination < 3; destination++)
        weights[source * 3 + destination] =
          (this.rotation.elements[source * 4 + destination]! * this.scale.getComponent(source)) /
            this.scale.getComponent(destination) -
          (source === destination ? 1 : 0);
    for (let destination = 0; destination < 3; destination++)
      weights[9 + destination] =
        (this.hinge.getComponent(destination) - this.rotatedHinge.getComponent(destination)) /
        this.scale.getComponent(destination);
    if (!mesh.morphTexture) {
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
