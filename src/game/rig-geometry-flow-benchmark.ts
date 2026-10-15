import * as THREE from "three";
import { generateRigSectionFallback, type RigSectionInput } from "./rig-section-kernel";
import { type GeometryFlowMeasurement } from "./rig-geometry-gate";
import { rigSectionGeometry } from "./rig-geometry";
import { RigGeometryWorkerClient } from "./rig-geometry-worker-client";
import type { SectionJob } from "./rig-geometry.worker";

export interface RigGeometryFlowResult extends GeometryFlowMeasurement {
  laneWaitMs: number;
  workerRoundTripMs: number;
  responseValidationMs: number;
  geometryConstructionTypescriptMs: number;
  geometryConstructionRustMs: number;
  inputBytes: number;
  outputBytes: number;
}

export type FirstVisiblePlayerRigProbe = (
  backend: "typescript" | "rust",
  geometries: readonly THREE.BufferGeometry[],
  startedAt: number,
) => Promise<number>;

export interface RigGeometryFlowOptions {
  identity: string;
  style: string;
  lod: number;
  sections: readonly SectionJob[];
  waitForFirstVisiblePlayerRig: FirstVisiblePlayerRigProbe;
}

interface FlowLaneResult {
  totalMs: number;
  firstImageMs: number;
  geometryConstructionMs: number;
  inputBytes: number;
  outputBytes: number;
}

function buildGeometries(sections: readonly SectionJob[], packedSections: readonly Float32Array[]) {
  const geometries: THREE.BufferGeometry[] = [];
  try {
    for (const [index, section] of sections.entries())
      geometries.push(rigSectionGeometry(section.input, packedSections[index]!));
    return geometries;
  } catch (error) {
    geometries.forEach((geometry) => geometry.dispose());
    throw error;
  }
}

async function measureTypescriptLane(options: RigGeometryFlowOptions): Promise<FlowLaneResult> {
  const startedAt = performance.now();
  const packed = options.sections.map((section) => generateRigSectionFallback(section.input));
  const geometryStartedAt = performance.now();
  const geometries = buildGeometries(options.sections, packed);
  const geometryConstructionMs = Math.max(0, performance.now() - geometryStartedAt);
  try {
    const firstImageMs = await options.waitForFirstVisiblePlayerRig(
      "typescript",
      geometries,
      startedAt,
    );
    const totalMs = Math.max(0, performance.now() - startedAt);
    if (!Number.isFinite(firstImageMs) || firstImageMs <= 0 || firstImageMs > totalMs)
      throw new Error("The PlayerRig probe did not report its first visible image");
    return {
      totalMs,
      firstImageMs,
      geometryConstructionMs,
      inputBytes: options.sections.reduce(
        (total, section) => total + section.input.rings.byteLength,
        0,
      ),
      outputBytes: packed.reduce((total, values) => total + values.byteLength, 0),
    };
  } finally {
    geometries.forEach((geometry) => geometry.dispose());
  }
}

async function measureRustLane(options: RigGeometryFlowOptions): Promise<
  FlowLaneResult & {
    laneWaitMs: number;
    workerRoundTripMs: number;
    responseValidationMs: number;
  }
> {
  const client = new RigGeometryWorkerClient();
  const startedAt = performance.now();
  try {
    const result = await client.request({
      identity: options.identity,
      style: options.style,
      lod: options.lod,
      sections: options.sections.map((section) => ({
        part: section.part,
        input: section.input,
      })),
    });
    if (
      !result ||
      result.degraded ||
      result.sections.length !== options.sections.length ||
      result.sections.some((section) => section.backend !== "rust")
    )
      throw new Error(
        "Rust rig geometry was unavailable; no TypeScript-to-TypeScript result is reported",
      );

    const packed = result.sections.map((section) => new Float32Array(section.packed));
    const geometryStartedAt = performance.now();
    const geometries = buildGeometries(options.sections, packed);
    const geometryConstructionMs = Math.max(0, performance.now() - geometryStartedAt);
    try {
      const firstImageMs = await options.waitForFirstVisiblePlayerRig(
        "rust",
        geometries,
        startedAt,
      );
      const totalMs = Math.max(0, performance.now() - startedAt);
      if (!Number.isFinite(firstImageMs) || firstImageMs <= 0 || firstImageMs > totalMs)
        throw new Error("The PlayerRig probe did not report its first visible image");
      return {
        totalMs,
        firstImageMs,
        geometryConstructionMs,
        inputBytes: client.stats.inputBytes,
        outputBytes: client.stats.outputBytes,
        laneWaitMs: client.stats.laneWaitMs,
        workerRoundTripMs: client.stats.workerRoundTripMs,
        responseValidationMs: client.stats.responseValidationMs,
      };
    } finally {
      geometries.forEach((geometry) => geometry.dispose());
    }
  } finally {
    client.dispose();
  }
}

export async function measureRigGeometryFlow(
  options: RigGeometryFlowOptions,
): Promise<RigGeometryFlowResult> {
  if (
    typeof Worker === "undefined" ||
    options.sections.length === 0 ||
    options.sections.length > 64
  )
    throw new Error("Rig geometry flow benchmark requires a browser Worker and 1-64 sections");

  const typescript = await measureTypescriptLane(options);
  const rust = await measureRustLane(options);
  return {
    typescriptMs: typescript.totalMs,
    rustMs: rust.totalMs,
    firstImageTypescriptMs: typescript.firstImageMs,
    firstImageRustMs: rust.firstImageMs,
    laneWaitMs: rust.laneWaitMs,
    workerRoundTripMs: rust.workerRoundTripMs,
    responseValidationMs: rust.responseValidationMs,
    geometryConstructionTypescriptMs: typescript.geometryConstructionMs,
    geometryConstructionRustMs: rust.geometryConstructionMs,
    inputBytes: rust.inputBytes,
    outputBytes: rust.outputBytes,
  };
}
