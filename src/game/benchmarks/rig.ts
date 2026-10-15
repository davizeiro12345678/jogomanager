import type { Bench } from "tinybench";
import { generateRigSectionFallback } from "../rig-section-kernel";

// Reproducible model-section workload, measured exclusively by CodSpeed.
const rings = new Float64Array(
  Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 4);
    switch (index % 4) {
      case 0:
        return row * 0.05;
      case 1:
        return 0.35 + row * 0.002;
      case 2:
        return 0.24 + row * 0.001;
      default:
        return 0;
    }
  }),
);

export function registerRigBenchmarks(bench: Bench) {
  bench
    .add("rig geometry: fallback 64 radial", () => {
      generateRigSectionFallback({ rings, radial: 64, roundness: 1.2, caps: 3 });
    })
    .add("rig geometry: fallback 16 radial", () => {
      generateRigSectionFallback({ rings, radial: 16, roundness: 1.2, caps: 3 });
    });
}
