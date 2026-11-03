import type * as THREE from "three";

/**
 * Size-attenuated points grow as 1 / distance. A particle drifting next to a
 * close-up camera becomes a screen-sized additive sprite and the whole frame
 * flashes white, so every particle system caps its on-screen size in pixels.
 */
export function capPointSize(maxPixels: number) {
  const cap = Math.max(1, maxPixels).toFixed(1);
  return {
    onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>\n\tgl_PointSize = min(gl_PointSize, ${cap});`,
      );
    },
    customProgramCacheKey: () => `point-cap-${cap}`,
  };
}
