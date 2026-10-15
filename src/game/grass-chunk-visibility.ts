export type GrassChunkPosition = Readonly<{ x: number; z: number }>;
export type GrassCameraPosition = Readonly<{ x: number; y: number; z: number }>;

/**
 * Marks the nearest rectangular grass chunks without allocating an object list,
 * sorting it, or constructing a Set every LOD tick. The field has only a few
 * chunks, so a bounded insertion list is faster and, importantly, allocation
 * free in the render loop.
 */
export function markNearestGrassChunks(
  chunks: readonly GrassChunkPosition[],
  camera: GrassCameraPosition,
  width: number,
  depth: number,
  maxVisible: number,
  active: Uint8Array,
  closestIndices: Int32Array,
  closestDistances: Float64Array,
  distancesByChunk?: Float64Array,
): void {
  active.fill(0);
  const limit = Math.min(chunks.length, Math.max(0, Math.floor(maxVisible)));
  if (!limit) return;
  if (
    active.length < chunks.length ||
    closestIndices.length < limit ||
    closestDistances.length < limit ||
    (distancesByChunk !== undefined && distancesByChunk.length < chunks.length)
  )
    throw new RangeError("Grass chunk visibility buffers are too small");

  closestIndices.fill(-1, 0, limit);
  closestDistances.fill(Number.POSITIVE_INFINITY, 0, limit);
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]!;
    const dx = Math.max(0, Math.abs(camera.x - chunk.x) - halfWidth);
    const dz = Math.max(0, Math.abs(camera.z - chunk.z) - halfDepth);
    const distance = Math.hypot(dx, camera.y, dz);
    if (distancesByChunk) distancesByChunk[index] = distance;
    let insertion = limit;
    // Iteration order gives ties to the lower, stable chunk index — matching
    // Array#sort's stable ordering from the former implementation.
    for (let slot = 0; slot < limit; slot += 1) {
      if (distance < closestDistances[slot]!) {
        insertion = slot;
        break;
      }
    }
    if (insertion === limit) continue;
    for (let slot = limit - 1; slot > insertion; slot -= 1) {
      closestDistances[slot] = closestDistances[slot - 1]!;
      closestIndices[slot] = closestIndices[slot - 1]!;
    }
    closestDistances[insertion] = distance;
    closestIndices[insertion] = index;
  }

  for (let slot = 0; slot < limit; slot += 1) {
    const index = closestIndices[slot]!;
    if (index >= 0) active[index] = 1;
  }
}
