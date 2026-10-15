import { buildTurfDetail } from "./turf-detail";
import { loadGameWasm, WASM_CAPABILITY } from "./wasm/runtime";

self.onmessage = async ({ data }: MessageEvent<{ size: number; seed: number }>) => {
  let bytes: Uint8Array;
  let backend = "typescript";
  try {
    const wasm = await loadGameWasm(WASM_CAPABILITY.turf, 5000);
    if (!wasm) throw new Error("Turf WASM unavailable");
    bytes = wasm.build_turf_detail(data.size, data.seed);
    backend = "rust-wasm";
  } catch {
    bytes = buildTurfDetail(data.size, data.seed);
  }
  self.postMessage({ bytes, backend, size: data.size }, [bytes.buffer]);
};
