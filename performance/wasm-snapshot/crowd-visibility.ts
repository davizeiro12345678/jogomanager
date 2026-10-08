/**
 * Data-only crowd visibility and LOD selection.
 *
 * The TypeScript implementation is the canonical presentation fallback. Rust
 * receives the same flat, ephemeral camera/layout buffers only after the 3D
 * scene is mounted. Match rules, seeds, saves and the sequential simulation
 * Worker deliberately never cross this boundary.
 */

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

function emptySelection(): CrowdSelection {
  return { indices: new Uint32Array(), tiers: new Uint8Array(), counts: new Uint32Array(3) };
}

/** Mirrors the historic Three.js selection path for no-WASM and failed-WASM devices. */
export function selectCrowdFallback(input: CrowdVisibilityInput): CrowdSelection {
  const { layout } = input;
  const maxTiles = Math.min(layout.tileCount, limit(input.maxTiles));
  const maxInstances = limit(input.maxInstances);
  if (!layout.tileCount || !maxTiles || !maxInstances) return emptySelection();

  const visible: { tile: number; distance: number }[] = [];
  for (let tile = 0; tile < layout.tileCount; tile += 1) {
    const offset = tile * 4;
    const x = layout.tiles[offset]!;
    const y = layout.tiles[offset + 1]!;
    const z = layout.tiles[offset + 2]!;
    const radius = layout.tiles[offset + 3]!;
    if (intersectsFrustum(input.frustumPlanes, x, y, z, radius)) {
      visible.push({ tile, distance: tileDistance(layout, tile, input.camera) });
    }
  }
  visible.sort((a, b) => a.distance - b.distance || a.tile - b.tile);
  const selectedCount = Math.min(maxTiles, visible.length || maxTiles);
  const perTile = Math.max(1, Math.ceil(maxInstances / selectedCount));
  const indices = new Uint32Array(Math.min(maxInstances, layout.tileIndices.length));
  const tiers = new Uint8Array(indices.length);
  const counts = new Uint32Array(3);
  const detailedPixels = finite(input.detailedPixels);
  const meshPixels = finite(input.meshPixels);
  const projectedScale = finite(input.projectedScale);
  let count = 0;

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const tile = visible.length ? visible[selectedIndex]!.tile : selectedIndex;
    const start = layout.tileOffsets[tile]!;
    const end = layout.tileOffsets[tile + 1]!;
    const stride = Math.max(1, Math.ceil((end - start) / perTile));
    for (let offset = start; offset < end; offset += stride) {
      if (count >= maxInstances || count >= indices.length) break;
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

  return { indices: indices.subarray(0, count), tiers: tiers.subarray(0, count), counts };
}

/** Rust packs a seat id in the high bits and its mesh tier in the low two bits. */
export function decodeCrowdSelection(packed: Uint32Array): CrowdSelection {
  const indices = new Uint32Array(packed.length);
  const tiers = new Uint8Array(packed.length);
  const counts = new Uint32Array(3);
  for (let index = 0; index < packed.length; index += 1) {
    const value = packed[index]!;
    const tier = value & 0b11;
    if (tier > 2) throw new Error("Crowd WASM returned an unknown LOD tier");
    indices[index] = value >>> 2;
    tiers[index] = tier;
    counts[tier]! += 1;
  }
  return { indices, tiers, counts };
}

type CrowdVisibilityWasmModule = {
  default: () => Promise<unknown>;
  select_crowd: (
    positions: Float64Array,
    tiles: Float64Array,
    tileOffsets: Uint32Array,
    tileIndices: Uint32Array,
    frustumPlanes: Float64Array,
    camera: Float64Array,
    projectedScale: number,
    perspective: boolean,
    maxTiles: number,
    maxInstances: number,
    detailedPixels: number,
    meshPixels: number,
  ) => Uint32Array;
};

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
      const module = (await import("./pkg/crowd_visibility_wasm")) as CrowdVisibilityWasmModule;
      await module.default();
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
