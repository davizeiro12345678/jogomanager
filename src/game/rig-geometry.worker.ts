/// <reference lib="webworker" />
import {
  generateRigSectionFallback,
  rigSectionVertexCount,
  validRigSection,
  type RigSectionInput,
} from "./rig-section-kernel";
import { loadGameWasm, WASM_CAPABILITY, type GameWasmModule } from "./wasm/runtime";
export interface SectionJob {
  part: string;
  input: RigSectionInput;
}
export interface GeometryBatch {
  id: number;
  identity: string;
  style: string;
  lod: number;
  sections: SectionJob[];
}
const MAX_BYTES = 8 * 1024 * 1024;
export function sectionCacheKey(
  batch: Pick<GeometryBatch, "identity" | "style" | "lod">,
  section: SectionJob,
): string {
  return JSON.stringify([
    batch.identity,
    batch.style,
    batch.lod,
    section.part,
    section.input.radial,
    section.input.roundness,
    section.input.caps,
    Array.from(section.input.rings),
  ]);
}
function validBatch(batch: unknown): batch is GeometryBatch {
  if (!batch || typeof batch !== "object") return false;
  const candidate = batch as GeometryBatch;
  return (
    Number.isSafeInteger(candidate.id) &&
    candidate.id >= 0 &&
    typeof candidate.identity === "string" &&
    candidate.identity.length <= 160 &&
    typeof candidate.style === "string" &&
    candidate.style.length <= 256 &&
    Number.isInteger(candidate.lod) &&
    candidate.lod >= 0 &&
    candidate.lod <= 3 &&
    Array.isArray(candidate.sections) &&
    candidate.sections.length > 0 &&
    candidate.sections.length <= 64 &&
    candidate.sections.every(
      (s) => s && typeof s.part === "string" && s.part.length <= 128 && validRigSection(s.input),
    ) &&
    candidate.sections.reduce((n, s) => n + rigSectionVertexCount(s.input), 0) <= 200_000
  );
}

type RigSectionWasm = Pick<GameWasmModule, "generate_rig_section">;
type CachedSection = { packed: Float32Array; backend: "rust" | "typescript" };
type GeometryBatchResponse =
  | {
      id: number;
      sections: { part: string; packed: ArrayBuffer; backend: "rust" | "typescript" }[];
      retainedBytes: number;
      degraded: boolean;
    }
  | { id?: number; error: "invalid-geometry-batch" };

export function createGeometryBatchProcessor(loadWasm: () => Promise<RigSectionWasm | null>) {
  const cache = new Map<string, CachedSection>();
  let bytes = 0;
  let rustFailed = false;

  return async (batch: unknown): Promise<GeometryBatchResponse> => {
    if (!validBatch(batch))
      return {
        ...(typeof batch === "object" &&
        batch !== null &&
        "id" in batch &&
        Number.isSafeInteger(batch.id)
          ? { id: batch.id as number }
          : {}),
        error: "invalid-geometry-batch",
      };

    let module: RigSectionWasm | null = null;
    if (!rustFailed) {
      try {
        module = await loadWasm();
      } catch {
        rustFailed = true;
      }
    }

    const results: { part: string; packed: ArrayBuffer; backend: "rust" | "typescript" }[] = [];
    for (const section of batch.sections) {
      const key = sectionCacheKey(batch, section);
      let cached = cache.get(key);
      if (!cached) {
        let backend: CachedSection["backend"] = module && !rustFailed ? "rust" : "typescript";
        let generated: Float32Array;
        try {
          generated =
            module && !rustFailed
              ? module.generate_rig_section(
                  section.input.rings,
                  section.input.radial,
                  section.input.roundness,
                  section.input.caps,
                )
              : generateRigSectionFallback(section.input);
          if (
            !(generated instanceof Float32Array) ||
            generated.length !== rigSectionVertexCount(section.input) * 5 ||
            !generated.every(Number.isFinite)
          )
            throw new Error("Invalid geometry output");
        } catch {
          rustFailed = true;
          backend = "typescript";
          generated = generateRigSectionFallback(section.input);
        }

        const packed = generated.slice();
        while (cache.size && (bytes + packed.byteLength > MAX_BYTES || cache.size >= 64)) {
          const oldest = cache.keys().next().value!;
          bytes -= cache.get(oldest)!.packed.byteLength;
          cache.delete(oldest);
        }
        cached = { packed, backend };
        cache.set(key, cached);
        bytes += packed.byteLength;
      }
      results.push({
        part: section.part,
        packed: cached.packed.slice().buffer as ArrayBuffer,
        backend: cached.backend,
      });
    }
    return { id: batch.id, sections: results, retainedBytes: bytes, degraded: rustFailed };
  };
}

const processGeometryBatch = createGeometryBatchProcessor(() =>
  loadGameWasm(WASM_CAPABILITY.rigSection, 1500),
);

if (typeof self !== "undefined" && typeof document === "undefined")
  self.onmessage = async ({ data }: MessageEvent<unknown>) => {
    const response = await processGeometryBatch(data);
    if ("error" in response) {
      self.postMessage(response);
      return;
    }
    self.postMessage(
      response,
      response.sections.map((section) => section.packed),
    );
  };
