/**
 * Data-only crowd visibility and LOD selection.
 *
 * The TypeScript implementation is the canonical presentation fallback. Rust
 * receives the same flat, ephemeral camera/layout buffers only after the 3D
 * scene is mounted. Match rules, seeds, saves and the sequential simulation
 * Worker deliberately never cross this boundary.
 */

import { loadGameWasm, WASM_CAPABILITY } from "./runtime.ts";
export type CrowdPoint = Readonly<{ x: number; y: number; z: number }>;

export type CrowdTileInput = Readonly<{
  indices: readonly number[];
  center: CrowdPoint;
  radius: number;
}>;

export type CrowdVisibilityLayout = Readonly<{
  positions: Float64Array;
  tiles: Float64Array;
  tileOffsets: Uint32Array;
  tileIndices: Uint32Array;
  positionCount: number;
  tileCount: number;
}>;

export type CrowdVisibilityInput = Readonly<{
  layout: CrowdVisibilityLayout;
  /** Six frustum planes in Three.js normal.x, normal.y, normal.z, constant order. */
  frustumPlanes: Float64Array;
  camera: CrowdPoint;
  projectedScale: number;
  perspective: boolean;
  maxTiles: number;
  maxInstances: number;
  detailedPixels: number;
  meshPixels: number;
}>;

export type CrowdSelection = Readonly<{
  indices: Uint32Array;
  tiers: Uint8Array;
  counts: Uint32Array;
}>;

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const limit = (value: number) => Math.max(0, Math.floor(finite(value)));

export function createCrowdVisibilityLayout(
  positions: readonly CrowdPoint[],
  tiles: readonly CrowdTileInput[],
): CrowdVisibilityLayout {
  const positionValues = new Float64Array(positions.length * 3);
  positions.forEach((position, index) => {
    const offset = index * 3;
    positionValues[offset] = finite(position.x);
    positionValues[offset + 1] = finite(position.y);
    positionValues[offset + 2] = finite(position.z);
  });

  const tileValues = new Float64Array(tiles.length * 4);
  const tileOffsets = new Uint32Array(tiles.length + 1);
  const flattenedIndices: number[] = [];
  tiles.forEach((tile, index) => {
    const offset = index * 4;
    tileValues[offset] = finite(tile.center.x);
    tileValues[offset + 1] = finite(tile.center.y);
    tileValues[offset + 2] = finite(tile.center.z);
    tileValues[offset + 3] = Math.max(0, finite(tile.radius));
    tileOffsets[index] = flattenedIndices.length;
    for (const seat of tile.indices) {
      if (Number.isInteger(seat) && seat >= 0 && seat < positions.length)
        flattenedIndices.push(seat);
    }
  });
  tileOffsets[tiles.length] = flattenedIndices.length;

  return {
    positions: positionValues,
    tiles: tileValues,
    tileOffsets,
    tileIndices: Uint32Array.from(flattenedIndices),
    positionCount: positions.length,
    tileCount: tiles.length,
  };
}

function intersectsFrustum(planes: Float64Array, x: number, y: number, z: number, radius: number) {
  // A malformed camera must not hide the entire audience. Three's Frustum is
  // always complete in the scene, but keeping this fallback defensive avoids
  // turning a transient projection update into an empty stadium.
  if (planes.length < 24) return true;
  for (let index = 0; index < 24; index += 4) {
    const nx = planes[index]!;
    const ny = planes[index + 1]!;
    const nz = planes[index + 2]!;
    const constant = planes[index + 3]!;
    if (
      !Number.isFinite(nx) ||
      !Number.isFinite(ny) ||
      !Number.isFinite(nz) ||
      !Number.isFinite(constant)
    )
      return true;
    if (nx * x + ny * y + nz * z + constant < -radius) return false;
  }
  return true;
}

function tileDistance(layout: CrowdVisibilityLayout, tile: number, camera: CrowdPoint) {
  const offset = tile * 4;
  return distance3(
    layout.tiles[offset]! - camera.x,
    layout.tiles[offset + 1]! - camera.y,
    layout.tiles[offset + 2]! - camera.z,
  );
}

