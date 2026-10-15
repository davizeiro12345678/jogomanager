import * as THREE from "three";

export type SidelineFlash = Readonly<{ x: number; z: number; heat: number }>;

/** Flash timers remain independent of rendering. Idle photographers require
 * neither matrix composition nor GPU uploads until their light changes. */
export class SidelineFlashBatch {
  private readonly previousHeat: Float64Array;
  private readonly transform = new THREE.Object3D();
  private mesh: THREE.InstancedMesh | null = null;

  constructor(capacity: number) {
    this.previousHeat = new Float64Array(capacity).fill(Number.NaN);
  }

  paint(mesh: THREE.InstancedMesh, flashes: readonly SidelineFlash[]): void {
    if (mesh !== this.mesh) {
      this.mesh = mesh;
      this.previousHeat.fill(Number.NaN);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    let changed = false;
    let visible = false;
    for (let index = 0; index < flashes.length; index++) {
      const flash = flashes[index]!;
      visible ||= flash.heat > 0;
      if (this.previousHeat[index] === flash.heat) continue;
      this.previousHeat[index] = flash.heat;
      this.transform.position.set(flash.x, 1, flash.z);
      this.transform.scale.setScalar(Math.max(0.0001, flash.heat * 1.6));
      this.transform.updateMatrix();
      mesh.setMatrixAt(index, this.transform.matrix);
      changed = true;
    }
    mesh.visible = visible;
    // Six small matrices remain a single bounded upload. Keep the full buffer
    // so a flash that expired while invisible is zeroed on the next visible draw.
    if (changed) mesh.instanceMatrix.needsUpdate = true;
  }
}
