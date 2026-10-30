import type { Bench } from "tinybench";
import * as THREE from "three";
import { packHalfFloatTexture } from "../graphics/gpu-half-float";
import { stadiumEnvironmentResolution } from "../graphics/pmrem-budget";
import { createPylonBeamBatch } from "../stadium-pylon-beams";

export function registerGraphicsBenchmarks(bench: Bench): void {
  const hdr = Float32Array.from({ length: 32768 }, (_, i) => Math.sin(i * 0.18) * (1 + (i % 300)));
  bench
    .add("graphics HDR: fp16 batch 32k", () => {
      return packHalfFloatTexture(hdr, 4);
    })
    .add("graphics HDR: Three scalar fp16 32k", () => {
      const data = new Uint16Array(hdr.length);
      for (let i = 0; i < hdr.length; i++) data[i] = THREE.DataUtils.toHalfFloat(hdr[i]!);
      return data;
    })
    .add("graphics stadium: four standalone beams", () => {
      const geometry = new THREE.ConeGeometry(4.5, 14, 12, 1, true);
      const material = new THREE.MeshBasicMaterial();
      const objects = Array.from({ length: 4 }, () => new THREE.Mesh(geometry, material));
      for (const mesh of objects) mesh.updateMatrix();
      geometry.dispose();
      material.dispose();
    })
    .add("graphics stadium: shared BatchedMesh beams", () => {
      const batch = createPylonBeamBatch();
      batch.geometry.dispose();
      (batch.material as THREE.Material).dispose();
      batch.dispose();
    })
    .add("graphics PMREM: select 10k IBL budgets", () => {
      let sum = 0;
      for (let i = 0; i < 10000; i++)
        sum += stadiumEnvironmentResolution(i % 2 ? "alta" : "media", (i % 100) / 100);
      return sum;
    });
}
