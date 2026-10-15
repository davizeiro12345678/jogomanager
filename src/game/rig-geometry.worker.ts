/// <reference lib="webworker" />
import {
  generateRigSectionFallback,
  rigSectionVertexCount,
  validRigSection,
  type RigSectionInput,
} from "./rig-section-kernel";
import { loadGameWasm, WASM_CAPABILITY } from "./wasm/runtime";
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
const cache = new Map<string, Float32Array>();
let bytes = 0;
let rustFailed = false;
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
function validBatch(batch: GeometryBatch): boolean {
  return (
    !!batch &&
    Number.isSafeInteger(batch.id) &&
    batch.id >= 0 &&
    typeof batch.identity === "string" &&
    batch.identity.length <= 160 &&
    typeof batch.style === "string" &&
    batch.style.length <= 256 &&
    Number.isInteger(batch.lod) &&
    batch.lod >= 0 &&
    batch.lod <= 3 &&
    Array.isArray(batch.sections) &&
    batch.sections.length > 0 &&
    batch.sections.length <= 64 &&
    batch.sections.every(
      (s) => s && typeof s.part === "string" && s.part.length <= 128 && validRigSection(s.input),
    ) &&
    batch.sections.reduce((n, s) => n + rigSectionVertexCount(s.input), 0) <= 200_000
  );
}
if (typeof self !== "undefined" && typeof document === "undefined")
  self.onmessage = async ({ data }: MessageEvent<GeometryBatch>) => {
    if (!validBatch(data)) {
      self.postMessage({ id: data?.id, error: "invalid-geometry-batch" });
      return;
    }
    const module = rustFailed ? null : await loadGameWasm(WASM_CAPABILITY.rigSection, 1500);
    const results: { part: string; packed: ArrayBuffer; backend: string }[] = [];
    for (const section of data.sections) {
      const key = sectionCacheKey(data, section);
      let packed = cache.get(key);
      let backend = module && !rustFailed ? "rust" : "typescript";
      if (!packed) {
        try {
          packed =
            module && !rustFailed
              ? module.generate_rig_section(
                  section.input.rings,
                  section.input.radial,
                  section.input.roundness,
                  section.input.caps,
                )
              : generateRigSectionFallback(section.input);
          if (
            packed.length !== rigSectionVertexCount(section.input) * 5 ||
            !packed.every(Number.isFinite)
          )
            throw new Error("Invalid geometry output");
        } catch {
          rustFailed = true;
          backend = "typescript";
          packed = generateRigSectionFallback(section.input);
        }
        while (cache.size && (bytes + packed.byteLength > MAX_BYTES || cache.size >= 64)) {
          const oldest = cache.keys().next().value!;
          bytes -= cache.get(oldest)!.byteLength;
          cache.delete(oldest);
        }
        cache.set(key, packed);
        bytes += packed.byteLength;
      }
      results.push({ part: section.part, packed: packed.slice().buffer as ArrayBuffer, backend });
    }
    self.postMessage(
      { id: data.id, sections: results, retainedBytes: bytes, degraded: rustFailed },
      results.map((s) => s.packed),
    );
  };
