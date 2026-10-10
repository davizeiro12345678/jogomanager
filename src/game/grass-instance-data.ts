export type GrassChunkOrigin = Readonly<{ x: number; z: number }>;

export type GrassInstanceBuffers = Readonly<{
  matrices: Float32Array;
  colors: Float32Array;
}>;

const UINT32 = 4_294_967_296;

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 1) + 1) % 1) * 6;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const match = lightness - chroma / 2;
  if (sector < 1) return [chroma + match, secondary + match, match] as const;
  if (sector < 2) return [secondary + match, chroma + match, match] as const;
  if (sector < 3) return [match, chroma + match, secondary + match] as const;
  if (sector < 4) return [match, secondary + match, chroma + match] as const;
  if (sector < 5) return [secondary + match, match, chroma + match] as const;
  return [chroma + match, match, secondary + match] as const;
}

/**
 * Produces compact instance attributes without Three.js objects. It is shared
 * by the presentation worker and the rare browser fallback, so blade layout
 * remains deterministic across both paths.
 */
export function buildGrassInstanceBuffers(
  chunks: readonly GrassChunkOrigin[],
  count: number,
  width: number,
  depth: number,
  fieldX: number,
): GrassInstanceBuffers[] {
  let seed = 731;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) | 0;
    return (seed >>> 0) / UINT32;
  };

  return chunks.map((chunk) => {
    const matrices = new Float32Array(count * 16);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const x = chunk.x + (random() - 0.5) * width;
      const z = chunk.z + (random() - 0.5) * depth;
      const band = Math.floor((x + fieldX) / 6) % 2;
      const angle = band * Math.PI + (random() - 0.5) * 1.3;
      const scale = 0.68 + random() * 0.4;
      const cosine = Math.cos(angle) * scale;
      const sine = Math.sin(angle) * scale;
      const matrixOffset = index * 16;
      // Three.js Matrix4 stores these values column-major.
      matrices.set(
        [cosine, 0, -sine, 0, 0, scale, 0, 0, sine, 0, cosine, 0, x, 0.01, z, 1],
        matrixOffset,
      );
      const [red, green, blue] = hslToRgb(0.27 + random() * 0.035, 0.36, 0.5 + random() * 0.13);
      const colorOffset = index * 3;
      colors[colorOffset] = red;
      colors[colorOffset + 1] = green;
      colors[colorOffset + 2] = blue;
    }
    return { matrices, colors };
  });
}
