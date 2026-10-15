import { readFileSync } from "node:fs";
import type { Bench } from "tinybench";
import { generateRigSectionFallback } from "../rig-section-kernel";
import {
  generate_rig_section,
  initSync,
  wasm_abi_version,
  wasm_capabilities,
} from "../wasm/pkg/crowd_visibility_wasm";
import { WASM_ABI_VERSION, WASM_CAPABILITY } from "../wasm/runtime";

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
  initSync({
    module: readFileSync(new URL("../wasm/pkg/crowd_visibility_wasm_bg.wasm", import.meta.url)),
  });
  if (
    wasm_abi_version() !== WASM_ABI_VERSION ||
    (wasm_capabilities() & WASM_CAPABILITY.rigSection) !== WASM_CAPABILITY.rigSection
  )
    throw new Error("Rust rig-section WASM benchmark is unavailable or incompatible");

  bench
    .add("rig geometry: fallback 64 radial", () => {
      generateRigSectionFallback({ rings, radial: 64, roundness: 1.2, caps: 3 });
    })
    .add("rig geometry: fallback 16 radial", () => {
      generateRigSectionFallback({ rings, radial: 16, roundness: 1.2, caps: 3 });
    })
    .add("rig geometry: Rust/WASM 64 radial", () => {
      generate_rig_section(rings, 64, 1.2, 3);
    })
    .add("rig geometry: Rust/WASM 16 radial", () => {
      generate_rig_section(rings, 16, 1.2, 3);
    });
}