// Three.Vector3.distanceTo uses this exact order. Chained hypot in Rust and
// Math.hypot in JS round differently on symmetric stands, changing tie order.
function distance3(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

/** Per-layout scratch storage. Results are borrowed until the next select;
 * ordinary selectCrowdFallback calls without scratch remain independent. */
export class CrowdFallbackBuffers {
  readonly layout: CrowdVisibilityLayout;
  readonly tiles: Int32Array;
  readonly distances: Float64Array;
  indices = new Uint32Array();
  tiers = new Uint8Array();
  readonly counts = new Uint32Array(3);
  readonly compareTiles = (left: number, right: number): number => {
    const leftDistance = this.distances[left]!,
      rightDistance = this.distances[right]!;
    if (Number.isNaN(leftDistance)) return Number.isNaN(rightDistance) ? left - right : 1;
    if (Number.isNaN(rightDistance)) return -1;
    // Infinity - Infinity yields NaN; comparisons plus the index tie-break
    // form the same total order as the Rust selector for malformed cameras.
    return leftDistance < rightDistance ? -1 : leftDistance > rightDistance ? 1 : left - right;
  };
  private result: CrowdSelection | null = null;
  constructor(layout: CrowdVisibilityLayout) {
    this.layout = layout;
    this.tiles = new Int32Array(layout.tileCount);
    this.distances = new Float64Array(layout.tileCount);
  }
  prepare(capacity: number): void {
    this.counts.fill(0);
    if (this.indices.length < capacity) {
      this.indices = new Uint32Array(capacity);
      this.tiers = new Uint8Array(capacity);
      this.result = null;
    }
  }
  selection(length: number): CrowdSelection {
    if (this.result?.indices.length !== length)
      this.result = {
        indices: this.indices.subarray(0, length),
        tiers: this.tiers.subarray(0, length),
        counts: this.counts,
      };
    return this.result;
  }
}

/** Mirrors the historic Three.js selection path for no-WASM and failed-WASM devices. */
export function selectCrowdFallback(
  input: CrowdVisibilityInput,
  scratch = new CrowdFallbackBuffers(input.layout),
): CrowdSelection {
  const { layout } = input;
  if (scratch.layout !== layout) throw new Error("Crowd fallback buffers belong to another layout");
  const maxTiles = Math.min(layout.tileCount, limit(input.maxTiles));
  const maxInstances = limit(input.maxInstances);
  scratch.prepare(Math.min(maxInstances, layout.tileIndices.length));
  if (!layout.tileCount || !maxTiles || !maxInstances) return scratch.selection(0);

  const selectedTiles = scratch.tiles;
  const distances = scratch.distances;
  // Insertion keeps the ordinary small camera budget bounded. A direct
  // consumer may request every tile in a large valid layout; sorting that
  // path avoids quadratic insertion work while preserving exact ties.
  const sortVisible = maxTiles > 64;
  let selectedCount = 0;
  for (let tile = 0; tile < layout.tileCount; tile += 1) {
    const offset = tile * 4;
    const x = layout.tiles[offset]!;
    const y = layout.tiles[offset + 1]!;
    const z = layout.tiles[offset + 2]!;
    const radius = layout.tiles[offset + 3]!;
    if (intersectsFrustum(input.frustumPlanes, x, y, z, radius)) {
      const distance = tileDistance(layout, tile, input.camera);
      distances[tile] = distance;
      if (sortVisible) {
        selectedTiles[selectedCount++] = tile;
        continue;
      }
      let slot = selectedCount;
      while (slot > 0 && scratch.compareTiles(tile, selectedTiles[slot - 1]!) < 0) slot -= 1;
      if (slot >= maxTiles) continue;
      for (let cursor = Math.min(selectedCount, maxTiles - 1); cursor > slot; cursor -= 1) {
        selectedTiles[cursor] = selectedTiles[cursor - 1]!;
      }
      selectedTiles[slot] = tile;
      selectedCount = Math.min(selectedCount + 1, maxTiles);
    }
  }
  if (sortVisible && selectedCount) {
    selectedTiles.subarray(0, selectedCount).sort(scratch.compareTiles);
    selectedCount = Math.min(selectedCount, maxTiles);
  }
  if (selectedCount === 0) {
    selectedCount = maxTiles;
    for (let tile = 0; tile < selectedCount; tile += 1) selectedTiles[tile] = tile;
  }
  const perTile = Math.max(1, Math.ceil(maxInstances / selectedCount));
  const { indices, tiers, counts } = scratch;
  let count = 0;
  const detailedPixels = finite(input.detailedPixels);
  const meshPixels = finite(input.meshPixels);
  const projectedScale = finite(input.projectedScale);
  let visitedReferences = 0;

  for (let selected = 0; selected < selectedCount; selected += 1) {
    const tile = selectedTiles[selected]!;
    const start = Math.min(layout.tileIndices.length, layout.tileOffsets[tile]!);
    const end = Math.min(layout.tileIndices.length, layout.tileOffsets[tile + 1]!);
    const stride = Math.max(1, Math.ceil((end - start) / perTile));
    for (let offset = start; offset < end; offset += stride) {
      if (
        count >= maxInstances ||
        count >= indices.length ||
        visitedReferences >= layout.tileIndices.length
      )
        break;
      visitedReferences++;
      const seat = layout.tileIndices[offset]!;
      if (seat >= layout.positionCount) continue;
      const positionOffset = seat * 3;
      const distance = distance3(
        layout.positions[positionOffset]! - input.camera.x,
        layout.positions[positionOffset + 1]! - input.camera.y,
        layout.positions[positionOffset + 2]! - input.camera.z,
      );
      const pixels = input.perspective ? projectedScale / Math.max(1, distance) : projectedScale;
      const tier = pixels >= detailedPixels ? 0 : pixels >= meshPixels ? 1 : 2;
      indices[count] = seat;
      tiers[count] = tier;
      count += 1;
      counts[tier]! += 1;
    }
  }

  return scratch.selection(count);
}

/** Rust packs a seat id in the high bits and its mesh tier in the low two bits. */
export function decodeCrowdSelection(
  packed: Uint32Array,
  reusable?: CrowdSelection | null,
): CrowdSelection {
  const selection =
    reusable?.indices.length === packed.length
      ? reusable
      : {
          indices: new Uint32Array(packed.length),
          tiers: new Uint8Array(packed.length),
          counts: new Uint32Array(3),
        };
  const { indices, tiers, counts } = selection;
  counts.fill(0);
  for (let index = 0; index < packed.length; index += 1) {
    const value = packed[index]!;
    const tier = value & 0b11;
    if (tier > 2) throw new Error("Crowd WASM returned an unknown LOD tier");
    indices[index] = value >>> 2;
    tiers[index] = tier;
    counts[tier]! += 1;
  }
  return selection;
}

export type CrowdVisibilityKernel = Readonly<{
  select: (input: CrowdVisibilityInput) => CrowdSelection;
}>;

let wasmLoader: Promise<CrowdVisibilityKernel | null> | null = null;

/**
 * Deliberately lazy: the browser only asks for Rust after the match scene is
 * mounted. SSR, non-WebAssembly browsers and a failed binary retain the same
 * TypeScript selector.
 */
export function loadCrowdVisibilityWasm(): Promise<CrowdVisibilityKernel | null> {
  if (typeof window === "undefined" || typeof WebAssembly === "undefined")
    return Promise.resolve(null);
  return (wasmLoader ??= (async () => {
    try {
      const module = await loadGameWasm(WASM_CAPABILITY.crowd | WASM_CAPABILITY.boundedCrowd);
      if (!module) return null;
      const camera = new Float64Array(3);
      return {
        select(input) {
          camera[0] = input.camera.x;
          camera[1] = input.camera.y;
          camera[2] = input.camera.z;
          const packed = module.select_crowd(
            input.layout.positions,
            input.layout.tiles,
            input.layout.tileOffsets,
            input.layout.tileIndices,
            input.frustumPlanes,
            camera,
            input.projectedScale,
            input.perspective,
            limit(input.maxTiles),
            limit(input.maxInstances),
            input.detailedPixels,
            input.meshPixels,
          );
          return decodeCrowdSelection(packed);
        },
      } satisfies CrowdVisibilityKernel;
    } catch {
      return null;
    }
  })());
}
