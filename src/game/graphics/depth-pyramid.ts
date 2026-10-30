/** Conservative CPU reference for a future WebGPU hierarchical Z pass.
 * For a conventional depth buffer (0 near, 1 far) a MAX reduction is
 * required to avoid culling geometry visible through a near-depth hole.
 * The reference accepts normalized depth; actual depth readback must use
 * a proper shader-generated color encoding, not RGBA color data. */
export type DepthLevel = Readonly<{
  width: number;
  height: number;
  values: Float32Array;
}>;

export function buildConservativeDepthPyramid(
  depth: Float32Array,
  width: number,
  height: number,
): DepthLevel[] {
  if (
    !Number.isSafeInteger(width) || width < 1 ||
    !Number.isSafeInteger(height) || height < 1 ||
    depth.length !== width * height
  ) throw new RangeError("Invalid depth buffer dimensions");
  const first = new Float32Array(depth.length);
  for (let i = 0; i < depth.length; i++) {
    const sample = depth[i]!;
    first[i] = Number.isFinite(sample) && sample >= 0 && sample <= 1 ? sample : 1;
  }
  const levels: DepthLevel[] = [{ width, height, values: first }];
  while (width > 1 || height > 1) {
    const previous = levels[levels.length - 1]!;
    const nextWidth = Math.max(1, Math.ceil(width / 2));
    const nextHeight = Math.max(1, Math.ceil(height / 2));
    const values = new Float32Array(nextWidth * nextHeight);
    for (let y = 0; y < nextHeight; y++) {
      for (let x = 0; x < nextWidth; x++) {
        let farthest = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const px = 2 * x + dx;
          const py = 2 * y + dy;
          if (px < width && py < height)
            farthest = Math.max(farthest, previous.values[py * width + px]!);
        }
        values[y * nextWidth + x] = farthest;
      }
    }
    levels.push({ width: nextWidth, height: nextHeight, values });
    width = nextWidth;
    height = nextHeight;
  }
  return levels;
}

export function certainlyOccluded(
  level: DepthLevel,
  x: number,
  y: number,
  nearestDepth: number,
  tolerance = 0.002,
): boolean {
  if (
    !Number.isFinite(nearestDepth) || nearestDepth <= 0 || nearestDepth > 1 ||
    x < 0 || y < 0 || x >= level.width || y >= level.height
  ) return false;
  return nearestDepth > level.values[Math.floor(y) * level.width + Math.floor(x)]! + tolerance;
}
