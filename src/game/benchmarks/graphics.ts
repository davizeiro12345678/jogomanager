import type { Bench } from "tinybench";
import * as THREE from "three";
import { packHalfFloatTexture } from "../graphics/gpu-half-float";
import { stadiumEnvironmentResolution } from "../graphics/pmrem-budget";
import { createPylonBeamBatch } from "../stadium-pylon-beams";
import { animationPoseInterval } from "../graphics/adaptive-animation-rate";
import { buildConservativeDepthPyramid } from "../graphics/depth-pyramid";
import { quantizeGeometryPositions } from "../graphics/geometry-quantization";

export function registerGraphicsBenchmarks(bench: Bench): void {
  const hdr = Float32Array.from({ length: 32768 }, (_, i) => Math.sin(i * 0.18) * (1 + (i % 300)));
  const occlusionDepth = new Float32Array(64 * 64).fill(0.9);
  const clusterGeometry = new THREE.SphereGeometry(4, 24, 16);
  bench
    .add("graphics geometry: quantize static sphere", () => {
      quantizeGeometryPositions(clusterGeometry);
    })
    .add("graphics HiZ: conservative depth pyramid 64x64", () => {
      buildConservativeDepthPyramid(occlusionDepth, 64, 64);
    })
    .add("graphics animation: 1k adaptive pose decisions", () => {
      let total = 0;
      for (let index = 0; index < 1_000; index++)
        total += animationPoseInterval((index % 3) as 0 | 1 | 2, "media");
      return total;
    })
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
