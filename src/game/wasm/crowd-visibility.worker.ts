import { CrowdWorkerRuntime, type CrowdWorkerRequest } from "./crowd-worker-runtime";
import { loadGameWasm, WASM_CAPABILITY } from "./runtime";

const runtime = new CrowdWorkerRuntime(
  async (layout) => {
    const module = await loadGameWasm(
      WASM_CAPABILITY.crowd | WASM_CAPABILITY.persistentCrowd | WASM_CAPABILITY.boundedCrowd,
    );
    if (!module) return null;
    return new module.CrowdSelector(
      layout.positions,
      layout.tiles,
      layout.tileOffsets,
      layout.tileIndices,
    );
  },
  (message, transfer = []) => self.postMessage(message, transfer),
);

self.onmessage = ({ data }: MessageEvent<CrowdWorkerRequest>) => runtime.handle(data);
