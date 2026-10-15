import { describe, expect, it, vi } from "vitest";
import { createGeometryBatchProcessor, type GeometryBatch } from "./rig-geometry.worker";
import { generateRigSectionFallback, type RigSectionInput } from "./rig-section-kernel";

const sectionInput = (radial = 16): RigSectionInput => ({
  rings: new Float64Array([
    0, 0.2, 0.22, 0, 0.35, 0.24, 0.25, 0.01, 0.8, 0.18, 0.19, 0, 1, 0.12, 0.13, -0.01,
  ]),
  radial,
  roundness: 1.2,
  caps: 3,
});

const batchFor = (input = sectionInput()): GeometryBatch => ({
  id: 1,
  identity: "player-1",
  style: "standard",
  lod: 0,
  sections: [{ part: "torso", input }],
});

const wasmFor = (generate: (input: RigSectionInput) => Float32Array) => ({
  generate_rig_section: (rings: Float64Array, radial: number, roundness: number, caps: number) =>
    generate({ rings, radial, roundness, caps }),
});

describe("rig geometry Worker batch processor", () => {
  it("copies bounded Rust output into transferable buffers", async () => {
    const wasmOutput = generateRigSectionFallback(sectionInput());
    const processor = createGeometryBatchProcessor(async () => wasmFor(() => wasmOutput));
    const result = await processor(batchFor());

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.sections[0]?.backend).toBe("rust");
    expect(result.sections[0]?.packed).toBeInstanceOf(ArrayBuffer);
    const transferred = new Float32Array(result.sections[0]!.packed);
    wasmOutput.fill(99);
    expect(transferred.every(Number.isFinite)).toBe(true);
    expect(transferred).not.toContain(99);
  });

  it.each([
    [
      "import rejection",
      async () => {
        throw new Error("unavailable");
      },
    ],
    ["ABI or timeout fallback", async () => null],
  ])("uses TypeScript after %s", async (_name, loadWasm) => {
    const processor = createGeometryBatchProcessor(loadWasm);
    const result = await processor(batchFor());

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.sections[0]?.backend).toBe("typescript");
    expect(result.sections[0]?.packed).toEqual(
      generateRigSectionFallback(sectionInput()).slice().buffer,
    );
  });

  it.each([
    [
      "a trap",
      () => {
        throw new Error("WASM trap");
      },
    ],
    ["a wrong-length result", () => new Float32Array(1)],
    ["a non-finite result", () => new Float32Array([Number.NaN])],
  ])("falls back to TypeScript after %s", async (_name, generate) => {
    const loadWasm = vi.fn(async () => wasmFor(generate));
    const processor = createGeometryBatchProcessor(loadWasm);
    const result = await processor(batchFor());

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(loadWasm).toHaveBeenCalledTimes(1);
    expect(result.degraded).toBe(true);
    expect(result.sections[0]?.backend).toBe("typescript");
    expect(new Float32Array(result.sections[0]!.packed)).toEqual(
      generateRigSectionFallback(sectionInput()),
    );
  });

  it("rejects malformed batches before loading WASM", async () => {
    const loadWasm = vi.fn(async () => wasmFor(generateRigSectionFallback));
    const processor = createGeometryBatchProcessor(loadWasm);
    const batch = batchFor();
    batch.sections[0]!.input.radial = 1024;

    await expect(processor(batch)).resolves.toMatchObject({
      error: "invalid-geometry-batch",
    });
    expect(loadWasm).not.toHaveBeenCalled();
  });
});
