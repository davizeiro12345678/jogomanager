import * as THREE from "three";

export type SidelineFlash = Readonly<{ x: number; z: number; heat: number }>;

/** Flash timers remain independent of rendering. Idle photographers require
 * neither matrix composition nor GPU uploads until their light changes. */
export class SidelineFlashBatch {
  private readonly previousHeat: Float64Array;
  private readonly transform = new THREE.Object3D();
  private readonly dirtySlots: number[] = [];
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
    this.dirtySlots.length = 0;
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
      this.dirtySlots.push(index);
    }
    mesh.visible = visible;
    // Upload only the matrices whose flashes actually changed (16 floats
    // each), instead of copying the full instance buffer for a single pulse.
    // The renderer consumes/clears these ranges after each GPU upload.
    if (this.dirtySlots.length) {
      mesh.instanceMatrix.clearUpdateRanges();
      for (const slot of this.dirtySlots) mesh.instanceMatrix.addUpdateRange(slot * 16, 16);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
